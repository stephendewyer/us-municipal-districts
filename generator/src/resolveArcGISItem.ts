import type {
    ArcGISItemResolution
} from "./types.js";


// =============================================================================
// Configuration
// =============================================================================

const ARCGIS_ITEM_URL =
    "https://www.arcgis.com/sharing/rest/content/items";


// =============================================================================
// Resolve ArcGIS item
// =============================================================================

/**
 * Resolve an ArcGIS Online item ID into item metadata.
 *
 * This function performs ITEM RESOLUTION ONLY.
 *
 * It does not:
 *
 * - inspect services
 * - inspect layers
 * - query features
 * - classify political boundaries
 * - validate candidates
 * - rank candidates
 * - select canonical sources
 */
export async function resolveArcGISItem(
    itemId: string
): Promise<ArcGISItemResolution> {

    const normalizedItemId =
        itemId.trim();


    if (
        normalizedItemId.length === 0
    ) {

        throw new Error(
            "Cannot resolve an ArcGIS item without an item ID."
        );
    }


    const url =
        `${ARCGIS_ITEM_URL}/` +
        `${encodeURIComponent(normalizedItemId)}` +
        `?f=json`;


    let response: Response;

    try {

        response =
            await fetch(
                url,
                {
                    headers: {
                        Accept:
                            "application/json"
                    }
                }
            );

    } catch (error) {

        throw new Error(
            `Unable to contact ArcGIS while resolving ` +
            `item ${normalizedItemId}: ` +
            `${error instanceof Error
                ? error.message
                : String(error)}`
        );
    }


    /*
     * ArcGIS frequently returns useful JSON error information even
     * when the HTTP response itself is not successful.
     *
     * Therefore we parse JSON before relying on response.ok.
     */
    let data: unknown;

    try {

        data =
            await response.json();

    } catch {

        throw new Error(
            `ArcGIS item ${normalizedItemId} ` +
            `returned non-JSON response ` +
            `(${response.status} ${response.statusText}).`
        );
    }


    /*
     * The response must at least be an object.
     */
    if (
        !isRecord(data)
    ) {

        throw new Error(
            `ArcGIS item ${normalizedItemId} ` +
            `returned an invalid JSON response.`
        );
    }


    /*
     * Handle ArcGIS error responses BEFORE normal item validation.
     *
     * This is important because inaccessible, deleted, private,
     * or invalid items can still return an object containing:
     *
     * {
     *   error: {
     *      code: ...,
     *      message: ...
     *   }
     * }
     */
    if (
        "error" in data
    ) {

        const error =
            data.error;


        const message =
            extractArcGISErrorMessage(
                error
            );


        throw new Error(
            `ArcGIS item ${normalizedItemId} ` +
            `could not be resolved: ` +
            `${message}`
        );
    }


    /*
     * HTTP failure without an ArcGIS error object.
     */
    if (
        !response.ok
    ) {

        throw new Error(
            `ArcGIS item resolution failed for ` +
            `${normalizedItemId}: ` +
            `${response.status} ` +
            `${response.statusText}`
        );
    }


    /*
     * Validate the normal item response.
     */
    if (
        !isArcGISItemResponse(
            data
        )
    ) {

        throw new Error(
            `ArcGIS item ${normalizedItemId} ` +
            `returned an invalid item response.`
        );
    }


    /*
     * ArcGIS item metadata should contain an ID.
     */
    if (
        typeof data.id !== "string" ||
        data.id.trim().length === 0
    ) {

        throw new Error(
            `ArcGIS item ${normalizedItemId} ` +
            `did not return an item ID.`
        );
    }


    /*
     * Make sure the returned item actually corresponds
     * to the requested item.
     */
    if (
        data.id.toLowerCase() !==
        normalizedItemId.toLowerCase()
    ) {

        throw new Error(
            `ArcGIS item ${normalizedItemId} ` +
            `returned unexpected item ID ${data.id}.`
        );
    }


    return {

        id:
            data.id,

        title:
            typeof data.title === "string"
                ? data.title
                : undefined,

        type:
            normalizeItemType(
                data.type
            ),

        url:
            typeof data.url === "string"
                ? data.url
                : undefined,

        owner:
            typeof data.owner === "string"
                ? data.owner
                : undefined,

        description:
            typeof data.description === "string"
                ? data.description
                : undefined,

        snippet:
            typeof data.snippet === "string"
                ? data.snippet
                : undefined,

        tags:
            normalizeStringArray(
                data.tags
            ),

        typeKeywords:
            normalizeStringArray(
                data.typeKeywords
            ),

        access:
            typeof data.access === "string"
                ? data.access
                : undefined,

        created:
            typeof data.created === "number"
                ? data.created
                : undefined,

        modified:
            typeof data.modified === "number"
                ? data.modified
                : undefined,

        size:
            typeof data.size === "number"
                ? data.size
                : undefined,

        ownerFolder:
            typeof data.ownerFolder === "string"
                ? data.ownerFolder
                : undefined,

        culture:
            typeof data.culture === "string"
                ? data.culture
                : undefined,

        raw:
            data
    };
}


// =============================================================================
// ArcGIS error handling
// =============================================================================

function extractArcGISErrorMessage(
    value: unknown
): string {

    if (
        isRecord(value)
    ) {

        if (
            typeof value.message === "string"
        ) {

            return value.message;
        }


        if (
            Array.isArray(value.details)
        ) {

            const details =
                value.details
                    .filter(
                        item =>
                            typeof item === "string"
                    )
                    .join("; ");


            if (
                details.length > 0
            ) {

                return details;
            }
        }
    }


    if (
        typeof value === "string"
    ) {

        return value;
    }


    return "Unknown ArcGIS item error.";
}


// =============================================================================
// Item type
// =============================================================================

function normalizeItemType(
    value: unknown
):
    ArcGISItemResolution["type"] {

    if (
        typeof value !== "string"
    ) {

        return "unknown";
    }


    switch (
        value
    ) {

        case "Feature Service":
            return "Feature Service";

        case "Map Service":
            return "Map Service";

        case "Feature Collection":
            return "Feature Collection";

        case "Web Map":
            return "Web Map";

        case "Group Layer":
            return "Group Layer";

        default:
            return "unknown";
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

interface ArcGISItemResponse {

    id?: unknown;

    title?: unknown;

    type?: unknown;

    url?: unknown;

    owner?: unknown;

    description?: unknown;

    snippet?: unknown;

    tags?: unknown;

    typeKeywords?: unknown;

    access?: unknown;

    created?: unknown;

    modified?: unknown;

    size?: unknown;

    ownerFolder?: unknown;

    culture?: unknown;
}


function isArcGISItemResponse(
    value: unknown
): value is ArcGISItemResponse {

    if (
        !isRecord(value)
    ) {

        return false;
    }


    if (
        value.id !== undefined &&
        typeof value.id !== "string"
    ) {

        return false;
    }


    if (
        value.title !== undefined &&
        typeof value.title !== "string"
    ) {

        return false;
    }


    if (
        value.type !== undefined &&
        typeof value.type !== "string"
    ) {

        return false;
    }


    if (
        value.url !== undefined &&
        typeof value.url !== "string"
    ) {

        return false;
    }


    if (
        value.owner !== undefined &&
        typeof value.owner !== "string"
    ) {

        return false;
    }


    if (
        value.description !== undefined &&
        typeof value.description !== "string"
    ) {

        return false;
    }


    if (
        value.snippet !== undefined &&
        typeof value.snippet !== "string"
    ) {

        return false;
    }


    if (
        value.tags !== undefined &&
        !Array.isArray(value.tags)
    ) {

        return false;
    }


    if (
        value.typeKeywords !== undefined &&
        !Array.isArray(value.typeKeywords)
    ) {

        return false;
    }


    if (
        value.created !== undefined &&
        typeof value.created !== "number"
    ) {

        return false;
    }


    if (
        value.modified !== undefined &&
        typeof value.modified !== "number"
    ) {

        return false;
    }


    if (
        value.size !== undefined &&
        typeof value.size !== "number"
    ) {

        return false;
    }


    if (
        value.ownerFolder !== undefined &&
        typeof value.ownerFolder !== "string"
    ) {

        return false;
    }


    if (
        value.culture !== undefined &&
        typeof value.culture !== "string"
    ) {

        return false;
    }


    return true;
}


// =============================================================================
// Generic object helper
// =============================================================================

function isRecord(
    value: unknown
): value is Record<string, unknown> {

    return (
        typeof value === "object" &&
        value !== null
    );
}


// =============================================================================
// Service validation
// =============================================================================

export function isResolvableArcGISService(
    item: ArcGISItemResolution
): boolean {

    return (
        (
            item.type === "Feature Service" ||
            item.type === "Map Service"
        ) &&
        typeof item.url === "string" &&
        item.url.trim().length > 0
    );
}