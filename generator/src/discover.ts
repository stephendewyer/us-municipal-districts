import fs from "node:fs/promises";
import path from "node:path";

import { fileURLToPath } from "node:url";

import { fetchPlaces } from "./censusPlaces.js";
import { inspectArcGIS } from "./inspectArcGIS.js";
import { scoreCandidate } from "./score.js";

import type {
    Place,
    DiscoveryRecord
} from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, "../data");

const PLACES_FILE = path.join(DATA_DIR, "places.json");
const DISCOVERIES_FILE = path.join(DATA_DIR, "discoveries.json");

const SEARCH_URL =
    "https://www.google.com/search?q=";


/**
 * A candidate GIS source discovered for a municipality.
 */
interface GISCandidate {
    title: string;
    url: string;
}


/**
 * Search the web for likely GIS boundary sources.
 *
 * This is intentionally simple for now. The goal is to produce
 * candidate URLs that can then be inspected and scored.
 */
async function searchCandidates(
    place: Place
): Promise<GISCandidate[]> {
    const queries = [
        `"${place.city}" "${place.state}" city council district GIS`,
        `"${place.city}" "${place.state}" ward boundaries GIS`,
        `"${place.city}" "${place.state}" council district ArcGIS`,
        `"${place.city}" "${place.state}" wards ArcGIS`
    ];

    const candidates: GISCandidate[] = [];

    for (const query of queries) {
        const searchUrl =
            `${SEARCH_URL}${encodeURIComponent(query)}`;

        console.log(
            `Searching ${place.city}, ${place.state}: ${query}`
        );

        /*
         * At this stage, this function is a placeholder for the
         * actual search provider/API.
         *
         * If your existing discover.ts already has a search
         * implementation, keep that implementation here.
         */
        console.log(searchUrl);
    }

    return candidates;
}


/**
 * Remove duplicate candidate URLs.
 */
function deduplicateCandidates(
    candidates: GISCandidate[]
): GISCandidate[] {
    const seen = new Set<string>();

    return candidates.filter(candidate => {
        const normalized = candidate.url
            .trim()
            .replace(/\/+$/, "")
            .toLowerCase();

        if (seen.has(normalized)) {
            return false;
        }

        seen.add(normalized);

        return true;
    });
}


/**
 * Determine whether a URL looks like an ArcGIS REST service.
 */
function isArcGISUrl(url: string): boolean {
    const value = url.toLowerCase();

    return (
        value.includes("/featureserver") ||
        value.includes("/mapserver") ||
        value.includes("arcgis/rest/services")
    );
}


/**
 * Inspect and score one candidate.
 */
async function processCandidate(
    place: Place,
    candidate: GISCandidate
): Promise<DiscoveryRecord | null> {
    console.log(
        `Inspecting ${candidate.title}: ${candidate.url}`
    );

    /*
     * We currently only know how to inspect ArcGIS services.
     */
    if (!isArcGISUrl(candidate.url)) {
        return null;
    }

    let inspection;

    try {
        inspection = await inspectArcGIS(candidate.url);
    } catch (error) {
        console.warn(
            `Could not inspect ${candidate.url}`,
            error
        );

        return null;
    }

    /*
     * Score the candidate using both the municipality and
     * the GIS metadata.
     */
    const result = scoreCandidate({
        city: place.city,
        state: place.state,
        placeFips: place.placeFips,

        title: candidate.title,
        url: candidate.url,

        serviceName: inspection.serviceName,
        serviceType: inspection.serviceType,
        description: inspection.description,
        fields: inspection.fields
    });

    return {
        placeFips: place.placeFips,
        city: place.city,
        state: place.state,

        candidateUrl: candidate.url,
        title: candidate.title,

        score: result.score,
        requiresReview: result.requiresReview,

        reasons: result.reasons
    };
}


/**
 * Discover municipal district GIS sources.
 */
export async function discover(): Promise<void> {
    console.log("Loading municipalities...");

    let places: Place[];

    try {
        const contents = await fs.readFile(
            PLACES_FILE,
            "utf8"
        );

        places = JSON.parse(contents) as Place[];
    } catch {
        /*
         * If places.json does not exist yet, generate it.
         */
        console.log(
            "places.json not found. Fetching Census places..."
        );

        places = await fetchPlaces();

        await fs.mkdir(DATA_DIR, {
            recursive: true
        });

        await fs.writeFile(
            PLACES_FILE,
            JSON.stringify(places, null, 2),
            "utf8"
        );
    }

    console.log(
        `Loaded ${places.length} municipalities.`
    );

    const discoveries: DiscoveryRecord[] = [];

    for (const place of places) {
        console.log(
            `\n=== ${place.city}, ${place.state} ===`
        );

        const candidates =
            await searchCandidates(place);

        const uniqueCandidates =
            deduplicateCandidates(candidates);

        console.log(
            `Found ${uniqueCandidates.length} candidate sources.`
        );

        for (const candidate of uniqueCandidates) {
            try {
                const discovery =
                    await processCandidate(
                        place,
                        candidate
                    );

                if (discovery) {
                    discoveries.push(discovery);
                }
            } catch (error) {
                console.error(
                    `Error processing ${candidate.url}`,
                    error
                );
            }
        }
    }

    /*
     * Sort highest-confidence candidates first.
     */
    discoveries.sort((a, b) => {
        if (a.placeFips !== b.placeFips) {
            return a.placeFips.localeCompare(b.placeFips);
        }

        return b.score - a.score;
    });

    await fs.mkdir(DATA_DIR, {
        recursive: true
    });

    await fs.writeFile(
        DISCOVERIES_FILE,
        JSON.stringify(discoveries, null, 2),
        "utf8"
    );

    console.log(
        `\nWrote ${discoveries.length} discoveries to:`
    );

    console.log(DISCOVERIES_FILE);
}


/*
 * Allow:
 *
 *     npm run discover
 *
 * to execute this file directly.
 */
if (import.meta.url === `file://${process.argv[1]}`) {
    await discover();
}