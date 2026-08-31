import type {
    ArcGISSearchResult
} from "./types.js";


// =============================================================================
// Configuration
// =============================================================================

const ARCGIS_SEARCH_URL =
    "https://www.arcgis.com/sharing/rest/search";


// =============================================================================
// Search response
// =============================================================================

interface ArcGISSearchResponse {

    total?: number;

    start?: number;

    num?: number;

    nextStart?: number;

    results?: unknown[];
}


// =============================================================================
// Search ArcGIS
// =============================================================================

/**
 * Search ArcGIS Online for items matching a query.
 *
 * This function performs SEARCH only.
 *
 * It does NOT:
 *
 * - resolve item metadata
 * - inspect services
 * - inspect layers
 * - query features
 * - classify candidates
 * - validate boundaries
 * - rank candidates
 * - select canonical sources
 */
export async function searchArcGIS(
    query: string,
    options: {
        limit?: number;
    } = {}
): Promise<ArcGISSearchResult[]> {

    const limit =
        Math.min(
            options.limit ?? 50,
            100
        );

    const params =
        new URLSearchParams({

            q:
                query,

            num:
                String(limit),

            start:
                "1",

            f:
                "json"
        });

    const url =
        `${ARCGIS_SEARCH_URL}?${params.toString()}`;

    const response =
        await fetch(url);

    if (!response.ok) {

        throw new Error(
            `ArcGIS search failed: ` +
            `${response.status} ` +
            `${response.statusText}`
        );
    }

    const data:
        unknown =
        await response.json();

    if (
        !isArcGISSearchResponse(data)
    ) {

        throw new Error(
            "ArcGIS search returned an invalid response."
        );
    }

    const results:
        ArcGISSearchResult[] = [];

    for (
        const result of data.results ?? []
    ) {

        const normalized =
            normalizeSearchResult(result);

        if (normalized) {
            results.push(normalized);
        }
    }

    return results;
}


// =============================================================================
// Normalize search result
// =============================================================================

function normalizeSearchResult(
    value: unknown
): ArcGISSearchResult | undefined {

    if (
        typeof value !== "object" ||
        value === null
    ) {

        return undefined;
    }

    const record =
        value as Record<string, unknown>;

    if (
        typeof record.id !== "string" ||
        typeof record.title !== "string" ||
        typeof record.type !== "string"
    ) {

        return undefined;
    }

    const type =
        normalizeSearchResultType(
            record.type
        );

    if (!type) {
        return undefined;
    }

    return {

        id:
            record.id,

        title:
            record.title,

        type,

        url:
            typeof record.url === "string"
                ? record.url
                : "",

        owner:
            typeof record.owner === "string"
                ? record.owner
                : undefined,

        description:
            typeof record.description === "string"
                ? record.description
                : undefined,

        snippet:
            typeof record.snippet === "string"
                ? record.snippet
                : undefined,

        tags:
            normalizeStringArray(
                record.tags
            ),

        access:
            typeof record.access === "string"
                ? record.access
                : undefined,

        created:
            typeof record.created === "number"
                ? record.created
                : undefined,

        modified:
            typeof record.modified === "number"
                ? record.modified
                : undefined,

        typeKeywords:
            normalizeStringArray(
                record.typeKeywords
            )
    };
}


// =============================================================================
// Search result type
// =============================================================================

function normalizeSearchResultType(
    value: string
):
    ArcGISSearchResult["type"] | undefined {

    switch (value) {

        case "Feature Service":
            return "Feature Service";

        case "Map Service":
            return "Map Service";

        default:
            return undefined;
    }
}


// =============================================================================
// String arrays
// =============================================================================

function normalizeStringArray(
    value: unknown
): string[] | undefined {

    if (
        !Array.isArray(value)
    ) {

        return undefined;
    }

    const values =
        value.filter(
            (
                item
            ): item is string =>
                typeof item === "string"
        );

    return values.length > 0
        ? values
        : undefined;
}


// =============================================================================
// Response validation
// =============================================================================

function isArcGISSearchResponse(
    value: unknown
): value is ArcGISSearchResponse {

    if (
        typeof value !== "object" ||
        value === null
    ) {

        return false;
    }

    const record =
        value as Record<
            string,
            unknown
        >;

    if (
        record.results !== undefined &&
        !Array.isArray(record.results)
    ) {

        return false;
    }

    return true;
}