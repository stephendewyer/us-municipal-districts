import type {
    ArcGISField,
    ArcGISQueryOptions,
    ArcGISQueryResult
} from "./types.js";


// =============================================================================
// Types
// =============================================================================


export interface ArcGISQueryFeature {

    attributes:
        Record<string, unknown>;

    geometry?:
        unknown;
}


interface ArcGISQueryResponse {

    error?: {
        code?: number;
        message?: string;
        details?: string[];
    };

    features?: Array<{
        attributes?: Record<string, unknown>;
        geometry?: unknown;
    }>;

    fields?: Array<{
        name?: string;
        alias?: string;
        type?: string;
        length?: number;
        domain?: unknown;
    }>;

    exceededTransferLimit?: boolean;
}


type FetchLike = (
    input: string | URL | Request,
    init?: RequestInit
) => Promise<Response>;


// =============================================================================
// Public API
// =============================================================================

export async function queryArcGISLayer(
    url: string,
    options: ArcGISQueryOptions = {},
    fetchImpl: FetchLike = fetch
): Promise<ArcGISQueryResult> {

    const normalizedUrl =
        normalizeUrl(url);


    const resultRecordCount =
        options.resultRecordCount ??
        100;


    const resultOffset =
        options.resultOffset ??
        0;


    const returnGeometry =
        options.returnGeometry ??
        false;


    const maxUniqueValues =
        options.maxUniqueValues ??
        100;


    const outFields =
        options.outFields &&
        options.outFields.length > 0
            ? options.outFields.join(",")
            : "*";


    const where =
        options.where ??
        "1=1";


    const queryUrl =
        buildQueryUrl(
            normalizedUrl,
            {
                where,
                outFields,
                resultRecordCount,
                resultOffset,
                returnGeometry
            }
        );


    try {

        const response =
            await fetchImpl(
                queryUrl,
                {
                    headers: {
                        Accept:
                            "application/json"
                    }
                }
            );


        if (!response.ok) {

            return createFailedResult(
                normalizedUrl,
                [
                    "ArcGIS query failed.",
                    `Status: ${response.status}`,
                    `Status text: ${response.statusText}`
                ].join(" ")
            );
        }


        const json =
            await response.json() as ArcGISQueryResponse;


        if (json.error) {

            return createFailedResult(
                normalizedUrl,
                [
                    `ArcGIS error ${json.error.code ?? ""}`.trim(),
                    json.error.message ?? "",
                    ...(json.error.details ?? [])
                ]
                    .filter(Boolean)
                    .join(" ")
            );
        }


        const features =
            normalizeFeatures(
                json.features
            );


        const fields =
            normalizeFields(
                json.fields
            );


        const uniqueValues =
            collectUniqueValues(
                features,
                maxUniqueValues
            );


        return {

            url:
                normalizedUrl,

            success:
                true,

            features,

            featureCount:
                features.length,

            exceededTransferLimit:
                Boolean(
                    json.exceededTransferLimit
                ),

            fields,

            uniqueValues
        };

    } catch (error) {

        return createFailedResult(
            normalizedUrl,
            error instanceof Error
                ? error.message
                : String(error)
        );
    }
}


// =============================================================================
// Query URL
// =============================================================================

interface QueryParameters {

    where: string;

    outFields: string;

    resultRecordCount: number;

    resultOffset: number;

    returnGeometry: boolean;
}


function buildQueryUrl(
    url: string,
    parameters: QueryParameters
): string {

    const query =
        new URLSearchParams();

    query.set(
        "where",
        parameters.where
    );

    query.set(
        "outFields",
        parameters.outFields
    );

    query.set(
        "returnGeometry",
        parameters.returnGeometry
            ? "true"
            : "false"
    );

    query.set(
        "f",
        "json"
    );

    query.set(
        "resultRecordCount",
        String(
            parameters.resultRecordCount
        )
    );

    query.set(
        "resultOffset",
        String(
            parameters.resultOffset
        )
    );


    return `${url}/query?${query.toString()}`;
}


// =============================================================================
// Feature normalization
// =============================================================================

function normalizeFeatures(
    features:
        | ArcGISQueryResponse["features"]
        | undefined
): ArcGISQueryFeature[] {

    if (!Array.isArray(features)) {

        return [];
    }


    return features
        .filter(
            feature =>
                feature &&
                typeof feature === "object"
        )
        .map(
            feature => ({
                attributes:
                    feature.attributes ?? {},

                ...(feature.geometry !== undefined
                    ? {
                        geometry:
                            feature.geometry
                    }
                    : {})
            })
        );
}


// =============================================================================
// Field normalization
// =============================================================================

function normalizeFields(
    fields:
        | ArcGISQueryResponse["fields"]
        | undefined
): ArcGISField[] {

    if (!Array.isArray(fields)) {

        return [];
    }


    return fields
        .filter(
            field =>
                typeof field.name === "string"
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

                ...(typeof field.length === "number"
                    ? {
                        length:
                            field.length
                    }
                    : {}),

                ...(field.domain !== undefined
                    ? {
                        domain:
                            field.domain
                    }
                    : {})
            })
        );
}


// =============================================================================
// Unique values
// =============================================================================

function collectUniqueValues(
    features: ArcGISQueryFeature[],
    maxUniqueValues: number
): Record<string, unknown[]> {

    const values =
        new Map<
            string,
            Set<string>
        >();


    for (const feature of features) {

        for (
            const [
                field,
                value
            ]
            of Object.entries(
                feature.attributes
            )
        ) {

            if (
                value === null ||
                value === undefined ||
                value === ""
            ) {
                continue;
            }


            if (!values.has(field)) {

                values.set(
                    field,
                    new Set()
                );
            }


            const set =
                values.get(field)!;


            if (
                set.size <
                maxUniqueValues
            ) {

                set.add(
                    String(value)
                );
            }
        }
    }


    const result:
        Record<string, unknown[]> = {};


    for (
        const [
            field,
            set
        ]
        of values
    ) {

        result[field] =
            Array.from(set);
    }


    return result;
}


// =============================================================================
// Errors
// =============================================================================

function createFailedResult(
    url: string,
    error: string
): ArcGISQueryResult {

    return {

        url,

        success:
            false,

        features: [],

        featureCount:
            0,

        exceededTransferLimit:
            false,

        fields: [],

        uniqueValues: {},

        error
    };
}


// =============================================================================
// URL
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