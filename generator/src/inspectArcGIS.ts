import type { GeometryType } from "./types.js";


// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ArcGISInspection {
    url: string;

    isArcGIS: boolean;

    serviceType:
        | "FeatureServer"
        | "MapServer"
        | "unknown";

    isLayer: boolean;

    title?: string;

    serviceName?: string;

    layerName?: string;

    description?: string;

    geometryType?: GeometryType;

    fields: string[];

    districtFields: string[];

    nameField?: string;

    objectIdField?: string;

    featureCount?: number;

    supportsGeoJSON: boolean;

    isPolygonLayer: boolean;

    isLikelyBoundaryLayer: boolean;
}


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

            supportsGeoJSON: false,

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
    // GeoJSON support
    // -------------------------------------------------------------------------

    const supportedQueryFormats =
        getString(
            metadata.supportedQueryFormats
        ) ??
        "";

    const supportsGeoJSON =
        supportedQueryFormats
            .toLowerCase()
            .includes("geojson");


    // -------------------------------------------------------------------------
    // Feature count
    // -------------------------------------------------------------------------

    const featureCount =
        typeof metadata.maxRecordCount === "number"
            ? metadata.maxRecordCount
            : undefined;


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

        supportsGeoJSON,

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
// Fetch
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
// URL helpers
// -----------------------------------------------------------------------------

function normalizeArcGISUrl(
    inputUrl: string
): string {

    const url =
        new URL(inputUrl);


    url.searchParams.delete("token");
    url.searchParams.delete("f");
    url.searchParams.delete("popup");
    url.searchParams.delete("appid");


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