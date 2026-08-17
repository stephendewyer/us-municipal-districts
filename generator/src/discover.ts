import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
    loadCensusPlaces
} from "./censusPlaces.js";

import {
    inspectArcGIS
} from "./inspectArcGIS.js";

import {
    classifyCandidate
} from "./classify.js";

import type {
    CensusPlace,
    DiscoveryCandidate,
    DiscoveryResult,
    InspectedCandidate,
    GeneratorOptions
} from "./types.js";


// =============================================================================
// Configuration
// =============================================================================

const ARC_GIS_SEARCH_URL =
    "https://www.arcgis.com/sharing/rest/search";

const MAX_RESULTS_PER_QUERY = 20;

const REQUEST_DELAY_MS = 250;


// =============================================================================
// Paths
// =============================================================================

const __filename =
    fileURLToPath(import.meta.url);

const __dirname =
    path.dirname(__filename);

const OUTPUT_DIR =
    path.resolve(
        __dirname,
        "../output/discoveries"
    );


// =============================================================================
// Public API
// =============================================================================

function filterPlaces(
    places: CensusPlace[],
    options: GeneratorOptions
): CensusPlace[] {

    let filtered =
        places;

    if (options.placeFips) {

        filtered =
            filtered.filter(
                place =>
                    place.placeFips ===
                    options.placeFips
            );
    }

    if (options.state) {

        const state =
            options.state.toUpperCase();

        filtered =
            filtered.filter(
                place =>
                    place.state.toUpperCase() ===
                    state
            );
    }

    if (options.city) {

        const city =
            options.city.trim().toLowerCase();

        filtered =
            filtered.filter(
                place =>
                    place.city
                        .toLowerCase() ===
                    city
            );
    }

    return filtered;
}

export async function discoverArcGIS(
    options: GeneratorOptions = {}
): Promise<void> {

    console.log(
        "\nDiscovering municipal ArcGIS sources...\n"
    );

    let places =
        loadCensusPlaces();

    places =
        filterPlaces(
            places,
            options
        );

    if (places.length === 0) {

        throw new Error(
            [
                "No Census places matched the requested filters.",
                "",
                `city: ${options.city ?? "(any)"}`,
                `state: ${options.state ?? "(any)"}`,
                `placeFips: ${options.placeFips ?? "(any)"}`
            ].join("\n")
        );
    }

    console.log(
        `Loaded ${places.length} Census places.`
    );

    ensureOutputDirectory();

    let processed = 0;

    for (const place of places) {

        try {

            const result =
                await discoverForPlace(place);

            writeDiscoveryResult(result);

            processed++;

            console.log(
                `[${processed}/${places.length}] ` +
                `${place.city}, ${place.state} ` +
                `(${result.candidates.length} candidates)`
            );

        } catch (error) {

            console.error(
                `Failed to process ${place.city}, ${place.state}:`,
                error
            );
        }
    }

    console.log(
        `\nDiscovery complete. Processed ${processed} places.`
    );
}


// =============================================================================
// Discover a single municipality
// =============================================================================

async function discoverForPlace(
    place: CensusPlace
): Promise<DiscoveryResult> {

    const candidates =
        await discoverCandidates(place);

    const inspectedCandidates:
        InspectedCandidate[] = [];

    const rejectedCandidates:
        InspectedCandidate[] = [];

    const validCandidates:
        InspectedCandidate[] = [];

    for (const candidate of candidates) {

        try {

            const inspection =
                await inspectArcGIS(
                    candidate.candidateUrl
                );

            /*
             * Ignore URLs that turned out not to be ArcGIS.
             */
            if (!inspection.isArcGIS) {
                continue;
            }

            const classification =
                classifyCandidate(
                    candidate,
                    inspection
                );

            const inspected: InspectedCandidate = {
                candidate,
                inspection,
                classification
            };

            inspectedCandidates.push(
                inspected
            );

            if (classification.shouldReject) {

                rejectedCandidates.push(
                    inspected
                );

            } else {

                validCandidates.push(
                    inspected
                );
            }

        } catch (error) {

            console.warn(
                `Could not inspect ${candidate.candidateUrl}:`,
                error
            );
        }
    }

    return {
        place,

        candidates,

        inspectedCandidates,

        validCandidates,

        rejectedCandidates,

        equivalentGroups: []
    };
}


// =============================================================================
// Candidate discovery
// =============================================================================

async function discoverCandidates(
    place: CensusPlace
): Promise<DiscoveryCandidate[]> {

    const queries =
        createSearchQueries(place);

    const candidates =
        new Map<string, DiscoveryCandidate>();

    for (const query of queries) {

        console.log(
            `  Searching: ${query}`
        );

        try {

            const results =
                await searchArcGISOnline(
                    query
                );

            for (const result of results) {

                const candidateUrl =
                    extractArcGISUrl(
                        result
                    );

                if (!candidateUrl) {
                    continue;
                }

                const normalizedUrl =
                    normalizeUrl(
                        candidateUrl
                    );

                if (candidates.has(normalizedUrl)) {
                    continue;
                }

                candidates.set(
                    normalizedUrl,
                    {
                        placeFips: place.placeFips,

                        city: place.city,

                        state: place.state,

                        candidateUrl:
                            normalizedUrl,

                        title:
                            result.title,

                        score: 0,

                        requiresReview: true,

                        reasons: [],

                        source: "arcgis-online",

                        searchQuery: query
                    }
                );
            }

        } catch (error) {

            console.warn(
                `  Search failed for "${query}":`,
                error
            );
        }

        await delay(
            REQUEST_DELAY_MS
        );
    }

    return Array.from(
        candidates.values()
    );
}


// =============================================================================
// ArcGIS Online search
// =============================================================================

interface ArcGISSearchResult {

    id?: string;

    title?: string;

    type?: string;

    url?: string;

    owner?: string;

    description?: string;
}


interface ArcGISSearchResponse {

    total?: number;

    start?: number;

    num?: number;

    nextStart?: number;

    results?: ArcGISSearchResult[];
}


async function searchArcGISOnline(
    query: string
): Promise<ArcGISSearchResult[]> {

    const params =
        new URLSearchParams({
            q: query,

            num:
                String(
                    MAX_RESULTS_PER_QUERY
                ),

            start: "1",

            f: "json"
        });

    const response =
        await fetch(
            `${ARC_GIS_SEARCH_URL}?${params.toString()}`
        );

    if (!response.ok) {

        throw new Error(
            `ArcGIS search returned HTTP ${response.status}`
        );
    }

    const data =
        await response.json() as ArcGISSearchResponse;

    return data.results ?? [];
}


// =============================================================================
// Search queries
// =============================================================================

function createSearchQueries(
    place: CensusPlace
): string[] {

    const city =
        `"${place.city}"`;

    const state =
        place.state;

    return [
        `${city} ${state} council districts`,
        `${city} ${state} city council`,
        `${city} ${state} wards`,
        `${city} ${state} ward boundaries`,
        `${city} ${state} council district boundaries`,
        `${city} ${state} municipal districts`
    ];
}


// =============================================================================
// URL extraction
// =============================================================================

function extractArcGISUrl(
    result: ArcGISSearchResult
): string | undefined {

    if (!result.url) {
        return undefined;
    }

    const url =
        result.url.trim();

    if (
        !url.toLowerCase().includes(
            "/rest/services/"
        )
    ) {
        return undefined;
    }

    if (
        !url.toLowerCase().includes(
            "featureserver"
        ) &&
        !url.toLowerCase().includes(
            "mapserver"
        )
    ) {
        return undefined;
    }

    return url;
}


// =============================================================================
// URL normalization
// =============================================================================

function normalizeUrl(
    url: string
): string {

    return url
        .replace(/\/+$/, "")
        .replace(
            /\?[^/]*$/,
            ""
        );
}


// =============================================================================
// Output
// =============================================================================

function writeDiscoveryResult(
    result: DiscoveryResult
): void {

    const filename =
        `${result.place.placeFips}.json`;

    const outputPath =
        path.join(
            OUTPUT_DIR,
            filename
        );

    fs.writeFileSync(
        outputPath,
        JSON.stringify(
            result,
            null,
            2
        ) + "\n",
        "utf8"
    );
}


// =============================================================================
// Filesystem
// =============================================================================

function ensureOutputDirectory(): void {

    fs.mkdirSync(
        OUTPUT_DIR,
        {
            recursive: true
        }
    );
}


// =============================================================================
// Utilities
// =============================================================================

function delay(
    milliseconds: number
): Promise<void> {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                milliseconds
            )
    );
}