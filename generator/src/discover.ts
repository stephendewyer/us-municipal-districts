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


const __filename =
    fileURLToPath(import.meta.url);

const __dirname =
    path.dirname(__filename);


const DATA_DIR =
    path.resolve(
        __dirname,
        "../data"
    );


const PLACES_FILE =
    path.join(
        DATA_DIR,
        "places.json"
    );


const DISCOVERIES_FILE =
    path.join(
        DATA_DIR,
        "discoveries.json"
    );


const ARCGIS_SEARCH_URL =
    "https://www.arcgis.com/sharing/rest/search";


/**
 * A candidate GIS source discovered for a municipality.
 */
interface GISCandidate {
    title: string;
    url: string;
}


/**
 * ArcGIS Online search result.
 */
interface ArcGISSearchItem {
    id?: string;
    title?: string;
    type?: string;
    url?: string;
    description?: string;
}


/**
 * ArcGIS Online search response.
 */
interface ArcGISSearchResponse {
    total?: number;
    results?: ArcGISSearchItem[];
}


/**
 * Get command-line arguments.
 *
 * Examples:
 *
 *     npm run discover
 *
 *     npm run discover Tucson AZ
 */
function getRequestedMunicipality(): {
    city?: string;
    state?: string;
} {

    const args =
        process.argv.slice(2);

    /*
     * When called through cli.ts:
     *
     *     npm run discover Tucson AZ
     *
     * process.argv contains:
     *
     *     ["discover", "Tucson", "AZ"]
     *
     * Ignore the command name.
     */
    const command =
        args[0]?.toLowerCase();

    if (
        command === "discover"
    ) {
        args.shift();
    }


    if (args.length === 0) {
        return {};
    }


    const city =
        args[0]?.trim();

    const state =
        args[1]?.trim();


    return {
        city,
        state
    };
}


/**
 * Determine whether a URL looks like an ArcGIS REST service.
 */
function isArcGISUrl(
    url: string
): boolean {

    const value =
        url.toLowerCase();

    return (
        value.includes(
            "/featureserver"
        ) ||
        value.includes(
            "/mapserver"
        ) ||
        value.includes(
            "arcgis/rest/services"
        )
    );
}


/**
 * Determine whether an ArcGIS item is a service
 * that we know how to inspect.
 */
function isSupportedArcGISItem(
    item: ArcGISSearchItem
): boolean {

    const type =
        (
            item.type ??
            ""
        ).toLowerCase();

    const url =
        (
            item.url ??
            ""
        ).toLowerCase();


    return (
        type === "feature service" ||
        type === "map service" ||
        url.includes(
            "/featureserver"
        ) ||
        url.includes(
            "/mapserver"
        )
    );
}


/**
 * Build ArcGIS Online search queries for a municipality.
 */
function buildSearchQueries(
    place: Place
): string[] {

    return [

        `"${place.city}" "city council"`,
        `"${place.city}" "council district"`,
        `"${place.city}" ward`,
        `"${place.city}" "ward boundaries"`,
        `"${place.city}" "council districts"`,
        `"${place.city}" aldermanic`

    ];
}


/**
 * Search ArcGIS Online for one query.
 */
async function searchArcGISOnline(
    query: string
): Promise<ArcGISSearchItem[]> {

    const params =
        new URLSearchParams({
            q: query,
            f: "json",
            num: "100"
        });


    const url =
        `${ARCGIS_SEARCH_URL}?${params.toString()}`;


    console.log(
        `ArcGIS Online search: ${query}`
    );


    const response =
        await fetch(url);


    if (!response.ok) {

        throw new Error(
            `ArcGIS Online search failed: ` +
            `${response.status} ${response.statusText}`
        );
    }


    const data =
        await response.json() as ArcGISSearchResponse;


    return (
        data.results ??
        []
    );
}


/**
 * Search ArcGIS Online for likely municipal
 * district boundary sources.
 */
async function searchCandidates(
    place: Place
): Promise<GISCandidate[]> {

    const queries =
        buildSearchQueries(
            place
        );


    const candidates:
        GISCandidate[] = [];


    for (
        const query of queries
    ) {

        let results:
            ArcGISSearchItem[];


        try {

            results =
                await searchArcGISOnline(
                    query
                );

        } catch (error) {

            console.warn(
                `Search failed for "${query}"`,
                error
            );

            continue;
        }


        console.log(
            `Found ${results.length} ArcGIS items`
        );


        for (
            const item of results
        ) {

            if (
                !isSupportedArcGISItem(
                    item
                )
            ) {
                continue;
            }


            const url =
                item.url?.trim();


            if (!url) {
                continue;
            }


            if (
                !isArcGISUrl(url)
            ) {
                continue;
            }


            const title =
                (
                    item.title ??
                    "Untitled ArcGIS service"
                ).trim();


            candidates.push({
                title,
                url
            });
        }
    }


    return candidates;
}


/**
 * Remove duplicate candidate URLs.
 */
function deduplicateCandidates(
    candidates: GISCandidate[]
): GISCandidate[] {

    const seen =
        new Set<string>();


    return candidates.filter(
        candidate => {

            const normalized =
                candidate.url
                    .trim()
                    .replace(
                        /\/+$/,
                        ""
                    )
                    .toLowerCase();


            if (
                seen.has(
                    normalized
                )
            ) {
                return false;
            }


            seen.add(
                normalized
            );


            return true;
        }
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
        `\nInspecting ${candidate.title}`
    );

    console.log(
        candidate.url
    );


    if (
        !isArcGISUrl(
            candidate.url
        )
    ) {

        console.log(
            "Skipping: not an ArcGIS REST service."
        );

        return null;
    }


    let inspection;


    try {

        inspection =
            await inspectArcGIS(
                candidate.url
            );

    } catch (error) {

        console.warn(
            `Could not inspect ${candidate.url}`
        );

        console.warn(
            error
        );

        return null;
    }


    if (
        inspection.isArcGIS !== true
    ) {

        console.log(
            "Skipping: ArcGIS inspection failed."
        );

        return null;
    }


    /*
     * Derive scoring signals from inspection.
     */
    const isPolygonLayer =
        inspection.geometryType ===
        "esriGeometryPolygon";


    const isFeatureServer =
        inspection.serviceType ===
        "FeatureServer";


    const isMapServer =
        inspection.serviceType ===
        "MapServer";


    const hasDistrictField =
        (
            inspection.districtFields?.length ??
            0
        ) > 0;


    /*
     * A candidate is likely to be a boundary layer
     * when it has polygon geometry and a district field.
     */
    const isLikelyBoundaryLayer =
        isPolygonLayer &&
        hasDistrictField;


    const result = scoreCandidate({
        city: place.city,
        state: place.state,
        placeFips: place.placeFips,

        title:
            candidate.title ??
            inspection.title,

        url:
            candidate.url,

        serviceName:
            inspection.serviceName,

        serviceType:
            inspection.serviceType,

        layerName:
            inspection.layerName,

        description:
            inspection.description,

        geometryType:
            inspection.geometryType,

        fields:
            inspection.fields,

        hasDistrictField:
            inspection.districtFields.length > 0,

        hasNameField:
            inspection.nameField !== undefined,

        isFeatureServer:
            inspection.serviceType ===
            "FeatureServer",

        isMapServer:
            inspection.serviceType ===
            "MapServer",

        isPolygonLayer:
            inspection.isPolygonLayer,

        isLikelyBoundaryLayer:
            inspection.isLikelyBoundaryLayer
    });


    console.log(
        `Score: ${result.score}`
    );


    console.log(
        `Review required: ${result.requiresReview}`
    );


    if (
        result.reasons.length > 0
    ) {

        console.log(
            `Reasons: ${result.reasons.join(", ")}`
        );
    }


    return {

        placeFips:
            place.placeFips,

        city:
            place.city,

        state:
            place.state,

        candidateUrl:
            candidate.url,

        title:
            candidate.title,

        score:
            result.score,

        requiresReview:
            result.requiresReview,

        reasons:
            result.reasons
    };
}


/**
 * Filter municipalities according to
 * command-line arguments.
 */
function filterPlaces(
    places: Place[]
): Place[] {

    const {
        city,
        state
    } =
        getRequestedMunicipality();


    /*
     * No arguments means:
     *
     *     discover all municipalities
     */
    if (!city) {

        return places;
    }


    const normalizedCity =
        city.toLowerCase();


    const normalizedState =
        state?.toLowerCase();


    const filtered =
        places.filter(
            place => {

                const placeCity =
                    place.city
                        .toLowerCase();


                const placeState =
                    place.state
                        .toLowerCase();


                if (
                    placeCity !==
                    normalizedCity
                ) {
                    return false;
                }


                if (
                    normalizedState &&
                    placeState !==
                    normalizedState
                ) {
                    return false;
                }


                return true;
            }
        );


    return filtered;
}


/**
 * Discover municipal district GIS sources.
 */
export async function discover(): Promise<void> {

    console.log(
        "Loading municipalities..."
    );


    let places:
        Place[];


    try {

        const contents =
            await fs.readFile(
                PLACES_FILE,
                "utf8"
            );


        places =
            JSON.parse(
                contents
            ) as Place[];

    } catch {

        console.log(
            "places.json not found. " +
            "Fetching Census places..."
        );


        places =
            await fetchPlaces();


        await fs.mkdir(
            DATA_DIR,
            {
                recursive: true
            }
        );


        await fs.writeFile(
            PLACES_FILE,
            JSON.stringify(
                places,
                null,
                2
            ),
            "utf8"
        );
    }


    console.log(
        `Loaded ${places.length} municipalities.`
    );


    /*
     * Apply optional CLI filtering.
     */
    const requestedPlaces =
        filterPlaces(
            places
        );


    if (
        requestedPlaces.length === 0
    ) {

        const {
            city,
            state
        } =
            getRequestedMunicipality();


        throw new Error(
            `Municipality not found: ` +
            `${city ?? ""}` +
            `${state ? `, ${state}` : ""}`
        );
    }


    console.log(
        `Processing ${requestedPlaces.length} ` +
        `municipality` +
        `${requestedPlaces.length === 1 ? "" : "ies"}.`
    );


    const discoveries:
        DiscoveryRecord[] = [];


    for (
        const place of requestedPlaces
    ) {

        console.log(
            `\n========================================`
        );


        console.log(
            `=== ${place.city}, ${place.state} ===`
        );


        console.log(
            `========================================`
        );


        let candidates:
            GISCandidate[];


        try {

            candidates =
                await searchCandidates(
                    place
                );

        } catch (error) {

            console.error(
                `Could not search for ` +
                `${place.city}, ${place.state}`
            );


            console.error(
                error
            );


            continue;
        }


        const uniqueCandidates =
            deduplicateCandidates(
                candidates
            );


        console.log(
            `Found ${uniqueCandidates.length} ` +
            `unique candidate sources.`
        );


        for (
            const candidate of uniqueCandidates
        ) {

            try {

                const discovery =
                    await processCandidate(
                        place,
                        candidate
                    );


                if (
                    discovery
                ) {

                    discoveries.push(
                        discovery
                    );
                }

            } catch (error) {

                console.error(
                    `Error processing ${candidate.url}`
                );


                console.error(
                    error
                );
            }
        }
    }


    /*
     * Sort highest-confidence candidates first,
     * grouped by municipality.
     */
    discoveries.sort(
        (a, b) => {

            if (
                a.placeFips !==
                b.placeFips
            ) {

                return a.placeFips.localeCompare(
                    b.placeFips
                );
            }


            return (
                b.score -
                a.score
            );
        }
    );


    await fs.mkdir(
        DATA_DIR,
        {
            recursive: true
        }
    );


    await fs.writeFile(
        DISCOVERIES_FILE,
        JSON.stringify(
            discoveries,
            null,
            2
        ),
        "utf8"
    );


    console.log(
        `\nWrote ${discoveries.length} discoveries to:`
    );


    console.log(
        DISCOVERIES_FILE
    );
}


/*
 * Allow:
 *
 *     npm run discover
 *
 * and:
 *
 *     npm run discover Tucson AZ
 *
 * to execute this file directly.
 */
if (
    import.meta.url ===
    `file://${process.argv[1]}`
) {

    await discover();
}