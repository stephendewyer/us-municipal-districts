import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import AdmZip from "adm-zip";

import type { CensusPlace } from "./types.js";


// =============================================================================
// Configuration
// =============================================================================

const CENSUS_YEAR = 2025;

const CENSUS_URL =
    `https://www2.census.gov/geo/docs/maps-data/data/gazetteer/${CENSUS_YEAR}_Gazetteer/${CENSUS_YEAR}_Gaz_place_national.zip`;


// =============================================================================
// Paths
// =============================================================================

const __filename =
    fileURLToPath(import.meta.url);

const __dirname =
    path.dirname(__filename);

const OUTPUT_PATH =
    path.resolve(
        __dirname,
        "../data/census-places.json"
    );


// =============================================================================
// Output type
// =============================================================================

interface CensusPlacesFile {
    source: string;
    year: number;
    generatedAt: string;
    places: CensusPlace[];
}


// =============================================================================
// Public API
// =============================================================================

/**
 * Download the current Census National Places Gazetteer,
 * extract incorporated places, and generate census-places.json.
 */
export async function generateCensusPlaces(): Promise<void> {

    console.log(
        `Downloading Census ${CENSUS_YEAR} National Places Gazetteer...`
    );

    const zipBuffer =
        await downloadGazetteer();

    console.log(
        `Downloaded ${formatBytes(zipBuffer.length)}.`
    );

    const text =
        extractGazetteerText(
            zipBuffer
        );

    const places =
        parseGazetteer(
            text
        );

    if (
        places.length === 0
    ) {
        throw new Error(
            "Census Gazetteer produced zero incorporated places."
        );
    }

    const output: CensusPlacesFile = {
        source:
            "U.S. Census Bureau",

        year:
            CENSUS_YEAR,

        generatedAt:
            new Date().toISOString(),

        places
    };

    fs.mkdirSync(
        path.dirname(OUTPUT_PATH),
        {
            recursive: true
        }
    );

    fs.writeFileSync(
        OUTPUT_PATH,
        JSON.stringify(
            output,
            null,
            2
        ) + "\n",
        "utf8"
    );

    console.log(
        `Generated ${places.length} incorporated places.`
    );

    console.log(
        `Wrote ${OUTPUT_PATH}`
    );
}

// =============================================================================
// Load generated Census places
// =============================================================================

/**
 * Load the previously generated Census places file.
 *
 * This does not download anything from the Census Bureau.
 * It simply reads generator/data/census-places.json.
 */
export function loadCensusPlaces(): CensusPlace[] {

    if (!fs.existsSync(OUTPUT_PATH)) {

        throw new Error(
            [
                "Census places file not found.",
                `Expected: ${OUTPUT_PATH}`,
                "",
                "Run:",
                "  npm run places"
            ].join("\n")
        );
    }


    const contents =
        fs.readFileSync(
            OUTPUT_PATH,
            "utf8"
        );


    const parsed:
        unknown =
        JSON.parse(contents);


    if (
        typeof parsed !== "object" ||
        parsed === null
    ) {

        throw new Error(
            "Invalid census-places.json: expected an object."
        );
    }


    const record =
        parsed as Record<string, unknown>;


    if (
        !Array.isArray(record.places)
    ) {

        throw new Error(
            "Invalid census-places.json: missing places array."
        );
    }


    return record.places as CensusPlace[];
}


// =============================================================================
// Download
// =============================================================================

async function downloadGazetteer(): Promise<Buffer> {

    const response =
        await fetch(
            CENSUS_URL
        );

    if (
        !response.ok
    ) {
        throw new Error(
            [
                "Failed to download Census Gazetteer.",
                `URL: ${CENSUS_URL}`,
                `Status: ${response.status}`,
                `Status text: ${response.statusText}`
            ].join("\n")
        );
    }

    const arrayBuffer =
        await response.arrayBuffer();

    return Buffer.from(
        arrayBuffer
    );
}


// =============================================================================
// ZIP extraction
// =============================================================================

function extractGazetteerText(
    buffer: Buffer
): string {

    const zip =
        new AdmZip(
            buffer
        );

    const entries =
        zip.getEntries();

    if (
        entries.length === 0
    ) {
        throw new Error(
            "Census Gazetteer ZIP contains no files."
        );
    }

    /*
     * Find the Gazetteer text file.
     *
     * We don't hard-code the exact filename because Census filenames
     * can change between vintages.
     */
    const textEntry =
        entries.find(
            entry =>
                entry.entryName
                    .toLowerCase()
                    .endsWith(".txt")
        );

    if (!textEntry) {
        throw new Error(
            [
                "Could not find a TXT file in Census Gazetteer ZIP.",
                "",
                "Files found:",
                ...entries.map(
                    entry =>
                        `  ${entry.entryName}`
                )
            ].join("\n")
        );
    }

    return textEntry
        .getData()
        .toString("utf8");
}


// =============================================================================
// Gazetteer parsing
// =============================================================================

function parseGazetteer(
    text: string
): CensusPlace[] {

    const lines =
        text
            .split(/\r?\n/)
            .filter(
                line =>
                    line.trim().length > 0
            );

    if (
        lines.length < 2
    ) {
        throw new Error(
            "Census Gazetteer file is empty or missing its header."
        );
    }

    /*
     * Census Gazetteer files use pipe-delimited columns.
     */
    const headers =
        lines[0]
            .split("|")
            .map(
                value =>
                    value
                        .trim()
                        .toUpperCase()
            );

    const columnIndex =
        createColumnIndex(
            headers
        );


    // -------------------------------------------------------------------------
    // Required columns
    // -------------------------------------------------------------------------

    const geoidIndex =
        getRequiredColumn(
            columnIndex,
            "GEOID"
        );

    const nameIndex =
        getRequiredColumn(
            columnIndex,
            "NAME"
        );

    const uspsIndex =
        getRequiredColumn(
            columnIndex,
            "USPS"
        );

    const lsadIndex =
        getRequiredColumn(
            columnIndex,
            "LSAD"
        );


    // -------------------------------------------------------------------------
    // Optional columns
    // -------------------------------------------------------------------------

    const geoidFqIndex =
        columnIndex.get(
            "GEOIDFQ"
        );

    const ansicodeIndex =
        columnIndex.get(
            "ANSICODE"
        );

    const funcstatIndex =
        columnIndex.get(
            "FUNCSTAT"
        );

    const latitudeIndex =
        columnIndex.get(
            "INTPTLAT"
        );

    const longitudeIndex =
        columnIndex.get(
            "INTPTLONG"
        );


    // -------------------------------------------------------------------------
    // Parse places
    // -------------------------------------------------------------------------

    const places: CensusPlace[] = [];

    for (
        let lineNumber = 1;
        lineNumber < lines.length;
        lineNumber++
    ) {

        const columns =
            lines[lineNumber]
                .split("|");


        const placeFips =
            columns[
                geoidIndex
            ]?.trim();

        const name =
            columns[
                nameIndex
            ]?.trim();

        const state =
            columns[
                uspsIndex
            ]?.trim()
            .toUpperCase();

        const lsad =
            columns[
                lsadIndex
            ]?.trim();


        // ---------------------------------------------------------------------
        // Validate basic fields
        // ---------------------------------------------------------------------

        if (
            !placeFips ||
            !name ||
            !state ||
            !lsad
        ) {
            throw new Error(
                [
                    `Invalid Census place at line ${lineNumber + 1}.`,
                    `GEOID: ${placeFips ?? "(missing)"}`,
                    `NAME: ${name ?? "(missing)"}`,
                    `USPS: ${state ?? "(missing)"}`,
                    `LSAD: ${lsad ?? "(missing)"}`
                ].join(" ")
            );
        }


        // ---------------------------------------------------------------------
        // Determine place type
        // ---------------------------------------------------------------------

        const placeType =
            classifyPlace(
                lsad
            );

        /*
         * We only want incorporated municipalities.
         *
         * Census Designated Places and other non-incorporated
         * statistical entities are excluded.
         */
        if (
            placeType !==
            "incorporated-place"
        ) {
            continue;
        }


        // ---------------------------------------------------------------------
        // Optional metadata
        // ---------------------------------------------------------------------

        const geoidFq =
            geoidFqIndex === undefined
                ? undefined
                : columns[
                    geoidFqIndex
                ]?.trim();

        const ansicode =
            ansicodeIndex === undefined
                ? undefined
                : columns[
                    ansicodeIndex
                ]?.trim();

        const funcstat =
            funcstatIndex === undefined
                ? undefined
                : columns[
                    funcstatIndex
                ]?.trim();

        const latitude =
            latitudeIndex === undefined
                ? undefined
                : parseCoordinate(
                    columns[
                        latitudeIndex
                    ]
                );

        const longitude =
            longitudeIndex === undefined
                ? undefined
                : parseCoordinate(
                    columns[
                        longitudeIndex
                    ]
                );


        // ---------------------------------------------------------------------
        // Construct Census place
        // ---------------------------------------------------------------------

        places.push({

            placeFips,

            city:
                cleanPlaceName(
                    name
                ),

            state,

            placeName:
                name,

            placeType,

            ...(geoidFq
                ? {
                    geoidFq
                }
                : {}),

            ...(ansicode
                ? {
                    ansicode
                }
                : {}),

            ...(funcstat
                ? {
                    funcstat
                }
                : {}),

            ...(latitude !== undefined
                ? {
                    latitude
                }
                : {}),

            ...(longitude !== undefined
                ? {
                    longitude
                }
                : {})
        });
    }


    // -------------------------------------------------------------------------
    // Sort deterministically
    // -------------------------------------------------------------------------

    places.sort(
        (a, b) => {

            const stateCompare =
                a.state.localeCompare(
                    b.state
                );

            if (
                stateCompare !== 0
            ) {
                return stateCompare;
            }

            return a.city.localeCompare(
                b.city
            );
        }
    );

    return places;
}


// =============================================================================
// Place classification
// =============================================================================

/**
 * Classify a Census place using the 2025 Gazetteer's LSAD value.
 *
 * LSAD values vary somewhat across Census products, so we deliberately
 * keep this function conservative.
 */
function classifyPlace(
    lsad: string
): CensusPlace["placeType"] {

    const normalized =
        lsad
            .trim()
            .toUpperCase();

    if (
        [
            "25",
            "43",
            "47",
            "53",
            "CITY",
            "TOWN",
            "BOROUGH",
            "VILLAGE",
            "MUNICIPALITY"
        ].includes(normalized)
    ) {
        return "incorporated-place";
    }

    return "census-designated-place";
}


// =============================================================================
// Column helpers
// =============================================================================

function createColumnIndex(
    headers: string[]
): Map<string, number> {

    return new Map(
        headers.map(
            (header, index) =>
                [
                    header,
                    index
                ]
        )
    );
}


function getRequiredColumn(
    columns: Map<string, number>,
    name: string
): number {

    const index =
        columns.get(
            name
        );

    if (
        index === undefined
    ) {
        throw new Error(
            [
                `Census Gazetteer is missing required column "${name}".`,
                "",
                "Available columns:",
                ...Array.from(
                    columns.keys()
                )
            ].join("\n")
        );
    }

    return index;
}


// =============================================================================
// Name handling
// =============================================================================

/**
 * Convert Census names such as:
 *
 *   "Tucson city"
 *   "Phoenix city"
 *   "Flagstaff city"
 *
 * into:
 *
 *   "Tucson"
 *   "Phoenix"
 *   "Flagstaff"
 *
 * The original Census name is retained in `placeName`.
 */
function cleanPlaceName(
    name: string
): string {

    return name
        .replace(
            /\s+(city|town|village|borough|municipality|township)$/i,
            ""
        )
        .trim();
}


// =============================================================================
// Coordinates
// =============================================================================

function parseCoordinate(
    value: string | undefined
):
    number | undefined {

    if (
        !value
    ) {
        return undefined;
    }

    const parsed =
        Number(
            value.trim()
        );

    return Number.isFinite(
        parsed
    )
        ? parsed
        : undefined;
}


// =============================================================================
// Utilities
// =============================================================================

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
