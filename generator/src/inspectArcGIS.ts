import type { GeometryType, ArcGISInspection } from "./types.js";

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

export async function inspectArcGIS(
    inputUrl: string,
    fetchFunction: typeof fetch = fetch
): Promise<ArcGISInspection> {

    const url =
        normalizeArcGISUrl(inputUrl);

    const endpoint =
        parseArcGISEndpoint(url);


    // -------------------------------------------------------------------------
    // Non-ArcGIS URL
    // -------------------------------------------------------------------------

    if (!endpoint) {

        return {
            url,

            isArcGIS: false,

            serviceType: "unknown",

            isLayer: false,

            fields: [],

            districtFields: [],

            supportsQuery: false,

            supportsGeometryQuery: false,

            supportsPagination: false,

            supportsGeoJSON: false,

            isFeatureServer: false,

            isMapServer: false,

            isPolygonLayer: false,

            isLikelyBoundaryLayer: false
        };
    }


    // -------------------------------------------------------------------------
    // Fetch metadata
    // -------------------------------------------------------------------------

    const metadata =
        await fetchArcGISJson(
            endpoint.metadataUrl,
            fetchFunction
        );


    const serviceType =
        endpoint.type;


    // -------------------------------------------------------------------------
    // Basic information
    // -------------------------------------------------------------------------

    const title =
        getString(
            metadata.name
        );

    const description =
        getString(
            metadata.description
        ) ??
        getString(
            metadata.serviceDescription
        );


    // -------------------------------------------------------------------------
    // Geometry
    // -------------------------------------------------------------------------

    const geometryType =
        getString(
            metadata.geometryType
        ) as GeometryType | undefined;


    const isPolygonLayer =
        geometryType ===
        "esriGeometryPolygon";


    // -------------------------------------------------------------------------
    // Fields
    // -------------------------------------------------------------------------

    const fields =
        Array.isArray(
            metadata.fields
        )
            ? metadata.fields
                .map(
                    field =>
                        getString(
                            field?.name
                        )
                )
                .filter(
                    (
                        value
                    ): value is string =>
                        Boolean(value)
                )
            : [];


    // -------------------------------------------------------------------------
    // District fields
    // -------------------------------------------------------------------------

    const districtFields =
        fields.filter(
            field =>
                isDistrictField(field)
        );


    // -------------------------------------------------------------------------
    // Name field
    // -------------------------------------------------------------------------

    const nameField =
        findField(
            fields,
            [
                "name",
                "NAME",
                "Name",

                "district_name",
                "DISTRICT_NAME",
                "DistrictName",

                "ward_name",
                "WARD_NAME",
                "WardName",

                "council_district_name",
                "COUNCIL_DISTRICT_NAME",

                "aldermanic_district_name",
                "ALDERMANIC_DISTRICT_NAME"
            ]
        );


    // -------------------------------------------------------------------------
    // Object ID field
    // -------------------------------------------------------------------------

    const objectIdField =
        findField(
            fields,
            [
                "OBJECTID",
                "ObjectID",
                "objectid",

                "FID",
                "fid",

                "ID",
                "Id",
                "id"
            ]
        );


    // -------------------------------------------------------------------------
    // ArcGIS capabilities
    // -------------------------------------------------------------------------

    const capabilities =
        getString(
            metadata.capabilities
        ) ?? "";


    const supportsQuery =
        capabilities
            .toLowerCase()
            .includes("query");


    const supportsGeometryQuery =
        metadata.supportsAdvancedQueries === true ||
        metadata.supportsCoordinatesQuantization === true ||
        metadata.supportsTrueCurve === true;


    const supportsPagination =
        metadata.supportsPagination === true;


    // -------------------------------------------------------------------------
    // GeoJSON support
    // -------------------------------------------------------------------------

    const supportedQueryFormats =
        getString(
            metadata.supportedQueryFormats
        ) ?? "";


    const supportsGeoJSON =
        supportedQueryFormats
            .toLowerCase()
            .includes("geojson");


    // -------------------------------------------------------------------------
    // Actual feature count
    // -------------------------------------------------------------------------

    const featureCount =
        await getFeatureCount(
            endpoint,
            fetchFunction
        );


    // -------------------------------------------------------------------------
    // Boundary likelihood
    // -------------------------------------------------------------------------

    const searchableText = [
        title,
        endpoint.serviceName,
        description
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();


    const isLikelyBoundaryLayer =
        isPolygonLayer &&
        (
            districtFields.length > 0 ||
            containsBoundaryKeyword(
                searchableText
            )
        );


    // -------------------------------------------------------------------------
    // Return
    // -------------------------------------------------------------------------

    return {

        url,

        isArcGIS: true,

        serviceType,

        isLayer:
            endpoint.layerId !== undefined,

        title,

        serviceName:
            endpoint.serviceName,

        layerName:
            title,

        description,

        geometryType,

        fields,

        districtFields,

        nameField,

        objectIdField,

        featureCount,

        supportsQuery,

        supportsGeometryQuery,

        supportsPagination,

        supportsGeoJSON,

        isFeatureServer:
            serviceType === "FeatureServer",

        isMapServer:
            serviceType === "MapServer",

        isPolygonLayer,

        isLikelyBoundaryLayer
    };
}


// -----------------------------------------------------------------------------
// Endpoint
// -----------------------------------------------------------------------------

interface ArcGISEndpoint {

    type:
        | "FeatureServer"
        | "MapServer";

    layerId?: number;

    metadataUrl: string;

    serviceName?: string;
}


function parseArcGISEndpoint(
    inputUrl: string
): ArcGISEndpoint | null {

    let url: URL;

    try {

        url =
            new URL(inputUrl);

    } catch {

        return null;
    }


    const match =
        url.pathname.match(
            /\/(FeatureServer|MapServer)(?:\/(\d+))?\/?$/i
        );


    if (!match) {
        return null;
    }


    const type =
        match[1].toLowerCase() ===
        "featureserver"
            ? "FeatureServer"
            : "MapServer";


    const layerId =
        match[2] !== undefined
            ? Number(match[2])
            : undefined;


    const metadataUrl =
        removeQueryAndFragment(
            url
        );


    return {

        type,

        layerId,

        metadataUrl,

        serviceName:
            extractServiceName(
                url.pathname
            )
    };
}


// -----------------------------------------------------------------------------
// Service name
// -----------------------------------------------------------------------------

function extractServiceName(
    pathname: string
): string | undefined {

    const match =
        pathname.match(
            /\/rest\/services\/([^/]+)\//i
        );


    if (!match) {
        return undefined;
    }


    return decodeURIComponent(
        match[1]
    );
}


// -----------------------------------------------------------------------------
// Fetch metadata
// -----------------------------------------------------------------------------

async function fetchArcGISJson(
    url: string,
    fetchFunction: typeof fetch
): Promise<Record<string, any>> {

    const requestUrl =
        addJsonParameter(url);


    const response =
        await fetchFunction(
            requestUrl,
            {
                headers: {
                    "User-Agent":
                        "us-municipal-districts-generator"
                }
            }
        );


    if (!response.ok) {

        throw new Error(
            `ArcGIS request failed: HTTP ${response.status} ${response.statusText}`
        );
    }


    const json =
        await response.json() as unknown;


    if (
        typeof json !== "object" ||
        json === null ||
        Array.isArray(json)
    ) {

        throw new Error(
            "ArcGIS response was not a JSON object."
        );
    }


    const data =
        json as Record<string, any>;


    if (data.error) {

        throw new Error(
            `ArcGIS API error: ${
                data.error.message ??
                "Unknown error"
            }`
        );
    }


    return data;
}


// -----------------------------------------------------------------------------
// Feature count
// -----------------------------------------------------------------------------

async function getFeatureCount(
    endpoint: ArcGISEndpoint,
    fetchFunction: typeof fetch
): Promise<number | undefined> {

    /*
     * A service endpoint such as:
     *
     *   .../FeatureServer
     *
     * does not represent an individual layer.
     *
     * We only perform the count request when we have:
     *
     *   .../FeatureServer/0
     *
     * or:
     *
     *   .../MapServer/0
     */

    if (
        endpoint.layerId === undefined
    ) {
        return undefined;
    }


    const queryUrl =
        `${endpoint.metadataUrl}/query` +
        `?where=1%3D1` +
        `&returnCountOnly=true` +
        `&f=json`;


    try {

        const response =
            await fetchFunction(
                queryUrl,
                {
                    headers: {
                        "User-Agent":
                            "us-municipal-districts-generator"
                    }
                }
            );


        if (!response.ok) {
            return undefined;
        }


        const json =
            await response.json() as unknown;


        if (
            typeof json !== "object" ||
            json === null ||
            Array.isArray(json)
        ) {
            return undefined;
        }


        const data =
            json as Record<string, unknown>;


        if (
            typeof data.count === "number"
        ) {
            return data.count;
        }

    } catch {

        /*
         * Feature count is an enhancement.
         *
         * If an ArcGIS server does not allow the
         * count request, discovery should continue.
         */

    }


    return undefined;
}


// -----------------------------------------------------------------------------
// URL helpers
// -----------------------------------------------------------------------------

function normalizeArcGISUrl(
    inputUrl: string
): string {

    const url =
        new URL(inputUrl);


    url.searchParams.delete(
        "token"
    );

    url.searchParams.delete(
        "f"
    );

    url.searchParams.delete(
        "popup"
    );

    url.searchParams.delete(
        "appid"
    );


    return removeTrailingSlash(
        url.toString()
    );
}


function addJsonParameter(
    inputUrl: string
): string {

    const url =
        new URL(inputUrl);


    url.searchParams.set(
        "f",
        "json"
    );


    return url.toString();
}


function removeQueryAndFragment(
    url: URL
): string {

    const copy =
        new URL(
            url.toString()
        );


    copy.search = "";

    copy.hash = "";


    return removeTrailingSlash(
        copy.toString()
    );
}


function removeTrailingSlash(
    value: string
): string {

    return value.replace(
        /\/+$/,
        ""
    );
}


// -----------------------------------------------------------------------------
// Field helpers
// -----------------------------------------------------------------------------

function getString(
    value: unknown
): string | undefined {

    if (
        typeof value !== "string"
    ) {
        return undefined;
    }


    const result =
        value.trim();


    return result.length > 0
        ? result
        : undefined;
}


function findField(
    actualFields: string[],
    possibleFields: readonly string[]
): string | undefined {

    for (
        const possible
            of possibleFields
    ) {

        const exact =
            actualFields.find(
                field =>
                    field === possible
            );


        if (exact) {
            return exact;
        }
    }


    for (
        const possible
            of possibleFields
    ) {

        const lower =
            possible.toLowerCase();


        const match =
            actualFields.find(
                field =>
                    field.toLowerCase() ===
                    lower
            );


        if (match) {
            return match;
        }
    }


    return undefined;
}


function isDistrictField(
    field: string
): boolean {

    const normalized =
        field
            .toLowerCase()
            .replace(
                /[^a-z0-9]/g,
                ""
            );


    return [
        "district",
        "districtid",
        "districtno",
        "districtnum",
        "districtnumber",

        "ward",
        "wardid",
        "wardno",
        "wardnum",
        "wardnumber",

        "councildistrict",
        "councildistrictid",
        "councildistrictno",
        "councildistrictnum",

        "aldermanicdistrict"
    ].includes(
        normalized
    );
}


// -----------------------------------------------------------------------------
// Boundary keywords
// -----------------------------------------------------------------------------

function containsBoundaryKeyword(
    text: string
): boolean {

    const keywords = [

        "ward",
        "wards",

        "council district",
        "council districts",

        "city council district",
        "city council districts",

        "aldermanic district",
        "aldermanic districts",

        "municipal district",
        "municipal districts"
    ];


    return keywords.some(
        keyword =>
            text.includes(keyword)
    );
}