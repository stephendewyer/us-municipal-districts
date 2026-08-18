// generator/src/discover.ts

import type {
    ArcGISInspection,
    CensusPlace,
    DiscoveryCandidate,
    DiscoveryResult,
    InspectedCandidate,
    CandidateScore,
    EquivalentLayerGroup,
    CanonicalSource
} from "./types.js";

import {
    loadCensusPlaces
} from "./generateCensusPlaces.js";

import {
    searchArcGIS
} from "./searchArcGIS.js";

import {
    inspectArcGIS
} from "./inspectArcGIS.js";

import {
    classifyCandidate
} from "./classify.js";

import {
    detectEquivalentLayers
} from "./equivalence.js";

import {
    scoreCandidate,
    selectMunicipalityCanonicalSource
} from "./canonical.js";


// =============================================================================
// Options
// =============================================================================

export interface DiscoverOptions {

    city?: string;

    state?: string;

    placeFips?: string;

    review?: boolean;

    verbose?: boolean;
}


// =============================================================================
// Main discovery pipeline
// =============================================================================

/**
 * Discover municipal political district sources.
 *
 * The pipeline produces exactly one DiscoveryResult for each
 * Census municipality.
 *
 * Pipeline:
 *
 * Census places
 *      ↓
 * ArcGIS search
 *      ↓
 * ArcGIS inspection
 *      ↓
 * classification
 *      ↓
 * valid/rejected candidates
 *      ↓
 * candidate scoring
 *      ↓
 * equivalence detection
 *      ↓
 * canonical selection
 *      ↓
 * DiscoveryResult
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
    // 1. Search ArcGIS
    // =========================================================================

    const candidates =
        await searchMunicipalArcGIS(
            place,
            options
        );


    // =========================================================================
    // 2. Inspect and classify
    // =========================================================================

    const inspectedCandidates:
        InspectedCandidate[] = [];

    for (
        const candidate of candidates
    ) {

        try {

            const inspection =
                await inspectArcGIS(
                    candidate.url
                );

            if (options.verbose) {

                printInspection(
                    inspection
                );
            }


            // -----------------------------------------------------------------
            // Classification
            // -----------------------------------------------------------------

            const classification =
                classifyCandidate(
                    candidate,
                    inspection
                );


            const inspectedCandidate:
                InspectedCandidate = {

                    candidate,

                    inspection,

                    classification
                };


            inspectedCandidates.push(
                inspectedCandidate
            );

        } catch (error) {

            if (options.verbose) {

                console.warn(
                    `\n  Failed to inspect:`
                );

                console.warn(
                    `    ${candidate.url}`
                );

                console.warn(
                    error
                );
            }
        }
    }


    // =========================================================================
    // 3. Separate valid and rejected candidates
    // =========================================================================

    const validCandidates =
        inspectedCandidates.filter(
            candidate =>
                !candidate.classification.rejected
        );

    const rejectedCandidates =
        inspectedCandidates.filter(
            candidate =>
                candidate.classification.rejected
        );


    // =========================================================================
    // 4. Rank valid candidates
    // =========================================================================

    const rankedCandidates:
        CandidateScore[] =
        validCandidates
            .map(
                candidate =>
                    scoreCandidate(
                        candidate
                    )
            )
            .sort(
                compareCandidateScores
            );


    // =========================================================================
    // 5. Detect equivalent layers
    // =========================================================================

    const equivalentGroups:
        EquivalentLayerGroup[] =
        detectEquivalentLayers(
            validCandidates
        );


    // =========================================================================
    // 6. Select canonical source
    // =========================================================================

    const canonical:
        CanonicalSource | undefined =
        selectMunicipalityCanonicalSource(
            equivalentGroups
        );


    // =========================================================================
    // 7. Verbose output
    // =========================================================================

    if (options.verbose) {

        printMunicipalitySummary(
            place,
            candidates,
            inspectedCandidates,
            validCandidates,
            rejectedCandidates,
            rankedCandidates,
            equivalentGroups,
            canonical
        );
    }


    // =========================================================================
    // 8. Return municipality result
    // =========================================================================

    return {

        place,

        candidates,

        inspectedCandidates,

        validCandidates,

        rankedCandidates,

        rejectedCandidates,

        equivalentGroups,

        canonical
    };
}


// =============================================================================
// ArcGIS search
// =============================================================================

async function searchMunicipalArcGIS(
    place: CensusPlace,
    options: DiscoverOptions
): Promise<DiscoveryCandidate[]> {

    /*
     * ArcGIS metadata is inconsistent between municipalities,
     * so use several search formulations.
     */

    const queries = [

        `"${place.city}" ${place.state} council districts`,

        `"${place.city}" ${place.state} city council`,

        `"${place.city}" ${place.state} wards`,

        `"${place.city}" ${place.state} ward boundaries`,

        `"${place.city}" ${place.state} council district boundaries`,

        `"${place.city}" ${place.state} municipal districts`
    ];


    const discovered:
        DiscoveryCandidate[] = [];


    for (
        const query of queries
    ) {

        if (options.verbose) {

            console.log(
                `  Searching: "${query}"`
            );
        }

        try {

            const searchResults =
                await searchArcGIS(
                    query
                );


            for (
                const result of searchResults
            ) {

                if (!result.url) {
                    continue;
                }


                discovered.push({

                    placeFips:
                        place.placeFips,

                    city:
                        place.city,

                    state:
                        place.state,

                    url:
                        result.url,

                    title:
                        result.title,

                    score:
                        0,

                    requiresReview:
                        false,

                    reasons: [
                        `search query: ${query}`
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
                    `  Search failed: "${query}"`
                );

                console.warn(
                    error
                );
            }
        }
    }


    // =========================================================================
    // Deduplicate search results by URL
    // =========================================================================

    const unique =
        new Map<
            string,
            DiscoveryCandidate
        >();


    for (
        const candidate of discovered
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


        /*
         * The same ArcGIS layer may have appeared in multiple
         * search queries. Preserve all search evidence.
         */

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


    // =========================================================================
    // Filter by FIPS
    // =========================================================================

    if (options.placeFips) {

        places =
            places.filter(
                place =>
                    place.placeFips ===
                    options.placeFips
            );
    }


    // =========================================================================
    // Filter by city
    // =========================================================================

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


    // =========================================================================
    // Filter by state
    // =========================================================================

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

        canonical: undefined,

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
                url
            );

        parsed.hash = "";

        parsed.search = "";

        return parsed
            .toString()
            .replace(
                /\/+$/,
                ""
            )
            .toLowerCase();

    } catch {

        return url
            .trim()
            .replace(
                /\/+$/,
                ""
            )
            .toLowerCase();
    }
}


// =============================================================================
// Candidate ranking
// =============================================================================

function compareCandidateScores(
    a: CandidateScore,
    b: CandidateScore
): number {

    if (
        b.score !==
        a.score
    ) {

        return b.score -
            a.score;
    }


    const titleA =
        a.candidate.inspection.title ??
        a.candidate.candidate.title ??
        "";

    const titleB =
        b.candidate.inspection.title ??
        b.candidate.candidate.title ??
        "";


    return titleA.localeCompare(
        titleB
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
// Inspection output
// =============================================================================

function printInspection(
    inspection: ArcGISInspection
): void {

    console.log(
        `\n  Inspected: ${
            inspection.title ??
            inspection.layerName ??
            inspection.serviceName ??
            "(untitled)"
        }`
    );


    console.log(
        `    URL: ${inspection.url}`
    );


    console.log(
        `    Service: ${inspection.serviceType}`
    );


    console.log(
        `    Layer: ${inspection.isLayer}`
    );


    console.log(
        `    Geometry: ${
            inspection.geometryType ??
            "unknown"
        }`
    );


    console.log(
        `    District fields: ${
            inspection.districtFields.length
                ? inspection.districtFields.join(", ")
                : "(none)"
        }`
    );


    console.log(
        `    Name fields: ${
            inspection.nameFields.length
                ? inspection.nameFields.join(", ")
                : "(none)"
        }`
    );
}


// =============================================================================
// Municipality summary
// =============================================================================

function printMunicipalitySummary(
    place: CensusPlace,
    candidates: DiscoveryCandidate[],
    inspectedCandidates: InspectedCandidate[],
    validCandidates: InspectedCandidate[],
    rejectedCandidates: InspectedCandidate[],
    rankedCandidates: CandidateScore[],
    equivalentGroups: EquivalentLayerGroup[],
    canonical: CanonicalSource | undefined
): void {

    console.log(
        `\n  ${place.city}, ${place.state}`
    );


    console.log(
        `    Search candidates: ${candidates.length}`
    );


    console.log(
        `    Inspected: ${inspectedCandidates.length}`
    );


    console.log(
        `    Valid: ${validCandidates.length}`
    );


    console.log(
        `    Rejected: ${rejectedCandidates.length}`
    );


    console.log(
        `    Equivalent groups: ${equivalentGroups.length}`
    );


    // =========================================================================
    // Top candidates
    // =========================================================================

    if (
        rankedCandidates.length > 0
    ) {

        console.log(
            `\n    Top candidates:`
        );


        for (
            const ranked of
            rankedCandidates.slice(
                0,
                5
            )
        ) {

            const title =
                ranked.candidate.inspection.title ??
                ranked.candidate.candidate.title ??
                "(untitled)";


            console.log(
                `      ${ranked.score.toFixed(3)} — ${title}`
            );


            if (
                optionsHasReasons(
                    ranked.reasons
                )
            ) {

                console.log(
                    `        ${ranked.reasons.join("; ")}`
                );
            }
        }
    }


    // =========================================================================
    // Canonical source
    // =========================================================================

    if (canonical) {

        console.log(
            `\n    CANONICAL:`
        );


        console.log(
            `      ${canonical.score.toFixed(3)} — ${canonical.title}`
        );


        console.log(
            `      ${canonical.url}`
        );


        console.log(
            `      District type: ${canonical.districtType}`
        );


        console.log(
            `      District field: ${canonical.districtField}`
        );


        console.log(
            `      Requires review: ${canonical.requiresReview}`
        );

    } else {

        console.log(
            `\n    CANONICAL: none`
        );
    }
}


// =============================================================================
// Utility
// =============================================================================

function optionsHasReasons(
    reasons: string[]
): boolean {

    return reasons.length > 0;
}