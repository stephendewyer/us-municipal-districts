// generator/src/censusPlaces.ts

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { CensusPlace } from "./types.js";


// =============================================================================
// Types
// =============================================================================

export interface CensusPlacesFile {
    source: string;
    year: number;
    generatedAt: string;
    places: CensusPlace[];
}


// =============================================================================
// Paths
// =============================================================================

const __filename =
    fileURLToPath(import.meta.url);

const __dirname =
    path.dirname(__filename);

const DATA_PATH =
    path.resolve(
        __dirname,
        "../data/census-places.json"
    );


// =============================================================================
// Cached data
// =============================================================================

let censusPlaces:
    CensusPlacesFile | undefined;


// =============================================================================
// Load Census places
// =============================================================================

/**
 * Load the generated Census place dataset.
 *
 * This function does not download or generate data.
 *
 * Run `npm run places` to regenerate the dataset.
 */
export function loadCensusPlaces(): CensusPlace[] {

    if (censusPlaces) {
        return censusPlaces.places;
    }

    censusPlaces =
        loadCensusPlacesFile();

    return censusPlaces.places;
}


/**
 * Load the complete generated Census dataset, including metadata.
 */
export function loadCensusPlacesFile(): CensusPlacesFile {

    if (!fs.existsSync(DATA_PATH)) {
        throw new Error(
            [
                "Census place dataset not found:",
                DATA_PATH,
                "",
                "Run:",
                "  npm run places"
            ].join("\n")
        );
    }

    const contents =
        fs.readFileSync(
            DATA_PATH,
            "utf8"
        );

    let parsed: unknown;

    try {
        parsed =
            JSON.parse(contents);
    } catch (error) {
        throw new Error(
            `Invalid Census place JSON: ${error}`
        );
    }

    const file =
        validateCensusPlacesFile(parsed);

    censusPlaces = file;

    return file;
}


// =============================================================================
// Lookup
// =============================================================================

/**
 * Find a Census place by city and state.
 */
export function findCensusPlace(
    city: string,
    state: string
): CensusPlace | undefined {

    const normalizedCity =
        normalizeName(city);

    const normalizedState =
        normalizeState(state);

    return loadCensusPlaces().find(place =>
        normalizeName(place.city) === normalizedCity &&
        normalizeState(place.state) === normalizedState
    );
}


/**
 * Find all Census places matching a city name.
 *
 * A city name can occur in multiple states.
 */
export function findCensusPlacesByName(
    city: string
): CensusPlace[] {

    const normalizedCity =
        normalizeName(city);

    return loadCensusPlaces().filter(place =>
        normalizeName(place.city) === normalizedCity
    );
}


/**
 * Find a Census place by its GEOID/place FIPS.
 */
export function findCensusPlaceByFips(
    placeFips: string
): CensusPlace | undefined {

    return loadCensusPlaces().find(
        place =>
            place.placeFips === placeFips
    );
}


/**
 * Return all Census places in a state.
 */
export function findCensusPlacesByState(
    state: string
): CensusPlace[] {

    const normalizedState =
        normalizeState(state);

    return loadCensusPlaces().filter(place =>
        normalizeState(place.state) === normalizedState
    );
}


// =============================================================================
// State helpers
// =============================================================================

const STATE_ABBREVIATIONS:
    Record<string, string> = {

    AL: "AL",
    AK: "AK",
    AZ: "AZ",
    AR: "AR",
    CA: "CA",
    CO: "CO",
    CT: "CT",
    DE: "DE",
    FL: "FL",
    GA: "GA",
    HI: "HI",
    ID: "ID",
    IL: "IL",
    IN: "IN",
    IA: "IA",
    KS: "KS",
    KY: "KY",
    LA: "LA",
    ME: "ME",
    MD: "MD",
    MA: "MA",
    MI: "MI",
    MN: "MN",
    MS: "MS",
    MO: "MO",
    MT: "MT",
    NE: "NE",
    NV: "NV",
    NH: "NH",
    NJ: "NJ",
    NM: "NM",
    NY: "NY",
    NC: "NC",
    ND: "ND",
    OH: "OH",
    OK: "OK",
    OR: "OR",
    PA: "PA",
    RI: "RI",
    SC: "SC",
    SD: "SD",
    TN: "TN",
    TX: "TX",
    UT: "UT",
    VT: "VT",
    VA: "VA",
    WA: "WA",
    WV: "WV",
    WI: "WI",
    WY: "WY",
    DC: "DC"
};


const STATE_NAMES:
    Record<string, string> = {

    ALABAMA: "AL",
    ALASKA: "AK",
    ARIZONA: "AZ",
    ARKANSAS: "AR",
    CALIFORNIA: "CA",
    COLORADO: "CO",
    CONNECTICUT: "CT",
    DELAWARE: "DE",
    FLORIDA: "FL",
    GEORGIA: "GA",
    HAWAII: "HI",
    IDAHO: "ID",
    ILLINOIS: "IL",
    INDIANA: "IN",
    IOWA: "IA",
    KANSAS: "KS",
    KENTUCKY: "KY",
    LOUISIANA: "LA",
    MAINE: "ME",
    MARYLAND: "MD",
    MASSACHUSETTS: "MA",
    MICHIGAN: "MI",
    MINNESOTA: "MN",
    MISSISSIPPI: "MS",
    MISSOURI: "MO",
    MONTANA: "MT",
    NEBRASKA: "NE",
    NEVADA: "NV",
    "NEW HAMPSHIRE": "NH",
    "NEW JERSEY": "NJ",
    "NEW MEXICO": "NM",
    "NEW YORK": "NY",
    "NORTH CAROLINA": "NC",
    "NORTH DAKOTA": "ND",
    OHIO: "OH",
    OKLAHOMA: "OK",
    OREGON: "OR",
    PENNSYLVANIA: "PA",
    "RHODE ISLAND": "RI",
    "SOUTH CAROLINA": "SC",
    "SOUTH DAKOTA": "SD",
    TENNESSEE: "TN",
    TEXAS: "TX",
    UTAH: "UT",
    VERMONT: "VT",
    VIRGINIA: "VA",
    WASHINGTON: "WA",
    "WEST VIRGINIA": "WV",
    WISCONSIN: "WI",
    WYOMING: "WY",
    "DISTRICT OF COLUMBIA": "DC"
};


function normalizeState(
    state: string
): string {

    const normalized =
        state
            .trim()
            .toUpperCase();

    return (
        STATE_ABBREVIATIONS[normalized] ??
        STATE_NAMES[normalized] ??
        normalized
    );
}


// =============================================================================
// Name normalization
// =============================================================================

function normalizeName(
    value: string
): string {

    return value
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\./g, "")
        .replace(/['’]/g, "")
        .replace(/[-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}


// =============================================================================
// Validation
// =============================================================================

function validateCensusPlacesFile(
    value: unknown
): CensusPlacesFile {

    if (
        typeof value !== "object" ||
        value === null ||
        Array.isArray(value)
    ) {
        throw new Error(
            "Invalid Census place dataset: expected an object."
        );
    }

    const record =
        value as Record<string, unknown>;

    if (
        typeof record.source !== "string"
    ) {
        throw new Error(
            "Invalid Census place dataset: missing source."
        );
    }

    if (
        typeof record.year !== "number"
    ) {
        throw new Error(
            "Invalid Census place dataset: missing year."
        );
    }

    if (
        typeof record.generatedAt !== "string"
    ) {
        throw new Error(
            "Invalid Census place dataset: missing generatedAt."
        );
    }

    if (
        !Array.isArray(record.places)
    ) {
        throw new Error(
            "Invalid Census place dataset: missing places array."
        );
    }

    const places =
        record.places.map(
            validateCensusPlace
        );

    return {
        source: record.source,
        year: record.year,
        generatedAt: record.generatedAt,
        places
    };
}


function validateCensusPlace(
    value: unknown
): CensusPlace {

    if (
        typeof value !== "object" ||
        value === null ||
        Array.isArray(value)
    ) {
        throw new Error(
            "Invalid Census place: expected an object."
        );
    }

    const record =
        value as Record<string, unknown>;

    if (
        typeof record.placeFips !== "string"
    ) {
        throw new Error(
            "Invalid Census place: missing placeFips."
        );
    }

    if (
        typeof record.city !== "string"
    ) {
        throw new Error(
            "Invalid Census place: missing city."
        );
    }

    if (
        typeof record.state !== "string"
    ) {
        throw new Error(
            "Invalid Census place: missing state."
        );
    }

    if (
        record.stateFips !== undefined &&
        typeof record.stateFips !== "string"
    ) {
        throw new Error(
            `Invalid Census place ${record.placeFips}: ` +
            "stateFips must be a string."
        );
    }

    if (
        record.placeName !== undefined &&
        typeof record.placeName !== "string"
    ) {
        throw new Error(
            `Invalid Census place ${record.placeFips}: ` +
            "placeName must be a string."
        );
    }

    if (
        record.placeType !== undefined &&
        record.placeType !== "incorporated-place" &&
        record.placeType !== "census-designated-place"
    ) {
        throw new Error(
            `Invalid Census place ${record.placeFips}: ` +
            "invalid placeType."
        );
    }

    return {
        placeFips: record.placeFips,
        city: record.city,
        state: normalizeState(record.state),

        ...(record.stateFips !== undefined
            ? {
                stateFips:
                    record.stateFips
            }
            : {}),

        ...(record.placeName !== undefined
            ? {
                placeName:
                    record.placeName
            }
            : {}),

        ...(record.placeType !== undefined
            ? {
                placeType:
                    record.placeType
            }
            : {})
    };
}