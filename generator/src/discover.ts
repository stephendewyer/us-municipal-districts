import {
    mkdir,
    readFile,
    stat,
    writeFile
} from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

import type {
    ArcGISItemResolution,
    ArcGISCandidateValidation,
    ArcGISInspection,
    CensusPlace,
    DiscoveryCandidate,
    DiscoveryResult,
    InspectedCandidate
} from "./types.js";

import {
    discoverArcGISServer,
    type ArcGISServerServiceResult
} from "./discoverArcGISServer.js";

import {
    validateMunicipalityGeography
} from "./validateMunicipalityGeography.js";

import {
    loadCensusPlaces
} from "./generateCensusPlaces.js";

import {
    searchArcGIS
} from "./searchArcGIS.js";

import {
    resolveArcGISItem
} from "./resolveArcGISItem.js";

import {
    inspectArcGIS
} from "./inspectArcGIS.js";

import {
    classifyCandidate
} from "./classify.js";

import {
    validateCandidate
} from "./validateCandidate.js";

import {
    buildDiscoveryResult
} from "./pipeline.js";

import {
    scoreSearchResult,
    SEARCH_RELEVANCE_THRESHOLD
} from "./searchRelevance.js";

import {
    validateMunicipality,
    MUNICIPALITY_VALIDATION_THRESHOLD
} from "./municipalityValidation.js";

import {
    queryArcGISLayerGeometry
} from "./queryArcGISLayerGeometry.js";


// =============================================================================
// Options
// =============================================================================

export interface DiscoverOptions {

    /**
     * Process only a specific city.
     */
    city?: string;

    /**
     * Process only a specific state.
     */
    state?: string;

    /**
     * Process a specific Census place FIPS.
     */
    placeFips?: string;

    /**
     * Require manual review before accepting a canonical source.
     */
    review?: boolean;

    /**
     * Print detailed discovery information.
     */
    verbose?: boolean;
}


// =============================================================================
// Search configuration
// =============================================================================

interface SearchTier {

    /**
     * Human-readable tier name.
     */
    name: string;

    /**
     * Search queries executed during this tier.
     */
    queries: string[];

    /**
     * Strongest search relevance score needed to stop searching.
     */
    stopScore: number;

    maxQueries: number;
}


/**
 * Maximum number of unique ArcGIS search candidates allowed to proceed
 * into ArcGIS item resolution.
 *
 * Keeping this bounded prevents a broad search tier from creating a large
 * downstream inspection workload.
 */
const MAX_SEARCH_CANDIDATES =
    20;
/**
 * Number of ArcGIS search results requested per query.
 *
 * The search stage only needs the highest-ranked results. Deeper filtering
 * happens later through inspection, municipality validation, geographic
 * validation, classification, and political-boundary validation.
 */
const SEARCH_RESULT_LIMIT =
    10;

const SEARCH_CACHE_DIR = path.resolve(
    process.cwd(),
    ".cache",
    "arcgis-search"
);

const SEARCH_CACHE_TTL_MS =
    7 * 24 * 60 * 60 * 1000;


// =============================================================================
// Main discovery pipeline
// =============================================================================

/**
 * Discover municipal political district sources.
 *
 * Pipeline:
 *
 *     Census places
 *          ↓
 *     tiered ArcGIS search
 *          ↓
 *     search relevance filtering
 *          ↓
 *     ArcGIS item resolution
 *          ↓
 *     service URL resolution
 *          ↓
 *     ArcGIS service expansion
 *          ↓
 *     layer deduplication
 *          ↓
 *     ArcGIS inspection
 *          ↓
 *     municipality metadata validation
 *          ↓
 *     classification
 *          ↓
 *     municipality geographic validation
 *          ↓
 *     political-boundary validation
 *          ↓
 *     pipeline ranking / canonical selection
 */
export async function discoverArcGIS(
    options: DiscoverOptions = {}
): Promise<DiscoveryResult[]> {

    const places =
        getCensusPlaces(
            options
        );

    const results:
        DiscoveryResult[] = [];


    for (
        let index = 0;
        index < places.length;
        index++
    ) {

        const place =
            places[index];

        if (!place) {
            continue;
        }


        log(
            options,
            `[${index + 1}/${places.length}] ` +
            `${place.city}, ${place.state}`
        );


        try {

            const result =
                await discoverMunicipality(
                    place,
                    options
                );

            results.push(
                result
            );

        } catch (error) {

            console.error(
                `\nFailed to process ` +
                `${place.city}, ${place.state}:`
            );

            console.error(
                error
            );


            results.push(
                createFailedDiscoveryResult(
                    place,
                    error
                )
            );
        }
    }


    return results;
}


// =============================================================================
// Discover one municipality
// =============================================================================

function isExternalArcGISServerRoot(
    root: string
): boolean {

    try {

        const url =
            new URL(
                root
            );

        const hostname =
            url.hostname.toLowerCase();


        /*
         * ArcGIS Online-hosted services are already covered by the
         * ArcGIS Online search pipeline. Do not crawl their REST
         * directories again.
         */
        if (
            hostname === "services.arcgis.com" ||
            hostname.endsWith(
                ".arcgis.com"
            )
        ) {

            return false;
        }


        return true;

    } catch {

        return false;
    }
}

async function discoverMunicipality(
    place: CensusPlace,
    options: DiscoverOptions
): Promise<DiscoveryResult> {


    // =========================================================================
    // 1. Search ArcGIS Online
    // =========================================================================

    const searchCandidates =
        await searchMunicipalArcGIS(
            place,
            options
        );


    // =========================================================================
    // 2. Discover ArcGIS Server roots from search results
    //
    // ArcGIS Online search does not always index services hosted directly
    // by municipal ArcGIS Server installations. The search results often
    // still contain URLs pointing to those servers, however.
    //
    // Example:
    //
    //     https://maps.phoenix.gov/pub/rest/services/Public/SomeLayer/MapServer/0
    //
    // becomes:
    //
    //     https://maps.phoenix.gov/pub/rest/services
    //
    // We then inspect that REST directory for additional services such as:
    //
    //     Public/Council_Districts/MapServer
    // =========================================================================

    const serverRoots =
        discoverArcGISServerRoots(
            searchCandidates
        )
        .filter(
            isExternalArcGISServerRoot
        );

    const serverCandidates:
        DiscoveryCandidate[] = [];


    for (
        const serverRoot of serverRoots
    ) {

        try {

            const services:
                ArcGISServerServiceResult[] =
                await discoverArcGISServer(
                    serverRoot,
                    place
                );


            for (
                const service of services
            ) {

                serverCandidates.push({

                    placeFips:
                        place.placeFips,

                    city:
                        place.city,

                    state:
                        place.state,

                    url:
                        service.url,

                    title:
                        service.name,

                    /*
                     * This is retrieval relevance, not the final
                     * candidate ranking score. The existing ranking
                     * pipeline remains responsible for final selection.
                     */
                    score:
                        service.score,

                    requiresReview:
                        false,

                    reasons: [
                        "ArcGIS Server discovery",
                        `server root: ${serverRoot}`,
                        ...service.reasons
                    ]
                });
            }


            if (
                options.verbose
            ) {

                console.log(
                    `    ArcGIS Server: ${serverRoot}`
                );

                console.log(
                    `      Services discovered: ` +
                    `${services.length}`
                );
            }

        } catch (error) {

            if (
                options.verbose
            ) {

                console.warn(
                    `    ArcGIS Server discovery failed:`
                );

                console.warn(
                    `      ${serverRoot}`
                );

                console.warn(
                    error
                );
            }
        }
    }


    // =========================================================================
    // 3. Merge ArcGIS Online and ArcGIS Server candidates
    // =========================================================================

    const allSearchCandidates =
        deduplicateSearchCandidates(
            [
                ...searchCandidates,
                ...serverCandidates
            ]
        );

    const prioritizedCandidates =
        allSearchCandidates
            .sort(
                (a, b) =>
                    b.score - a.score ||
                    a.url.localeCompare(
                        b.url
                    )
            )
            .slice(
                0,
                MAX_SEARCH_CANDIDATES
            );

    if (
        options.verbose
    ) {

        console.log(
            `    ArcGIS Online candidates: ` +
            `${searchCandidates.length}`
        );

        console.log(
            `    ArcGIS Server roots: ` +
            `${serverRoots.length}`
        );

        console.log(
            `    ArcGIS Server candidates: ` +
            `${serverCandidates.length}`
        );

        console.log(
            `    Combined unique candidates: ` +
            `${allSearchCandidates.length}`
        );
    }


    // =========================================================================
    // 2. Resolve ArcGIS item metadata
    // =========================================================================

    const resolvedCandidates:
        DiscoveryCandidate[] = [];


    for (
        const candidate of prioritizedCandidates
    ) {

        if (!candidate.itemId) {

            if (options.verbose) {

                console.warn(
                    `\n    Search result has no item ID:`
                );

                console.warn(
                    `      ${candidate.url}`
                );
            }


            resolvedCandidates.push(
                candidate
            );

            continue;
        }


        try {

            const item =
                await resolveArcGISItem(
                    candidate.itemId
                );


            if (options.verbose) {

                printItemResolution(
                    item
                );
            }


            const resolved =
                createResolvedCandidate(
                    candidate,
                    item
                );


            if (resolved) {

                resolvedCandidates.push(
                    resolved
                );
            }

        } catch (error) {

            if (options.verbose) {

                console.warn(
                    `\n    Failed to resolve ArcGIS item:`
                );

                console.warn(
                    `      Item ID: ${candidate.itemId}`
                );

                console.warn(
                    error
                );
            }
        }
    }


    // =========================================================================
    // 3. Expand FeatureServer / MapServer services
    // =========================================================================

    const expandedCandidates:
        DiscoveryCandidate[] = [];


    for (
        const candidate of resolvedCandidates
    ) {

        const expanded =
            await expandArcGISLayers(
                candidate
            );


        expandedCandidates.push(
            ...expanded
        );
    }


    // =========================================================================
    // 4. Deduplicate layer candidates
    // =========================================================================

    const layerCandidates =
        deduplicateCandidates(
            expandedCandidates
        );


    if (options.verbose) {

        console.log(
            `    Unique layer candidates: ` +
            `${layerCandidates.length}`
        );
    }


    // =========================================================================
    // 5. Inspect and validate candidates
    // =========================================================================

    const inspectedCandidates:
        InspectedCandidate[] = [];


    for (
        const candidate of layerCandidates
    ) {

        try {

            // -----------------------------------------------------------------
            // Inspect
            // -----------------------------------------------------------------

            const inspection:
                ArcGISInspection =
                await inspectArcGIS(
                    candidate.url
                );


            if (options.verbose) {

                printInspection(
                    inspection
                );
            }


            // -----------------------------------------------------------------
            // Classify
            // -----------------------------------------------------------------

            const classification =
                classifyCandidate(
                    {
                        ...candidate,

                        searchQuery:
                            undefined
                    },
                    inspection
                );


            if (options.verbose) {

                printClassification(
                    classification
                );
            }


            // -----------------------------------------------------------------
            // Municipality metadata validation
            // -----------------------------------------------------------------

            const municipalityValidation =
                validateMunicipality(
                    {
                        candidate,
                        inspection,
                        classification
                    },
                    place
                );


            if (options.verbose) {

                printMunicipalityValidation(
                    municipalityValidation
                );
            }


            /*
             * Reject candidates with insufficient municipality
             * metadata evidence before performing the more expensive
             * geometry query.
             */
            if (
                municipalityValidation.score <
                MUNICIPALITY_VALIDATION_THRESHOLD
            ) {

                if (options.verbose) {

                    console.log(
                        `      REJECTED: municipality validation ` +
                        `score ${municipalityValidation.score} ` +
                        `< threshold ` +
                        `${MUNICIPALITY_VALIDATION_THRESHOLD}`
                    );
                }


                continue;
            }


            // -----------------------------------------------------------------
            // Municipality geographic validation
            // -----------------------------------------------------------------

            /*
             * Geographic validation asks:
             *
             * "Do the geometries in this candidate layer actually
             * overlap and substantially cover the Census municipality?"
             *
             * queryArcGISLayerGeometry() returns:
             *
             *     {
             *         geometries: Polygon | MultiPolygon[]
             *     }
             *
             * It does NOT return a `features` property.
             */

            let municipalityGeographyValidation:
                Awaited<
                    ReturnType<
                        typeof validateMunicipalityGeography
                    >
                > |
                undefined;


            try {

                const geometryResult =
                    await queryArcGISLayerGeometry(
                        candidate.url
                    );


                if (!geometryResult.success) {

                    if (options.verbose) {

                        console.warn(
                            `      Geographic validation query failed:`
                        );

                        console.warn(
                            `      ${
                                geometryResult.error ??
                                "Unknown ArcGIS geometry query error."
                            }`
                        );
                    }

                } else if (
                    geometryResult.geometries.length === 0
                ) {

                    if (options.verbose) {

                        console.warn(
                            `      Geographic validation skipped: ` +
                            `no valid polygon geometries returned.`
                        );
                    }

                } else {

                    municipalityGeographyValidation =
                        await validateMunicipalityGeography(
                            geometryResult.geometries,
                            place
                        );


                    if (options.verbose) {

                        printMunicipalityGeographyValidation(
                            municipalityGeographyValidation
                        );
                    }
                }

            } catch (error) {

                /*
                 * Geographic validation is strong supporting evidence,
                 * but an ArcGIS query failure should not discard an
                 * otherwise valid candidate.
                 */

                if (options.verbose) {

                    console.warn(
                        `      Geographic validation failed:`
                    );

                    console.warn(
                        `      ${candidate.url}`
                    );

                    console.warn(
                        error
                    );
                }
            }


            // -----------------------------------------------------------------
            // Validate political boundary
            // -----------------------------------------------------------------

            let validation:
                ArcGISCandidateValidation |
                undefined;


            try {

                validation =
                    await validateCandidate(
                        candidate,
                        inspection,
                        classification
                    );

            } catch (error) {

                if (options.verbose) {

                    console.warn(
                        `\n    Validation failed:`
                    );

                    console.warn(
                        `      ${candidate.url}`
                    );

                    console.warn(
                        error
                    );
                }
            }


            // -----------------------------------------------------------------
            // Store inspected candidate
            // -----------------------------------------------------------------

            inspectedCandidates.push({

                candidate,

                inspection,

                classification,

                validation,

                municipalityValidation,

                municipalityGeographyValidation
            });

        } catch (error) {

            if (options.verbose) {

                console.warn(
                    `\n    Failed to inspect/classify/validate candidate:`
                );

                console.warn(
                    `      ${candidate.url}`
                );

                console.warn(
                    error
                );
            }
        }
    }


    // =========================================================================
    // 6. Build final DiscoveryResult
    // =========================================================================

    const result =
        buildDiscoveryResult(
            place,
            inspectedCandidates,
            {
                review:
                    options.review
            }
        );


    // =========================================================================
    // 7. Verbose summary
    // =========================================================================

    if (options.verbose) {

        printMunicipalitySummary(
            result
        );
    }


    return result;
}


// =============================================================================
// Tiered ArcGIS search
// =============================================================================

export function getSearchTiers(
    place: CensusPlace
): SearchTier[] {
    const city = place.city;
    const state = place.state;

    return [
        {
            name: "municipality-specific",
            queries: [
                `"${city}" ${state} ward boundaries`,
                `"${city}" ${state} city council districts`,
                `"${city}" ${state} council district boundaries`,
                `"${city}" ${state} city wards`,
                `"${city}" ${state} council wards`,
                `"${city}" ${state} political district boundaries`,
                `"${city}" ${state} municipal districts`
            ],
            stopScore: 60,
            maxQueries: 4
        },
        {
            name: "service-name",
            queries: [
                `${city} Ward_Boundaries`,
                `${city} Council_Districts`,
                `${city} WardBoundaries`,
                `${city} CouncilDistricts`,
                `${city} Wards`,
                `${city} Council_District`,
                `${city} CouncilDistrict`,
                `${city} Political_Boundaries`,
                `${city} Political_Districts`,
                `${city} Municipal_Districts`
            ],
            stopScore: 45,
            maxQueries: 4
        },
        {
            name: "municipality-gis",
            queries: [
                `"${city}" ${state} GIS wards`,
                `"${city}" ${state} GIS council`,
                `"${city}" ${state} GIS districts`,
                `"${city}" ${state} ArcGIS wards`,
                `"${city}" ${state} ArcGIS council`,
                `"${city}" ${state} GIS boundaries`,
                `"${city}" ${state} GIS political`,
                `"${city}" ${state} GIS municipal`
            ],
            stopScore: 35,
            maxQueries: 3
        },
        {
            name: "broad-political",
            queries: [
                `ward boundaries`,
                `council districts`,
                `city council districts`,
                `council district boundaries`,
                `municipal districts`,
                `municipal district boundaries`,
                `political district boundaries`
            ],
            stopScore: 30,
            maxQueries: 3
        }
    ];
}


// =============================================================================
// Execute tiered ArcGIS search
// =============================================================================

async function searchArcGISCached(
    query: string,
    limit: number,
    verbose = false
) {
    const cacheKey = createHash("sha256")
        .update(
            JSON.stringify({
                query,
                limit
            })
        )
        .digest("hex");

    const cachePath = path.join(
        SEARCH_CACHE_DIR,
        `${cacheKey}.json`
    );

    try {
        const fileStat = await stat(cachePath);

        if (
            Date.now() - fileStat.mtimeMs <
            SEARCH_CACHE_TTL_MS
        ) {
            if (verbose) {
                console.log(
                    `      Search cache: HIT "${query}"`
                );
            }

            return JSON.parse(
                await readFile(
                    cachePath,
                    "utf8"
                )
            );
        }
    } catch {
        // Cache miss.
    }

    if (verbose) {
        console.log(
            `      Search cache: MISS "${query}"`
        );
    }

    const results = await searchArcGIS(
        query,
        { limit }
    );

    await mkdir(
        SEARCH_CACHE_DIR,
        { recursive: true }
    );

    await writeFile(
        cachePath,
        JSON.stringify(results),
        "utf8"
    );

    return results;
}

async function searchMunicipalArcGIS(
    place: CensusPlace,
    options: DiscoverOptions
): Promise<DiscoveryCandidate[]> {

    const tiers =
        getSearchTiers(
            place
        );


    const discovered:
        DiscoveryCandidate[] = [];


    let searchResultCount =
        0;

    let relevantResultCount =
        0;

    let rejectedResultCount =
        0;


    for (
        const tier
        of tiers
    ) {

        if (options.verbose) {

            console.log(
                `    Search tier: ${tier.name}`
            );

            console.log(
                `    Queries available: ` +
                `${tier.queries.length}`
            );

            console.log(
                `    Queries allowed: ` +
                `${Math.min(
                    tier.maxQueries,
                    tier.queries.length
                )}`
            );
        }


        // ---------------------------------------------------------------------
        // Run a limited number of queries sequentially.
        //
        // Sequential execution allows the existing stop condition to prevent
        // unnecessary searches once enough strong candidates have been found.
        // ---------------------------------------------------------------------

        const queries =
            tier.queries.slice(
                0,
                tier.maxQueries
            );


        for (
            const query
            of queries
        ) {

            if (options.verbose) {

                console.log(
                    `      Searching: "${query}"`
                );
            }


            let results:
                Awaited<
                    ReturnType<
                        typeof searchArcGIS
                    >
                > = [];


            try {

                results =
                    await searchArcGISCached(
                        query,
                        SEARCH_RESULT_LIMIT,
                        options.verbose
                    );

            } catch (error) {

                if (options.verbose) {

                    console.warn(
                        `      Search failed: "${query}"`
                    );

                    console.warn(
                        error
                    );
                }
            }


            searchResultCount +=
                results.length;


            // -----------------------------------------------------------------
            // Score results from this query.
            // -----------------------------------------------------------------

            for (
                const result
                of results
            ) {

                if (!result.id) {
                    continue;
                }


                const relevance =
                    scoreSearchResult(
                        result,
                        place
                    );


                if (options.verbose) {

                    console.log(
                        `      Search relevance: ` +
                        `${relevance.score}`
                    );

                    console.log(
                        `      ${
                            relevance.likelyRelevant
                                ? "KEEP"
                                : "SKIP"
                        }: ${result.title}`
                    );

                    console.log(
                        `      ${
                            relevance.reasons.join("; ")
                        }`
                    );
                }


                if (
                    relevance.score <
                    SEARCH_RELEVANCE_THRESHOLD
                ) {

                    rejectedResultCount++;

                    continue;
                }


                relevantResultCount++;


                discovered.push({

                    itemId:
                        result.id,

                    placeFips:
                        place.placeFips,

                    city:
                        place.city,

                    state:
                        place.state,

                    url:
                        result.url ?? "",

                    title:
                        result.title,

                    score:
                        relevance.score,

                    requiresReview:
                        false,

                    reasons: [

                        `search tier: ${tier.name}`,

                        `search query: ${query}`,

                        ...relevance.reasons

                    ],

                    source:
                        "arcgis",

                    searchQuery:
                        query
                });
            }


            // -----------------------------------------------------------------
            // Deduplicate after each query.
            //
            // This allows the stop condition to respond immediately when a
            // query discovers strong candidates.
            // -----------------------------------------------------------------

            const currentCandidates =
                deduplicateSearchCandidates(
                    discovered
                );


            // -----------------------------------------------------------------
            // Identify strong candidates discovered so far.
            // -----------------------------------------------------------------

            const strongCandidateCount =
                currentCandidates.filter(
                    candidate =>
                        candidate.score >=
                        tier.stopScore
                ).length;


            if (
                strongCandidateCount >= 2
            ) {

                if (options.verbose) {

                    console.log(
                        `    Search stopping within tier: ` +
                        `${tier.name}`
                    );

                    console.log(
                        `    Strong candidates: ` +
                        `${strongCandidateCount}`
                    );

                    console.log(
                        `    Stopping after query: ` +
                        `"${query}"`
                    );
                }

                break;
            }
        }


        // ---------------------------------------------------------------------
        // Check whether this tier produced enough strong candidates to stop
        // the entire tiered search.
        //
        // This preserves your existing behavior.
        // ---------------------------------------------------------------------

        const tierCandidates =
            deduplicateSearchCandidates(
                discovered
            );


        const strongCandidateCount =
            tierCandidates.filter(
                candidate =>
                    candidate.score >=
                    tier.stopScore
            ).length;


        if (
            strongCandidateCount >= 2
        ) {

            if (options.verbose) {

                console.log(
                    `    Search stopping after tier: ` +
                    `${tier.name}`
                );
            }

            break;
        }
    }


    // =========================================================================
    // Final deduplication and candidate limit
    // =========================================================================

    const deduplicated =
        deduplicateSearchCandidates(
            discovered
        );


    /*
     * Sort candidates by search relevance before applying the maximum.
     *
     * This preserves the strongest candidates while preventing a broad
     * fallback search from flooding the downstream inspection pipeline.
     */
    deduplicated.sort(
        (
            a,
            b
        ) => {

            if (
                b.score !==
                a.score
            ) {

                return (
                    b.score -
                    a.score
                );
            }


            return (
                normalizeUrl(
                    a.url
                ).localeCompare(
                    normalizeUrl(
                        b.url
                    )
                )
            );
        }
    );


    const limited =
        deduplicated.slice(
            0,
            MAX_SEARCH_CANDIDATES
        );


    if (options.verbose) {

        console.log(
            `    ArcGIS search results: ` +
            `${searchResultCount}`
        );

        console.log(
            `    Relevant results: ` +
            `${relevantResultCount}`
        );

        console.log(
            `    Rejected results: ` +
            `${rejectedResultCount}`
        );

        console.log(
            `    Unique relevant candidates: ` +
            `${deduplicated.length}`
        );

        console.log(
            `    Candidates proceeding to inspection: ` +
            `${limited.length}`
        );
    }


    return limited;
}


// =============================================================================
// ArcGIS item resolution
// =============================================================================

function createResolvedCandidate(
    candidate: DiscoveryCandidate,
    item: ArcGISItemResolution
): DiscoveryCandidate | undefined {

    if (!item.url) {
        return undefined;
    }


    if (
        item.type !== "Feature Service" &&
        item.type !== "Map Service"
    ) {
        return undefined;
    }


    return {

        ...candidate,

        itemId:
            item.id,

        url:
            item.url,

        title:
            item.title ??
            candidate.title,

        reasons: [

            ...candidate.reasons,

            `resolved ArcGIS item: ${item.id}`,

            `item type: ${item.type}`
        ]
    };
}


// =============================================================================
// ArcGIS service expansion
// =============================================================================

async function expandArcGISLayers(
    candidate: DiscoveryCandidate
): Promise<DiscoveryCandidate[]> {

    const url =
        normalizeUrl(
            candidate.url
        );


    if (
        /\/(?:FeatureServer|MapServer)\/\d+$/i.test(
            url
        )
    ) {

        return [
            candidate
        ];
    }


    if (
        !/(?:\/FeatureServer|\/MapServer)$/i.test(
            url
        )
    ) {

        return [
            candidate
        ];
    }


    try {

        const metadataUrl =
            `${url}?f=json`;


        const response =
            await fetch(
                metadataUrl,
                {
                    headers: {
                        Accept:
                            "application/json"
                    }
                }
            );


        if (!response.ok) {

            return [];
        }


        const metadata:
            unknown =
            await response.json();


        if (!isRecord(metadata)) {

            return [];
        }


        if (
            typeof metadata.error === "object" &&
            metadata.error !== null
        ) {

            return [];
        }


        const layers =
            Array.isArray(
                metadata.layers
            )
                ? metadata.layers
                : [];


        const expanded:
            DiscoveryCandidate[] = [];


        for (
            const layer
            of layers
        ) {

            if (!isRecord(layer)) {
                continue;
            }


            const id =
                typeof layer.id === "number"
                    ? layer.id
                    : undefined;


            if (
                id === undefined
            ) {
                continue;
            }


            const title =
                typeof layer.name === "string" &&
                layer.name.trim().length > 0
                    ? layer.name
                    : candidate.title;


            expanded.push({

                ...candidate,

                url:
                    `${url}/${id}`,

                title,

                reasons: [

                    ...candidate.reasons,

                    `expanded from service: ${url}`,

                    `ArcGIS layer: ${id}`
                ]
            });
        }


        return expanded;

    } catch {

        return [];
    }
}


// =============================================================================
// Search candidate deduplication
// =============================================================================

function deduplicateSearchCandidates(
    candidates: DiscoveryCandidate[]
): DiscoveryCandidate[] {

    const unique =
        new Map<
            string,
            DiscoveryCandidate
        >();


    for (
        const candidate
        of candidates
    ) {

        const key =
            candidate.itemId ??
            normalizeUrl(
                candidate.url
            ).toLowerCase();


        const existing =
            unique.get(
                key
            );


        if (!existing) {

            unique.set(
                key,
                {
                    ...candidate,
                    reasons: [
                        ...candidate.reasons
                    ]
                }
            );

            continue;
        }


        /*
         * Preserve the highest observed relevance score for the candidate.
         */
        const previousScore =
            existing.score;

        existing.score =
            Math.max(
                existing.score,
                candidate.score
            );

        if (
            candidate.score >
            previousScore
        ) {

            existing.searchQuery =
                candidate.searchQuery;
        }

        existing.reasons = [

            ...new Set([

                ...existing.reasons,

                ...candidate.reasons
            ])
        ];
    }


    return [
        ...unique.values()
    ];
}


// =============================================================================
// Layer candidate deduplication
// =============================================================================

function deduplicateCandidates(
    candidates: DiscoveryCandidate[]
): DiscoveryCandidate[] {

    const unique =
        new Map<
            string,
            DiscoveryCandidate
        >();


    for (
        const candidate
        of candidates
    ) {

        const normalizedUrl =
            normalizeUrl(
                candidate.url
            );


        const existing =
            unique.get(
                normalizedUrl
            );


        if (!existing) {

            unique.set(
                normalizedUrl,
                candidate
            );

            continue;
        }


        existing.reasons = [

            ...new Set([

                ...existing.reasons,

                ...candidate.reasons
            ])
        ];
    }


    return [
        ...unique.values()
    ];
}


// =============================================================================
// Census places
// =============================================================================

function getCensusPlaces(
    options: DiscoverOptions
): CensusPlace[] {

    let places =
        loadCensusPlaces();


    if (options.placeFips) {

        places =
            places.filter(
                place =>
                    place.placeFips ===
                    options.placeFips
            );
    }


    if (options.city) {

        const city =
            options.city
                .trim()
                .toLowerCase();


        places =
            places.filter(
                place =>
                    place.city
                        .trim()
                        .toLowerCase() ===
                    city
            );
    }


    if (options.state) {

        const state =
            options.state
                .trim()
                .toUpperCase();


        places =
            places.filter(
                place =>
                    place.state
                        .toUpperCase() ===
                    state
            );
    }


    console.log(
        `Loaded ${places.length} Census places.`
    );


    return places;
}


// =============================================================================
// Failed municipality
// =============================================================================

function createFailedDiscoveryResult(
    place: CensusPlace,
    error: unknown
): DiscoveryResult {

    return {

        place,

        candidates: [],

        inspectedCandidates: [],

        validCandidates: [],

        rankedCandidates: [],

        rejectedCandidates: [],

        equivalentGroups: [],

        canonicalSources: [],

        canonical:
            undefined,

        error:
            error instanceof Error
                ? error.message
                : String(error)
    };
}


// =============================================================================
// URL normalization
// =============================================================================

function normalizeUrl(
    url: string
): string {

    try {

        const parsed =
            new URL(
                url.trim()
            );

        parsed.hash = "";

        parsed.search = "";

        parsed.hostname =
            parsed.hostname.toLowerCase();


        return parsed
            .toString()
            .replace(
                /\/+$/,
                ""
            );

    } catch {

        return url
            .trim()
            .replace(
                /\/+$/,
                ""
            );
    }
}


// =============================================================================
// Generic object guard
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
// Logging
// =============================================================================

function log(
    options: DiscoverOptions,
    message: string
): void {

    if (
        options.verbose ||
        message.startsWith("[")
    ) {

        console.log(
            message
        );
    }
}


// =============================================================================
// Verbose output helpers
// =============================================================================

function printItemResolution(
    item: ArcGISItemResolution
): void {

    console.log(
        `\n    Resolved ArcGIS item:`
    );

    console.log(
        `      ID: ${item.id}`
    );

    console.log(
        `      Title: ${
            item.title ??
            "(untitled)"
        }`
    );

    console.log(
        `      Type: ${item.type}`
    );

    console.log(
        `      URL: ${
            item.url ??
            "(none)"
        }`
    );

    if (item.owner) {

        console.log(
            `      Owner: ${item.owner}`
        );
    }
}


function printInspection(
    inspection: ArcGISInspection
): void {

    console.log(
        `\n    Inspected: ${
            inspection.title ??
            inspection.layerName ??
            inspection.serviceName ??
            "(untitled)"
        }`
    );

    console.log(
        `      URL: ${inspection.url}`
    );

    console.log(
        `      Service: ${inspection.serviceType}`
    );

    console.log(
        `      Layer: ${inspection.isLayer}`
    );

    console.log(
        `      Geometry: ${
            inspection.geometryType ??
            "unknown"
        }`
    );

    console.log(
        `      District fields: ${
            inspection.districtFields.length
                ? inspection.districtFields.join(", ")
                : "(none)"
        }`
    );

    console.log(
        `      Name fields: ${
            inspection.nameFields.length
                ? inspection.nameFields.join(", ")
                : "(none)"
        }`
    );
}


function printMunicipalityValidation(
    validation: ReturnType<typeof validateMunicipality>
): void {

    console.log(
        `      Municipality match: ${
            validation.likelyMunicipalityMatch
        }`
    );

    console.log(
        `      Municipality score: ${
            validation.score
        }`
    );

    if (
        validation.reasons.length > 0
    ) {

        console.log(
            `      Municipality evidence: ${
                validation.reasons.join("; ")
            }`
        );
    }
}


function printMunicipalityGeographyValidation(
    validation:
        Awaited<
            ReturnType<
                typeof validateMunicipalityGeography
            >
        >
): void {

    console.log(
        `      Geographic municipality match: ${
            validation.likelyMunicipalityMatch
        }`
    );

    console.log(
        `      Geographic status: ${
            validation.status
        }`
    );

    console.log(
        `      Geographic score: ${
            validation.score
        }`
    );

    console.log(
        `      Municipality coverage: ${
            (
                validation.coverageOfMunicipality *
                100
            ).toFixed(1)
        }%`
    );

    console.log(
        `      Candidate containment: ${
            (
                validation.candidateInsideMunicipality *
                100
            ).toFixed(1)
        }%`
    );

    if (
        validation.reasons.length > 0
    ) {

        console.log(
            `      Geographic evidence: ${
                validation.reasons.join("; ")
            }`
        );
    }
}


function printClassification(
    classification: ReturnType<typeof classifyCandidate>
): void {

    console.log(
        `      Political boundary: ${
            classification.isPoliticalBoundary
        }`
    );

    console.log(
        `      Boundary layer: ${
            classification.isBoundaryLayer
        }`
    );

    console.log(
        `      Thematic dataset: ${
            classification.isThematicDataset
        }`
    );

    console.log(
        `      District type: ${
            classification.districtType ??
            "(unknown)"
        }`
    );

    console.log(
        `      Official municipal source: ${
            classification.officialMunicipalSource
        }`
    );

    if (
        classification.rejectionReasons.length > 0
    ) {

        console.log(
            `      Rejection reasons: ${
                classification.rejectionReasons.join("; ")
            }`
        );
    }
}


// =============================================================================
// Municipality summary
// =============================================================================

function printMunicipalitySummary(
    result: DiscoveryResult
): void {

    const place =
        result.place;


    console.log(
        `\n    ${place.city}, ${place.state}`
    );

    console.log(
        `      Search/layer candidates: ${
            result.candidates.length
        }`
    );

    console.log(
        `      Inspected: ${
            result.inspectedCandidates.length
        }`
    );

    console.log(
        `      Valid: ${
            result.validCandidates.length
        }`
    );

    console.log(
        `      Rejected: ${
            result.rejectedCandidates.length
        }`
    );

    console.log(
        `      Equivalent groups: ${
            result.equivalentGroups.length
        }`
    );


    if (
        result.rankedCandidates.length > 0
    ) {

        console.log(
            `\n      Top candidates:`
        );


        for (
            const ranked of
            result.rankedCandidates.slice(0, 5)
        ) {

            const title =
                ranked.candidate.inspection.title ??
                ranked.candidate.candidate.title ??
                "(untitled)";


            console.log(
                `        ${ranked.score.toFixed(3)} — ${title}`
            );

            console.log(
                `          ${ranked.candidate.candidate.url}`
            );

            if (
                ranked.reasons.length > 0
            ) {

                console.log(
                    `          ${
                        ranked.reasons.join("; ")
                    }`
                );
            }
        }
    }


    if (
        result.canonical
    ) {

        console.log(
            `\n      CANONICAL:`
        );

        console.log(
            `        ${result.canonical.score.toFixed(3)} — ${
                result.canonical.title
            }`
        );

        console.log(
            `        ${result.canonical.url}`
        );

        console.log(
            `        District type: ${
                result.canonical.districtType
            }`
        );

        console.log(
            `        District field: ${
                result.canonical.districtField
            }`
        );

        console.log(
            `        Requires review: ${
                result.canonical.requiresReview
            }`
        );

    } else {

        console.log(
            `\n      CANONICAL: none`
        );
    }
}

function discoverArcGISServerRoots(
    candidates: DiscoveryCandidate[]
): string[] {

    const roots =
        new Set<string>();


    for (
        const candidate of candidates
    ) {

        const root =
            extractArcGISServerRoot(
                candidate.url
            );

        if (
            root
        ) {

            roots.add(
                root
            );
        }
    }


    return Array.from(
        roots
    ).sort();
}


function extractArcGISServerRoot(
    url: string
): string | undefined {

    let parsed: URL;

    try {

        parsed =
            new URL(
                url
            );

    } catch {

        return undefined;
    }


    const pathname =
        parsed.pathname;


    /*
     * We only want genuine ArcGIS Server REST service URLs.
     *
     * Examples:
     *
     *     /pub/rest/services/Public/Wards/MapServer
     *     /pub/rest/services/Public/Wards/MapServer/0
     *     /gis/rest/services/Wards/FeatureServer
     *
     * The server root ends immediately after /rest/services.
     */
    const match =
        pathname.match(
            /^(.*\/rest\/services)(?:\/.*)?$/i
        );


    if (
        !match ||
        !match[1]
    ) {

        return undefined;
    }


    return (
        `${parsed.protocol}//` +
        `${parsed.host}` +
        match[1]
    );
}