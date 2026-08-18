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

    results?: ArcGISSearchResult[];
}


// =============================================================================
// Search ArcGIS
// =============================================================================

/**
 * Search ArcGIS Online for services matching a query.
 *
 * This function is intentionally responsible only for discovery.
 *
 * It does NOT:
 *
 * - inspect services
 * - classify candidates
 * - determine whether a layer is political
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
        await fetch(
            url
        );


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
        !isArcGISSearchResponse(
            data
        )
    ) {

        throw new Error(
            "ArcGIS search returned an invalid response."
        );
    }


    return (
        data.results ?? []
    );
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
        !Array.isArray(
            record.results
        )
    ) {

        return false;
    }


    return true;
}