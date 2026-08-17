// generator/src/inspectArcGIS.ts

import type {
    ArcGISField,
    ArcGISGeometryType,
    ArcGISInspection,
    ArcGISServiceType
} from "./types.js";


// =============================================================================
// Types
// =============================================================================

type FetchLike = (
    input: string | URL | Request,
    init?: RequestInit
) => Promise<Response>;

interface ArcGISResponse {
    error?: {
        code?: number;
        message?: string;
        details?: string[];
    };

    name?: string;

    description?: string;

    type?: string;

    geometryType?: string;

    fields?: Array<{
        name?: string;
        alias?: string;
        type?: string;
        length?: number;
        domain?: unknown;
    }>;

    objectIdField?: string;

    maxRecordCount?: number;

    spatialReference?: {
        wkid?: number;
        latestWkid?: number;
        wkt?: string;
    };

    capabilities?: string;

    supportsQuery?: boolean;

    supportsPagination?: boolean;

    supportsGeoJSON?: boolean;

    advancedQueryCapabilities?: {
        supportsPagination?: boolean;
        supportsQueryWithResultType?: boolean;
        supportsReturningQueryExtent?: boolean;
        supportsOrderBy?: boolean;
        supportsDistinct?: boolean;
        supportsQueryWithDistance?: boolean;
    };

    layers?: Array<{
        id?: number;
        name?: string;
        url?: string;
    }>;

    tables?: Array<{
        id?: number;
        name?: string;
        url?: string;
    }>;

    supportedQueryFormats?: string;
}


// =============================================================================
// Public API
// =============================================================================

/**
 * Inspect an ArcGIS REST URL.
 *
 * Supports:
 *
 *   FeatureServer service roots
 *   FeatureServer layer URLs
 *   MapServer service roots
 *   MapServer layer URLs
 *
 * For a service root containing multiple layers, the most likely
 * polygon boundary layer is selected.
 */
export async function inspectArcGIS(
    url: string,
    fetchImpl: FetchLike = fetch
): Promise<ArcGISInspection> {

    const normalizedUrl =
        normalizeUrl(url);

    const serviceType =
        detectServiceType(normalizedUrl);

    if (serviceType === "unknown") {

        return createUnknownInspection(
            normalizedUrl
        );
    }

    const isLayer =
        detectIsLayer(
            normalizedUrl
        );

    try {

        /*
         * ---------------------------------------------------------------------
         * Individual layer
         * ---------------------------------------------------------------------
         *
         * If the caller supplied:
         *
         *   .../FeatureServer/0
         *
         * inspect that layer directly.
         */
        if (isLayer) {

            return await inspectLayer(
                normalizedUrl,
                serviceType,
                {},
                fetchImpl
            );
        }


        /*
         * ---------------------------------------------------------------------
         * Service root
         * ---------------------------------------------------------------------
         *
         * If the caller supplied:
         *
         *   .../FeatureServer
         *
         * or:
         *
         *   .../MapServer
         *
         * first inspect the service metadata and then select the most
         * promising layer.
         */
        return await inspectService(
            normalizedUrl,
            serviceType,
            fetchImpl
        );

    } catch (error) {

        /*
         * Inspection failures should not terminate discovery for all
         * municipalities. Return a valid inspection object instead.
         */

        return {
            url: normalizedUrl,

            isArcGIS: true,

            serviceType,

            isLayer,

            districtFields: [],

            nameFields: []
        };
    }
}


// =============================================================================
// Service inspection
// =============================================================================

async function inspectService(
    serviceUrl: string,
    serviceType: ArcGISServiceType,
    fetchImpl: FetchLike
): Promise<ArcGISInspection> {

    const metadata =
        await fetchArcGISJson(
            serviceUrl,
            fetchImpl
        );


    /*
     * If ArcGIS explicitly returned an error, return the service as
     * recognized ArcGIS but without layer information.
     */
    if (metadata.error) {

        return {
            url: serviceUrl,

            isArcGIS: true,

            serviceType,

            isLayer: false,

            title:
                metadata.name,

            description:
                metadata.description,

            serviceName:
                extractServiceName(
                    serviceUrl
                ),

            serviceUrl,

            districtFields: [],

            nameFields: []
        };
    }


    const layers =
        getServiceLayers(
            metadata,
            serviceUrl
        );


    /*
     * A service may contain no layers, particularly if it is a
     * service type that does not expose feature layers in the
     * expected way.
     */
    if (layers.length === 0) {

        return {
            url: serviceUrl,

            isArcGIS: true,

            serviceType,

            isLayer: false,

            title:
                metadata.name,

            description:
                metadata.description,

            serviceName:
                extractServiceName(
                    serviceUrl
                ),

            serviceUrl,

            districtFields: [],

            nameFields: []
        };
    }


    /*
     * Select the layer most likely to represent a municipal
     * political boundary.
     */
    const selectedLayer =
        selectBestLayer(
            layers
        );


    /*
     * If we cannot construct a usable layer URL, fall back to the
     * service itself.
     */
    if (!selectedLayer.url) {

        return {
            url: serviceUrl,

            isArcGIS: true,

            serviceType,

            isLayer: false,

            title:
                metadata.name,

            description:
                metadata.description,

            serviceName:
                extractServiceName(
                    serviceUrl
                ),

            serviceUrl,

            districtFields: [],

            nameFields: []
        };
    }


    return inspectLayer(
        selectedLayer.url,
        serviceType,
        {
            serviceName:
                metadata.name ??
                extractServiceName(
                    serviceUrl
                ),

            serviceTitle:
                metadata.name,

            serviceDescription:
                metadata.description,

            serviceUrl
        },
        fetchImpl
    );
    
}


// =============================================================================
// Layer inspection
// =============================================================================

interface LayerContext {
    serviceName?: string;

    serviceTitle?: string;

    serviceDescription?: string;

    serviceUrl?: string;
}


async function inspectLayer(
    layerUrl: string,
    serviceType: ArcGISServiceType,
    context: LayerContext = {},
    fetchImpl: FetchLike = fetch
): Promise<ArcGISInspection> {

    const metadata =
        await fetchArcGISJson(
            layerUrl,
            fetchImpl
        );


    if (metadata.error) {

        return {
            url: layerUrl,

            isArcGIS: true,

            serviceType,

            isLayer: true,

            title:
                context.serviceTitle ??
                extractLayerName(
                    layerUrl
                ),

            serviceName:
                context.serviceName,

            layerName:
                extractLayerName(
                    layerUrl
                ),

            description:
                context.serviceDescription,

            serviceUrl:
                context.serviceUrl,

            districtFields: [],

            nameFields: []
        };
    }


    const fields =
        normalizeFields(
            metadata.fields
        );


    const districtFields =
        detectDistrictFields(
            fields
        );


    const nameFields =
        detectNameFields(
            fields
        );


    const geometryType =
        normalizeGeometryType(
            metadata.geometryType
        );


    const capabilities =
        normalizeCapabilities(
            metadata
        );


    const title =
        metadata.name ??
        extractLayerName(
            layerUrl
        );


    return {
        url: layerUrl,

        isArcGIS: true,

        serviceType,

        isLayer: true,

        title,

        serviceName:
            context.serviceName ??
            extractServiceName(
                layerUrl
            ),

        layerName:
            metadata.name ??
            extractLayerName(
                layerUrl
            ),

        description:
            metadata.description ??
            context.serviceDescription,

        geometryType,

        fields,

        objectIdField:
            metadata.objectIdField,

        maxRecordCount:
            metadata.maxRecordCount,

        spatialReference:
            metadata.spatialReference,

        supportsQuery:
            capabilities.supportsQuery,

        supportsGeoJSON:
            capabilities.supportsGeoJSON,

        supportsPagination:
            capabilities.supportsPagination,

        serviceUrl:
            context.serviceUrl ??
            deriveServiceRoot(
                layerUrl
            ),

        districtField:
            districtFields[0],

        districtFields,

        nameField:
            nameFields[0],

        nameFields
    };
}


// =============================================================================
// Layer selection
// =============================================================================

interface ServiceLayer {
    id?: number;

    name?: string;

    url?: string;
}


/**
 * Extract usable layers from ArcGIS service metadata.
 */
function getServiceLayers(
    metadata: ArcGISResponse,
    serviceUrl: string
): ServiceLayer[] {

    const layers =
        Array.isArray(metadata.layers)
            ? metadata.layers
            : [];


    return layers
        .map(layer => {

            const id =
                layer.id;

            const name =
                layer.name;


            let url =
                layer.url;


            /*
             * Some ArcGIS responses provide an ID but no URL.
             */
            if (
                !url &&
                id !== undefined
            ) {

                url =
                    `${serviceUrl}/${id}`;
            }


            return {
                id,
                name,
                url
            };
        })
        .filter(
            layer =>
                Boolean(
                    layer.url
                )
        );
}


/**
 * Select the layer most likely to be a political boundary.
 *
 * We intentionally do not rely solely on names. A polygon layer
 * with district/ward terminology should beat a generic layer.
 */
function selectBestLayer(
    layers: ServiceLayer[]
): ServiceLayer {

    let best =
        layers[0];

    let bestScore =
        Number.NEGATIVE_INFINITY;


    for (const layer of layers) {

        const score =
            scoreLayer(
                layer
            );


        if (
            score >
            bestScore
        ) {

            best =
                layer;

            bestScore =
                score;
        }
    }


    return best;
}


function scoreLayer(
    layer: ServiceLayer
): number {

    const name =
        normalize(
            layer.name
        );


    let score =
        0;


    /*
     * Political terminology.
     */
    if (
        containsAny(
            name,
            [
                "ward",
                "wards"
            ]
        )
    ) {

        score += 50;
    }


    if (
        containsAny(
            name,
            [
                "council district",
                "council districts",
                "city council"
            ]
        )
    ) {

        score += 60;
    }


    if (
        containsAny(
            name,
            [
                "district",
                "districts"
            ]
        )
    ) {

        score += 35;
    }


    if (
        containsAny(
            name,
            [
                "boundary",
                "boundaries"
            ]
        )
    ) {

        score += 30;
    }


    /*
     * Negative thematic signals.
     */
    if (
        containsAny(
            name,
            [
                "transit",
                "bus",
                "rail",
                "park",
                "parks",
                "golf",
                "tree",
                "groundwater",
                "housing",
                "crime",
                "police",
                "airport",
                "road",
                "roads",
                "parcel",
                "parcels"
            ]
        )
    ) {

        score -= 50;
    }


    return score;
}


// =============================================================================
// Field detection
// =============================================================================

/**
 * Detect fields that probably identify a political district.
 */
function detectDistrictFields(
    fields: ArcGISField[]
): string[] {

    const scored =
        fields
            .map(
                field => ({
                    field,
                    score:
                        scoreDistrictField(
                            field
                        )
                })
            )
            .filter(
                item =>
                    item.score > 0
            )
            .sort(
                (a, b) =>
                    b.score -
                    a.score
            );


    return scored.map(
        item =>
            item.field.name
    );
}


function scoreDistrictField(
    field: ArcGISField
): number {

    const name =
        normalize(
            field.name
        );

    const alias =
        normalize(
            field.alias
        );


    let score =
        0;


    /*
     * Strong field names.
     */
    if (
        containsAny(
            name,
            [
                "ward",
                "wardnum",
                "wardnumber",
                "ward_no",
                "ward_num"
            ]
        )
    ) {

        score += 60;
    }


    if (
        containsAny(
            name,
            [
                "council_district",
                "councildistrict",
                "council district"
            ]
        )
    ) {

        score += 70;
    }


    if (
        containsAny(
            name,
            [
                "district",
                "districtid",
                "district_id",
                "districtnum",
                "district_num",
                "districtnumber",
                "district_number"
            ]
        )
    ) {

        score += 50;
    }


    /*
     * Aliases are often more useful than database field names.
     */
    if (
        containsAny(
            alias,
            [
                "ward",
                "council district",
                "council",
                "district"
            ]
        )
    ) {

        score += 30;
    }


    return score;
}


/**
 * Detect fields that probably contain a human-readable district name.
 */
function detectNameFields(
    fields: ArcGISField[]
): string[] {

    const scored =
        fields
            .map(
                field => ({
                    field,
                    score:
                        scoreNameField(
                            field
                        )
                })
            )
            .filter(
                item =>
                    item.score > 0
            )
            .sort(
                (a, b) =>
                    b.score -
                    a.score
            );


    return scored.map(
        item =>
            item.field.name
    );
}


function scoreNameField(
    field: ArcGISField
): number {

    const name =
        normalize(
            field.name
        );

    const alias =
        normalize(
            field.alias
        );


    let score =
        0;


    /*
     * Very strong naming fields.
     */
    if (
        containsAny(
            name,
            [
                "ward_name",
                "wardname",
                "district_name",
                "districtname",
                "council_district_name",
                "councildistrictname"
            ]
        )
    ) {

        score += 70;
    }


    if (
        containsAny(
            alias,
            [
                "ward name",
                "district name",
                "council district name"
            ]
        )
    ) {

        score += 60;
    }


    /*
     * Generic name fields are useful but weaker.
     */
    if (
        name === "name" ||
        name.endsWith("_name") ||
        name.endsWith("name")
    ) {

        score += 30;
    }


    if (
        alias === "name" ||
        alias.endsWith(" name")
    ) {

        score += 20;
    }


    return score;
}


// =============================================================================
// ArcGIS metadata
// =============================================================================

async function fetchArcGISJson(
    url: string,
    fetchImpl: FetchLike = fetch
): Promise<ArcGISResponse> {

    const separator =
        url.includes("?")
            ? "&"
            : "?";


    const requestUrl =
        `${url}${separator}f=json`;


    const response =
        await fetchImpl(
            requestUrl,
            {
                headers: {
                    Accept:
                        "application/json"
                }
            }
        );


    if (!response.ok) {

        throw new Error(
            [
                "ArcGIS request failed.",
                `URL: ${url}`,
                `Status: ${response.status}`,
                `Status text: ${response.statusText}`
            ].join("\n")
        );
    }


    const json =
        await response.json() as ArcGISResponse;


    return json;
}


// =============================================================================
// URL handling
// =============================================================================

function normalizeUrl(
    url: string
): string {

    return url
        .trim()
        .replace(
            /\/+$/,
            ""
        );
}


function detectServiceType(
    url: string
): ArcGISServiceType {

    const match =
        url.match(
            /\/(FeatureServer|MapServer)(?:\/|$)/i
        );


    if (!match) {
        return "unknown";
    }


    return (
        match[1].toLowerCase() ===
        "featureserver"
    )
        ? "FeatureServer"
        : "MapServer";
}


function detectIsLayer(
    url: string
): boolean {

    /*
     * Examples:
     *
     * .../FeatureServer
     * .../FeatureServer/0
     *
     * .../MapServer
     * .../MapServer/35
     */

    return Boolean(
        url.match(
            /\/(?:FeatureServer|MapServer)\/\d+$/i
        )
    );
}


function deriveServiceRoot(
    url: string
): string {

    const match =
        url.match(
            /^(.*\/(?:FeatureServer|MapServer))(?:\/\d+)?$/i
        );


    return (
        match?.[1] ??
        url
    );
}


function extractServiceName(
    url: string
): string | undefined {

    const serviceRoot =
        deriveServiceRoot(
            url
        );


    const match =
        serviceRoot.match(
            /\/([^/]+)\/(?:FeatureServer|MapServer)$/i
        );


    return (
        match?.[1]
    );
}


function extractLayerName(
    url: string
): string | undefined {

    const match =
        url.match(
            /\/(?:FeatureServer|MapServer)\/(\d+)$/i
        );


    if (!match) {
        return undefined;
    }


    return `Layer ${match[1]}`;
}


// =============================================================================
// Geometry
// =============================================================================

function normalizeGeometryType(
    value?: string
): ArcGISGeometryType | undefined {

    if (!value) {
        return undefined;
    }


    const normalized =
        value
            .trim()
            .toLowerCase();


    switch (normalized) {

        case "esrigeometrypoint":
            return "esriGeometryPoint";

        case "esrigeometrymultipoint":
            return "esriGeometryMultipoint";

        case "esrigeometrypolyline":
            return "esriGeometryPolyline";

        case "esrigeometrypolygon":
            return "esriGeometryPolygon";

        case "esrigeometryenvelope":
            return "esriGeometryEnvelope";

        case "point":
            return "point";

        case "multipoint":
            return "multipoint";

        case "polyline":
            return "polyline";

        case "polygon":
            return "polygon";

        default:
            return "unknown";
    }
}


// =============================================================================
// Capabilities
// =============================================================================

function normalizeCapabilities(
    metadata: ArcGISResponse
): {
    supportsQuery?: boolean;
    supportsGeoJSON?: boolean;
    supportsPagination?: boolean;
} {

    const capabilities =
        normalize(
            metadata.capabilities
        );


    const supportsQuery =
        metadata.supportsQuery ??
        capabilities.includes(
            "query"
        );


    const supportsPagination =
        metadata.supportsPagination ??
        metadata
            .advancedQueryCapabilities
            ?.supportsPagination;


    /*
     * ArcGIS FeatureServer layers frequently expose GeoJSON through
     * supportedQueryFormats in newer APIs. We don't require it to
     * exist because it isn't present in every ArcGIS deployment.
     */

    function supportsFormat(
        supportedQueryFormats: unknown,
        format: string
    ): boolean {

        if (
            typeof supportedQueryFormats !== "string"
        ) {
            return false;
        }

        return supportedQueryFormats
            .split(",")
            .map(value => value.trim().toLowerCase())
            .includes(format.toLowerCase());
    }

    const supportsGeoJSON =
        supportsFormat(
            metadata.supportedQueryFormats,
            "geojson"
        );


    return {
        supportsQuery,

        supportsGeoJSON,

        supportsPagination
    };
}


// =============================================================================
// Fields
// =============================================================================

function normalizeFields(
    fields:
        | ArcGISResponse["fields"]
        | undefined
): ArcGISField[] {

    if (!Array.isArray(fields)) {
        return [];
    }


    return fields
        .filter(
            field =>
                typeof field.name ===
                "string"
        )
        .map(
            field => ({
                name:
                    field.name!.trim(),

                ...(field.alias
                    ? {
                        alias:
                            field.alias.trim()
                    }
                    : {}),

                ...(field.type
                    ? {
                        type:
                            field.type
                    }
                    : {}),

                ...(typeof field.length ===
                    "number"
                    ? {
                        length:
                            field.length
                    }
                    : {}),

                ...(field.domain !==
                    undefined
                    ? {
                        domain:
                            field.domain
                    }
                    : {})
            })
        );
}


// =============================================================================
// Unknown inspection
// =============================================================================

function createUnknownInspection(
    url: string
): ArcGISInspection {

    return {
        url,

        isArcGIS: false,

        serviceType: "unknown",

        isLayer: false,

        districtFields: [],

        nameFields: []
    };
}


// =============================================================================
// Helpers
// =============================================================================

function normalize(
    value?: string
): string {

    return (value ?? "")
        .toLowerCase()
        .replace(
            /[_-]+/g,
            " "
        )
        .replace(
            /\s+/g,
            " "
        )
        .trim();
}


function containsAny(
    value: string,
    terms: string[]
): boolean {

    return terms.some(
        term =>
            value.includes(
                normalize(term)
            )
    );
}