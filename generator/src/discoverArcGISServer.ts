import type {
    CensusPlace
} from "./types.js";


// =============================================================================
// Types
// =============================================================================

export interface ArcGISServerServiceResult {

    /**
     * ArcGIS Server service name.
     *
     * Includes the folder when one exists.
     *
     * Example:
     *
     *     Public/Council_Districts
     */
    name: string;

    /**
     * ArcGIS Server service type.
     */
    type:
        | "MapServer"
        | "FeatureServer";

    /**
     * Full ArcGIS REST service URL.
     */
    url: string;

    /**
     * Preliminary retrieval score.
     *
     * This score is only used to prioritize server-discovered services.
     * It is NOT the final discovery/ranking score.
     */
    score: number;

    /**
     * Reasons for the preliminary retrieval score.
     */
    reasons: string[];
}


interface ArcGISServerDirectoryResponse {

    folders?: unknown;

    services?: unknown;
}


interface ArcGISServerService {

    name?: unknown;

    type?: unknown;
}


// =============================================================================
// Constants
// =============================================================================

const SERVER_REQUEST_TIMEOUT_MS = 10_000;


/**
 * Maximum number of server-discovered services returned for inspection.
 *
 * Server catalogs can be very large, so this prevents expensive downstream
 * inspection from growing without bound.
 */
const MAX_SERVER_CANDIDATES = 3;


/**
 * Terms commonly found in municipal political-boundary service names.
 */
const POLITICAL_SERVICE_TERMS = [

    "council_districts",

    "council_district",

    "ward_boundaries",

    "ward_boundary",

    "aldermanic_districts",

    "aldermanic_district",

    "alderman_districts",

    "alderman_district",

    "municipal_districts",

    "municipal_district",

    "political_boundaries",

    "political_boundary",

    "wards",

    "ward",

    "council",

    "districts",

    "district"
];


/**
 * Terms that commonly indicate a thematic dataset rather than a
 * municipal political-boundary dataset.
 *
 * These are used only for preliminary retrieval scoring. Final
 * classification remains the responsibility of classifyCandidate().
 */
const NEGATIVE_SERVICE_TERMS = [

    "eviction",

    "zoning",

    "parcel",

    "parcels",

    "property",

    "properties",

    "road",

    "roads",

    "street",

    "streets",

    "pavement",

    "transportation",

    "transit",

    "bus",

    "housing",

    "crime",

    "tree",

    "water",

    "utility",

    "utilities",

    "fire",

    "police",

    "hospital",

    "school",

    "schools",

    "business",

    "businesses",

    "census"
];


// =============================================================================
// Public API
// =============================================================================

/**
 * Discover likely municipal political-boundary services from an
 * ArcGIS Server REST directory.
 *
 * Discovery is intentionally shallow:
 *
 *     server root
 *         ↓
 *     root services
 *         +
 *     first-level folders
 *         ↓
 *     services in those folders
 *
 * Nested folders are not recursively crawled.
 *
 * This function is a retrieval mechanism only. Returned services should
 * continue through the existing inspection, classification, validation,
 * and ranking pipeline.
 */
export async function discoverArcGISServer(
    serverRoot: string,
    place: CensusPlace
): Promise<ArcGISServerServiceResult[]> {

    const root =
        normalizeServerRoot(
            serverRoot
        );


    const discoveredServices =
        await fetchServerServices(
            root
        );


    const scoredServices =
        discoveredServices
            .map(
                service =>
                    scoreService(
                        service,
                        place
                    )
            )
            /*
             * Require at least some political-name evidence before a
             * service is allowed into the candidate set.
             *
             * A generic MapServer gets no score and therefore does not
             * proceed downstream.
             */
            .filter(
                service =>
                    service.score > 0
            )
            .sort(
                (a, b) =>
                    b.score - a.score ||
                    a.url.localeCompare(
                        b.url
                    )
            )
            .slice(
                0,
                MAX_SERVER_CANDIDATES
            );

    console.log(
        `DEBUG server ${root}: ` +
        `discovered=${discoveredServices.length}, ` +
        `scored=${scoredServices.length}`
    );

    for (
        const service of scoredServices
    ) {

        console.log(
            `DEBUG server candidate: ` +
            `${service.score} ` +
            `${service.name} ` +
            `${service.url}`
        );
    }

    return deduplicateServices(
        scoredServices
    );
}


// =============================================================================
// Server enumeration
// =============================================================================

async function fetchServerServices(
    serverRoot: string
): Promise<ArcGISServerServiceResult[]> {

    const response =
        await fetchJson(
            serverRoot
        );


    const results:
        ArcGISServerServiceResult[] = [];


    // -------------------------------------------------------------------------
    // Root-level services
    // -------------------------------------------------------------------------

    const services =
        isArray(
            response.services
        )
            ? response.services
            : [];

    for (
        const rawService of services
    ) {

        const service =
            normalizeService(
                rawService
            );


        if (
            !service
        ) {

            continue;
        }


        results.push(
            createServiceResult(
                serverRoot,
                service.name,
                service.type
            )
        );
    }


    // -------------------------------------------------------------------------
    // First-level folders
    // -------------------------------------------------------------------------

    const folders =
        isStringArray(
            response.folders
        )
            ? response.folders
            : [];


    /*
     * Query first-level folders concurrently. We intentionally do not
     * recurse into nested folders.
     */
    const folderResults =
        await Promise.all(
            folders.map(
                folder =>
                    fetchServerFolder(
                        serverRoot,
                        folder
                    )
            )
        );


    for (
        const folderServices of folderResults
    ) {

        results.push(
            ...folderServices
        );
    }


    return results;
}


// =============================================================================
// First-level folder enumeration
// =============================================================================

async function fetchServerFolder(
    serverRoot: string,
    folder: string
): Promise<ArcGISServerServiceResult[]> {

    const folderUrl =
        joinUrlPath(
            serverRoot,
            folder
        );


    let response:
        ArcGISServerDirectoryResponse;


    try {

        response =
            await fetchJson(
                folderUrl
            );

    } catch {

        return [];
    }


    const services =
        isArray(
            response.services
        )
            ? response.services
            : [];


    const results:
        ArcGISServerServiceResult[] = [];


    for (
        const rawService of services
    ) {

        const service =
            normalizeService(
                rawService
            );


        if (
            !service
        ) {

            continue;
        }


        /*
         * The folder URL already contains the folder path.
         *
         * We therefore only append the service name and service type
         * here. This prevents paths such as:
         *
         *     /Public/Public/Council_Districts
         */
        const serviceName =
            stripFolderPrefix(
                service.name,
                folder
            );


        const url =
            joinUrlPath(
                folderUrl,
                serviceName,
                service.type
            );


        results.push({

            name:
                `${folder}/${serviceName}`,

            type:
                service.type,

            url,

            score: 0,

            reasons: []
        });
    }


    return results;
}


// =============================================================================
// Service construction
// =============================================================================

function createServiceResult(
    serverRoot: string,
    serviceName: string,
    type:
        | "MapServer"
        | "FeatureServer"
): ArcGISServerServiceResult {

    const url =
        joinUrlPath(
            serverRoot,
            serviceName,
            type
        );


    return {

        name:
            serviceName,

        type,

        url,

        score: 0,

        reasons: []
    };
}


// =============================================================================
// Service scoring
// =============================================================================

function scoreService(
    service: ArcGISServerServiceResult,
    place: CensusPlace
): ArcGISServerServiceResult {

    const serviceName =
        normalizeForMatching(
            service.name
        );


    const cityName =
        normalizeForMatching(
            place.city
        );


    let score = 0;

    const reasons:
        string[] = [];


    // -------------------------------------------------------------------------
    // Municipality name
    // -------------------------------------------------------------------------

    if (
        cityName.length > 0 &&
        serviceName.includes(
            cityName
        )
    ) {

        score += 20;

        reasons.push(
            "municipality name in service name"
        );
    }


    // -------------------------------------------------------------------------
    // Strong exact political service names
    // -------------------------------------------------------------------------

    if (
        serviceName.includes(
            "council_districts"
        )
    ) {

        score += 60;

        reasons.push(
            "strong council-district service name"
        );
    }


    if (
        serviceName.includes(
            "council_district"
        ) &&
        !serviceName.includes(
            "council_districts"
        )
    ) {

        score += 50;

        reasons.push(
            "council-district service name"
        );
    }


    if (
        serviceName.includes(
            "ward_boundaries"
        )
    ) {

        score += 60;

        reasons.push(
            "strong ward-boundary service name"
        );
    }


    if (
        serviceName.includes(
            "ward_boundary"
        ) &&
        !serviceName.includes(
            "ward_boundaries"
        )
    ) {

        score += 50;

        reasons.push(
            "ward-boundary service name"
        );
    }


    // -------------------------------------------------------------------------
    // General political terms
    // -------------------------------------------------------------------------

    for (
        const term of POLITICAL_SERVICE_TERMS
    ) {

        /*
         * The strong exact patterns above already received their
         * specialized score. Avoid double-counting those exact terms.
         */
        if (
            isStrongPoliticalTerm(
                term
            )
        ) {

            continue;
        }


        if (
            serviceName.includes(
                term
            )
        ) {

            score +=
                getPoliticalTermScore(
                    term
                );


            reasons.push(
                `political term: ${term}`
            );
        }
    }


    // -------------------------------------------------------------------------
    // Negative thematic terms
    // -------------------------------------------------------------------------

    for (
        const term of NEGATIVE_SERVICE_TERMS
    ) {

        if (
            serviceName.includes(
                term
            )
        ) {

            score -= 25;

            reasons.push(
                `negative term: ${term}`
            );
        }
    }


    return {

        ...service,

        score,

        reasons
    };
}


function isStrongPoliticalTerm(
    term: string
): boolean {

    return (
        term === "council_districts" ||
        term === "council_district" ||
        term === "ward_boundaries" ||
        term === "ward_boundary"
    );
}


function getPoliticalTermScore(
    term: string
): number {

    switch (
        term
    ) {

        case "aldermanic_districts":
        case "aldermanic_district":
        case "alderman_districts":
        case "alderman_district":
            return 15;

        case "municipal_districts":
        case "municipal_district":
            return 12;

        case "political_boundaries":
        case "political_boundary":
            return 12;

        case "wards":
        case "ward":
            return 10;

        case "council":
            return 6;

        case "districts":
        case "district":
            return 5;

        default:
            return 0;
    }
}


// =============================================================================
// Deduplication
// =============================================================================

function deduplicateServices(
    services: ArcGISServerServiceResult[]
): ArcGISServerServiceResult[] {

    const byUrl =
        new Map<
            string,
            ArcGISServerServiceResult
        >();


    for (
        const service of services
    ) {

        const key =
            normalizeUrl(
                service.url
            );


        const existing =
            byUrl.get(
                key
            );


        if (
            !existing
        ) {

            byUrl.set(
                key,
                {
                    ...service,
                    reasons: [
                        ...service.reasons
                    ]
                }
            );

            continue;
        }


        if (
            service.score >
            existing.score
        ) {

            byUrl.set(
                key,
                {
                    ...service,
                    reasons: [
                        ...new Set([
                            ...existing.reasons,
                            ...service.reasons
                        ])
                    ]
                }
            );

        } else {

            existing.reasons =
                Array.from(
                    new Set([
                        ...existing.reasons,
                        ...service.reasons
                    ])
                );
        }
    }


    return Array.from(
        byUrl.values()
    ).sort(
        (a, b) =>
            b.score - a.score ||
            a.url.localeCompare(
                b.url
            )
    );
}


// =============================================================================
// HTTP
// =============================================================================


async function fetchJson(
    url: string
): Promise<ArcGISServerDirectoryResponse> {

    const controller =
        new AbortController();


    const timeout =
        setTimeout(
            () =>
                controller.abort(),
            SERVER_REQUEST_TIMEOUT_MS
        );


    try {

        const response =
            await fetch(
                buildJsonUrl(
                    url
                ),
                {
                    signal:
                        controller.signal
                }
            );


        if (
            !response.ok
        ) {

            throw new Error(
                `ArcGIS Server request failed ` +
                `(${response.status} ${response.statusText}): ${url}`
            );
        }


        const data:
            unknown =
            await response.json();


        if (
            !isRecord(
                data
            )
        ) {

            throw new Error(
                `ArcGIS Server returned invalid JSON: ${url}`
            );
        }


        return data;

    } finally {

        clearTimeout(
            timeout
        );
    }
}


function buildJsonUrl(
    url: string
): string {

    const separator =
        url.includes("?")
            ? "&"
            : "?";


    return (
        `${url}${separator}f=json`
    );
}


// =============================================================================
// URL helpers
// =============================================================================

function normalizeServerRoot(
    url: string
): string {

    return url
        .trim()
        .replace(
            /\/+$/,
            ""
        )
        .replace(
            /\/(?:MapServer|FeatureServer)(?:\/\d+)?$/i,
            ""
        );
}


function joinUrlPath(
    ...parts: string[]
): string {

    return parts
        .map(
            part =>
                part
                    .trim()
                    .replace(
                        /^\/+/,
                        ""
                    )
                    .replace(
                        /\/+$/,
                        ""
                    )
        )
        .filter(
            part =>
                part.length > 0
        )
        .join("/");
}


function stripFolderPrefix(
    serviceName: string,
    folder: string
): string {

    const normalizedService =
        serviceName
            .trim()
            .replace(
                /^\/+|\/+$/g,
                ""
            );


    const normalizedFolder =
        folder
            .trim()
            .replace(
                /^\/+|\/+$/g,
                ""
            );


    const prefix =
        `${normalizedFolder}/`;


    if (
        normalizedService
            .toLowerCase()
            .startsWith(
                prefix.toLowerCase()
            )
    ) {

        return normalizedService.slice(
            prefix.length
        );
    }


    return normalizedService;
}


function normalizeUrl(
    url: string
): string {

    return url
        .trim()
        .replace(
            /\/+$/,
            ""
        )
        .toLowerCase();
}


function normalizeForMatching(
    value: string
): string {

    return value
        .toLowerCase()
        .trim()
        .replace(
            /[\s-]+/g,
            "_"
        )
        .replace(
            /[^a-z0-9_]/g,
            ""
        );
}


function encodeServiceName(
    value: string
): string {

    return value
        .split("/")
        .map(
            part =>
                encodeURIComponent(
                    part
                )
        )
        .join("/");
}

// =============================================================================
// Service normalization
// =============================================================================

function normalizeService(
    value: unknown
): {
    name: string;
    type:
        | "MapServer"
        | "FeatureServer";
} | undefined {

    if (
        !isRecord(
            value
        )
    ) {

        return undefined;
    }


    const name =
        typeof value.name === "string"
            ? value.name.trim()
            : "";


    const type =
        value.type;


    if (
        name.length === 0
    ) {

        return undefined;
    }


    if (
        type !== "MapServer" &&
        type !== "FeatureServer"
    ) {

        return undefined;
    }


    return {
        name,
        type
    };
}


// =============================================================================
// Type guards
// =============================================================================

function isRecord(
    value: unknown
): value is Record<string, unknown> {

    return (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(
            value
        )
    );
}


function isArray(
    value: unknown
): value is unknown[] {

    return Array.isArray(
        value
    );
}


function isStringArray(
    value: unknown
): value is string[] {

    return (
        Array.isArray(
            value
        ) &&
        value.every(
            item =>
                typeof item === "string"
        )
    );
}