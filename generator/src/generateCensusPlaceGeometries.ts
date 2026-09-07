import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import AdmZip from "adm-zip";
import * as shapefile from "shapefile";

import type {
    Feature,
    Geometry,
    MultiPolygon,
    Polygon
} from "geojson";

import {
    loadCensusPlaces
} from "./generateCensusPlaces.js";

import type {
    CensusPlace
} from "./types.js";

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const CENSUS_VINTAGE =
    2025;

const CENSUS_PLACE_BASE_URL =
    "https://www2.census.gov/geo/tiger/TIGER2025/PLACE";

const DEFAULT_OUTPUT_DIRECTORY =
    path.resolve(
        "generator",
        "data",
        "census-place-geometries"
    );

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface CensusPlaceGeometryStateFile {
    state: string;
    stateFips: string;
    vintage: number;
    generatedAt: string;
    source: string;

    /**
     * Census place GEOID -> Polygon/MultiPolygon geometry.
     */
    geometries: Record<
        string,
        Polygon | MultiPolygon
    >;
}

// -----------------------------------------------------------------------------
// State FIPS
// -----------------------------------------------------------------------------

const STATE_FIPS: Record<
    string,
    string
> = {
    AL: "01",
    AK: "02",
    AZ: "04",
    AR: "05",
    CA: "06",
    CO: "08",
    CT: "09",
    DE: "10",
    DC: "11",
    FL: "12",
    GA: "13",
    HI: "15",
    ID: "16",
    IL: "17",
    IN: "18",
    IA: "19",
    KS: "20",
    KY: "21",
    LA: "22",
    ME: "23",
    MD: "24",
    MA: "25",
    MI: "26",
    MN: "27",
    MS: "28",
    MO: "29",
    MT: "30",
    NE: "31",
    NV: "32",
    NH: "33",
    NJ: "34",
    NM: "35",
    NY: "36",
    NC: "37",
    ND: "38",
    OH: "39",
    OK: "40",
    OR: "41",
    PA: "42",
    RI: "44",
    SC: "45",
    SD: "46",
    TN: "47",
    TX: "48",
    UT: "49",
    VT: "50",
    VA: "51",
    WA: "53",
    WV: "54",
    WI: "55",
    WY: "56",

    // Territories are included in the Census state-based
    // Place files when applicable.
    AS: "60",
    GU: "66",
    MP: "69",
    PR: "72",
    VI: "78"
};

// -----------------------------------------------------------------------------
// Main generator
// -----------------------------------------------------------------------------

export async function generateCensusPlaceGeometries(
    outputDirectory: string =
        DEFAULT_OUTPUT_DIRECTORY
): Promise<string[]> {

    console.log(
        "\nGenerating Census place geometries..."
    );

    const places =
        loadCensusPlaces();

    if (
        places.length === 0
    ) {
        throw new Error(
            "No Census places available. " +
            "Run the Census places generator first."
        );
    }

    console.log(
        `  Census places loaded: ${places.length}`
    );

    const states =
        getRequiredStates(
            places
        );

    console.log(
        `  States required: ${states.length}`
    );

    console.log(
        `  Vintage: ${CENSUS_VINTAGE}`
    );

    fs.mkdirSync(
        outputDirectory,
        {
            recursive: true
        }
    );

    const generatedFiles: string[] = [];

    let totalMatched = 0;

    let totalSkipped = 0;

    for (
        const state of states
    ) {

        const stateFips =
            STATE_FIPS[state];

        if (
            !stateFips
        ) {
            throw new Error(
                `No Census FIPS code is defined ` +
                `for state "${state}".`
            );
        }

        console.log(
            `\n  Processing ${state} (${stateFips})...`
        );

        const statePlaces =
            places.filter(
                place =>
                    normalizeState(
                        place.state
                    ) === state
            );

        console.log(
            `    Census places: ${statePlaces.length}`
        );

        const source =
            `${CENSUS_PLACE_BASE_URL}/` +
            `tl_${CENSUS_VINTAGE}_${stateFips}_place.zip`;

        const stateGeometries =
            await downloadStatePlaceGeometries(
                state,
                stateFips
            );

        console.log(
            `    TIGER/Line features: ` +
            `${stateGeometries.size}`
        );

        const geometries:
            Record<
                string,
                Polygon | MultiPolygon
            > = {};

        let matched = 0;

        let skipped = 0;

        for (
            const place of statePlaces
        ) {

            const placeFips =
                normalizePlaceFips(
                    place.placeFips
                );

            const geometry =
                stateGeometries.get(
                    placeFips
                );

            if (
                !geometry
            ) {

                skipped++;

                console.warn(
                    `    Warning: no geometry found for ` +
                    `${place.city}, ${place.state} ` +
                    `(${placeFips})`
                );

                continue;
            }

            geometries[
                placeFips
            ] = geometry;

            matched++;
        }

        console.log(
            `    Matched geometries: ${matched}`
        );

        if (
            skipped > 0
        ) {
            console.warn(
                `    Missing geometries: ${skipped}`
            );
        }

        const outputFile =
            path.join(
                outputDirectory,
                `${stateFips}.json`
            );

        const result:
            CensusPlaceGeometryStateFile = {
            state,

            stateFips,

            vintage:
                CENSUS_VINTAGE,

            generatedAt:
                new Date().toISOString(),

            source,

            geometries
        };

        fs.writeFileSync(
            outputFile,
            JSON.stringify(
                result
            ) + "\n",
            "utf8"
        );

        console.log(
            `    Written: ${outputFile}`
        );

        generatedFiles.push(
            outputFile
        );

        totalMatched += matched;

        totalSkipped += skipped;
    }

    console.log(
        "\nCensus place geometry generation complete."
    );

    console.log(
        `  States processed: ${generatedFiles.length}`
    );

    console.log(
        `  Matched geometries: ${totalMatched}`
    );

    if (
        totalSkipped > 0
    ) {
        console.warn(
            `  Missing geometries: ${totalSkipped}`
        );
    }

    console.log(
        `  Output directory: ${outputDirectory}`
    );

    return generatedFiles;
}

// -----------------------------------------------------------------------------
// Download state TIGER/Line geometry
// -----------------------------------------------------------------------------

async function downloadStatePlaceGeometries(
    state: string,
    stateFips: string
): Promise<
    Map<
        string,
        Polygon | MultiPolygon
    >
> {

    const zipFileName =
        `tl_${CENSUS_VINTAGE}_${stateFips}_place.zip`;

    const url =
        `${CENSUS_PLACE_BASE_URL}/${zipFileName}`;

    console.log(
        `    Downloading: ${url}`
    );

    const response =
        await fetch(
            url
        );

    if (
        !response.ok
    ) {

        const body =
            await response.text();

        throw new Error(
            `Census TIGER/Line download failed ` +
            `for ${state} ` +
            `(${response.status} ` +
            `${response.statusText}).\n` +
            `URL: ${url}\n` +
            `Response: ${body.slice(0, 500)}`
        );
    }

    const arrayBuffer =
        await response.arrayBuffer();

    const zipBuffer =
        Buffer.from(
            arrayBuffer
        );

    console.log(
        `    Downloaded: ` +
        `${formatBytes(zipBuffer.length)}`
    );

    const zip =
        new AdmZip(
            zipBuffer
        );

    const entries =
        zip.getEntries();

    const shpEntry =
        findZipEntry(
            entries,
            ".shp"
        );

    const dbfEntry =
        findZipEntry(
            entries,
            ".dbf"
        );

    if (
        !shpEntry
    ) {
        throw new Error(
            `TIGER/Line ZIP for ${state} ` +
            "does not contain a .shp file."
        );
    }

    if (
        !dbfEntry
    ) {
        throw new Error(
            `TIGER/Line ZIP for ${state} ` +
            "does not contain a .dbf file."
        );
    }

    console.log(
        `    Shapefile: ${shpEntry.entryName}`
    );

    console.log(
        `    DBF: ${dbfEntry.entryName}`
    );

    const shpBuffer =
        shpEntry.getData();

    const dbfBuffer =
        dbfEntry.getData();

    return readShapefile(
        shpBuffer,
        dbfBuffer
    );
}

// -----------------------------------------------------------------------------
// Read shapefile
// -----------------------------------------------------------------------------

async function readShapefile(
    shpBuffer: Buffer,
    dbfBuffer: Buffer
): Promise<
    Map<
        string,
        Polygon | MultiPolygon
    >
> {

    const source =
        await shapefile.open(
            shpBuffer,
            dbfBuffer
        );

    const geometries =
        new Map<
            string,
            Polygon | MultiPolygon
        >();

    while (true) {

        const result =
            await source.read();

        if (
            result.done
        ) {
            break;
        }

        if (
            !result.value
        ) {
            continue;
        }

        const feature =
            result.value as Feature<
                Geometry,
                Record<string, unknown>
            >;

        if (
            !feature.geometry
        ) {
            continue;
        }

        if (
            feature.geometry.type !==
                "Polygon" &&
            feature.geometry.type !==
                "MultiPolygon"
        ) {
            continue;
        }

        const geoid =
            getFeatureGEOID(
                feature
            );

        if (
            !geoid
        ) {
            continue;
        }

        const placeFips =
            normalizePlaceFips(
                geoid
            );

        geometries.set(
            placeFips,
            feature.geometry
        );
    }

    return geometries;
}

// -----------------------------------------------------------------------------
// GEOID helpers
// -----------------------------------------------------------------------------

function getFeatureGEOID(
    feature: Feature
): string | undefined {

    if (
        !feature.properties ||
        typeof feature.properties !== "object"
    ) {
        return undefined;
    }

    return getPropertyString(
        feature.properties,
        "GEOID"
    );
}

function getPropertyString(
    properties:
        Record<string, unknown>,
    fieldName: string
): string | undefined {

    const value =
        properties[
            fieldName
        ];

    if (
        typeof value === "string"
    ) {
        return value.trim();
    }

    if (
        typeof value === "number"
    ) {
        return String(value);
    }

    return undefined;
}

// -----------------------------------------------------------------------------
// ZIP helpers
// -----------------------------------------------------------------------------

function findZipEntry(
    entries: AdmZip.IZipEntry[],
    extension: string
): AdmZip.IZipEntry | undefined {

    const normalizedExtension =
        extension.toLowerCase();

    return entries.find(
        entry =>
            !entry.isDirectory &&
            entry.entryName
                .toLowerCase()
                .endsWith(
                    normalizedExtension
                )
    );
}

// -----------------------------------------------------------------------------
// State helpers
// -----------------------------------------------------------------------------

function getRequiredStates(
    places: CensusPlace[]
): string[] {

    const states =
        new Set<string>();

    for (
        const place of places
    ) {

        const state =
            normalizeState(
                place.state
            );

        if (
            !STATE_FIPS[state]
        ) {
            throw new Error(
                `No Census FIPS code is defined ` +
                `for state "${place.state}".`
            );
        }

        states.add(
            state
        );
    }

    return Array.from(
        states
    ).sort();
}

function normalizeState(
    value: string
): string {

    return value
        .trim()
        .toUpperCase();
}

function normalizePlaceFips(
    value: string
): string {

    return value
        .trim()
        .replace(
            /\D/g,
            ""
        )
        .padStart(
            7,
            "0"
        );
}

// -----------------------------------------------------------------------------
// Formatting
// -----------------------------------------------------------------------------

function formatBytes(
    bytes: number
): string {

    if (
        bytes < 1024
    ) {
        return `${bytes} B`;
    }

    if (
        bytes < 1024 * 1024
    ) {
        return `${(
            bytes / 1024
        ).toFixed(1)} KB`;
    }

    return `${(
        bytes /
        (1024 * 1024)
    ).toFixed(1)} MB`;
}

// -----------------------------------------------------------------------------
// CLI
// -----------------------------------------------------------------------------

if (
    process.argv[1] &&
    path.resolve(
        process.argv[1]
    ) ===
        path.resolve(
            fileURLToPath(
                import.meta.url
            )
        )
) {

    generateCensusPlaceGeometries()
        .catch(
            error => {

                console.error(
                    "\nFailed to generate Census place geometries:"
                );

                console.error(
                    error
                );

                process.exit(
                    1
                );
            }
        );
}