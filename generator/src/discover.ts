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
// Main discovery pipeline
// =============================================================================

/**
 * Discover municipal political district sources.
 *
 * Pipeline:
 *
 *     Census places
 *          ↓
 *     ArcGIS search
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


    if (options.verbose) {

        console.log(
            `    Relevant search candidates: ` +
            `${searchCandidates.length}`
        );
    }


    // =========================================================================
    // 2. Resolve ArcGIS item metadata
    // =========================================================================

    const resolvedCandidates:
        DiscoveryCandidate[] = [];


    for (
        const candidate of searchCandidates
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
// ArcGIS search
// =============================================================================

async function searchMunicipalArcGIS(
    place: CensusPlace,
    options: DiscoverOptions
): Promise<DiscoveryCandidate[]> {

    const queries = [

        `"${place.city}" ${place.state} city council districts`,
        `"${place.city}" ${place.state} city council district boundaries`,
        `"${place.city}" ${place.state} council district map`,
        `"${place.city}" ${place.state} council districts map`,
        `"${place.city}" ${place.state} council wards`,
        `"${place.city}" ${place.state} city wards`,

        `"${place.city}" ${place.state} ward boundaries`,
        `"${place.city}" ${place.state} ward boundary`,
        `"${place.city}" ${place.state} ward map`,
        `"${place.city}" ${place.state} wards`,
        `"${place.city}" ${place.state} municipal wards`,
        `"${place.city}" ${place.state} electoral wards`,

        `"${place.city}" ${place.state} municipal districts`,
        `"${place.city}" ${place.state} municipal district boundaries`,
        `"${place.city}" ${place.state} political districts`,
        `"${place.city}" ${place.state} political district boundaries`,

        `"${place.city}" ${place.state} election districts`,
        `"${place.city}" ${place.state} electoral districts`,
        `"${place.city}" ${place.state} voting districts`,

        `"${place.city}" ${place.state} official GIS wards`,
        `"${place.city}" ${place.state} official GIS council districts`,
        `"${place.city}" ${place.state} GIS ward boundaries`,
        `"${place.city}" ${place.state} GIS council boundaries`,
        `"${place.city}" ${place.state} GIS political boundaries`,

        `"${place.city}" ${place.state} WARD_COT`,
        `"${place.city}" ${place.state} WARDS`,
        `"${place.city}" ${place.state} WARD_BOUNDARIES`,
        `"${place.city}" ${place.state} COUNCIL_DISTRICT`,
        `"${place.city}" ${place.state} COUNCIL_DISTRICTS`,
        `"${place.city}" ${place.state} POLITICAL_BOUNDARIES`
    ];


    const discovered:
        DiscoveryCandidate[] = [];

    let searchResultCount = 0;
    let relevantResultCount = 0;
    let rejectedResultCount = 0;


    for (
        const query of queries
    ) {

        if (options.verbose) {

            console.log(
                `    Searching: "${query}"`
            );
        }


        try {

            const searchResults =
                await searchArcGIS(
                    query
                );


            searchResultCount +=
                searchResults.length;


            for (
                const result of searchResults
            ) {

                if (!result.id) {
                    continue;
                }


                const relevance =
                    scoreSearchResult(
                        result,
                        place
                    );


                if (
                    options.verbose
                ) {

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

                        `search query: ${query}`,

                        ...relevance.reasons
                    ],

                    source:
                        "arcgis",

                    searchQuery:
                        query
                });
            }

        } catch (error) {

            if (options.verbose) {

                console.warn(
                    `    Search failed: "${query}"`
                );

                console.warn(
                    error
                );
            }
        }
    }


    const deduplicated =
        deduplicateSearchCandidates(
            discovered
        );


    if (options.verbose) {

        console.log(
            `    ArcGIS search results: ${searchResultCount}`
        );

        console.log(
            `    Relevant results: ${relevantResultCount}`
        );

        console.log(
            `    Rejected results: ${rejectedResultCount}`
        );

        console.log(
            `    Unique relevant candidates: ${deduplicated.length}`
        );
    }


    return deduplicated;
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
        !/\/(?:FeatureServer|MapServer)$/i.test(
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
            const layer of layers
        ) {

            if (!isRecord(layer)) {
                continue;
            }


            const id =
                typeof layer.id === "number"
                    ? layer.id
                    : undefined;


            if (id === undefined) {
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
        const candidate of candidates
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
        const candidate of candidates
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