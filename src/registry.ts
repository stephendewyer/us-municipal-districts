import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type {
    BoundaryType,
    MunicipalDistrictLookupOptions,
    MunicipalDistrictRegistry,
    MunicipalDistrictRegistryEntry,
    MunicipalDistrictSource
} from "./types.js";

export type {
    MunicipalDistrictRegistry,
    MunicipalDistrictRegistryEntry,
    MunicipalDistrictSource
};

// =============================================================================
// Paths
// =============================================================================

const __filename =
    fileURLToPath(import.meta.url);

const __dirname =
    path.dirname(__filename);

/*
 * When compiled:
 *
 * src/registry.ts
 *       ↓
 * dist/registry.js
 *
 * Therefore ../data points back to the package's data directory.
 */
const REGISTRY_PATH =
    path.resolve(
        __dirname,
        "../data/municipalities/registry.json"
    );


// =============================================================================
// Registry cache
// =============================================================================

let registry:
    MunicipalDistrictRegistry | undefined;


// =============================================================================
// Load registry
// =============================================================================

/**
 * Load and validate the generated municipal registry.
 *
 * The registry is loaded lazily and cached after the first read.
 */
export function loadRegistry():
    MunicipalDistrictRegistry {

    if (registry) {
        return registry;
    }

    if (!fs.existsSync(REGISTRY_PATH)) {
        throw new Error(
            `Municipal registry not found: ${REGISTRY_PATH}`
        );
    }

    const contents =
        fs.readFileSync(
            REGISTRY_PATH,
            "utf8"
        );

    let parsed: unknown;

    try {

        parsed =
            JSON.parse(contents);

    } catch (error) {

        throw new Error(
            `Invalid municipal registry JSON: ${REGISTRY_PATH}`,
            {
                cause: error
            }
        );
    }

    registry =
        validateRegistry(
            parsed
        );

    return registry;
}


// =============================================================================
// Find one registry entry
// =============================================================================

/**
 * Find the first registry entry matching the supplied options.
 */
export function findRegistryEntry(
    options: MunicipalDistrictLookupOptions = {}
):
    MunicipalDistrictRegistryEntry | undefined {

    return findRegistryEntries(
        options
    )[0];
}


// =============================================================================
// Find registry entries
// =============================================================================

/**
 * Find all registry entries matching the supplied options.
 */
export function findRegistryEntries(
    options: MunicipalDistrictLookupOptions = {}
):
    MunicipalDistrictRegistryEntry[] {

    const entries =
        loadRegistry().entries;

    return entries.filter(
        entry =>
            matchesRegistryEntry(
                entry,
                options
            )
    );
}


// =============================================================================
// Matching
// =============================================================================

function matchesRegistryEntry(
    entry: MunicipalDistrictRegistryEntry,
    options: MunicipalDistrictLookupOptions
): boolean {

    if (
        options.city !== undefined &&
        normalizeName(entry.city) !==
            normalizeName(options.city)
    ) {
        return false;
    }

    if (
        options.state !== undefined &&
        normalizeState(entry.state) !==
            normalizeState(options.state)
    ) {
        return false;
    }

    if (
        options.placeFips !== undefined &&
        entry.placeFips !==
            options.placeFips
    ) {
        return false;
    }

    if (
        options.boundaryType !== undefined &&
        entry.boundaryType !==
            options.boundaryType
    ) {
        return false;
    }

    return true;
}


// =============================================================================
// Registry validation
// =============================================================================

function validateRegistry(
    value: unknown
): MunicipalDistrictRegistry {

    if (
        typeof value !== "object" ||
        value === null
    ) {
        throw new Error(
            "Invalid municipal registry: expected an object."
        );
    }

    const record =
        value as Record<string, unknown>;

    if (
        typeof record.version !== "string"
    ) {
        throw new Error(
            "Invalid municipal registry: missing version."
        );
    }

    if (
        typeof record.generatedAt !== "string"
    ) {
        throw new Error(
            "Invalid municipal registry: missing generatedAt."
        );
    }

    if (
        !Array.isArray(record.entries)
    ) {
        throw new Error(
            "Invalid municipal registry: entries must be an array."
        );
    }

    const entries =
        record.entries.map(
            validateRegistryEntry
        );

    return {
        version:
            record.version,

        generatedAt:
            record.generatedAt,

        entries
    };
}


// =============================================================================
// Registry entry validation
// =============================================================================

function validateRegistryEntry(
    value: unknown
): MunicipalDistrictRegistryEntry {

    if (
        typeof value !== "object" ||
        value === null
    ) {
        throw new Error(
            "Invalid registry entry: expected an object."
        );
    }

    const record =
        value as Record<string, unknown>;

    if (
        typeof record.placeFips !== "string"
    ) {
        throw new Error(
            "Invalid registry entry: missing placeFips."
        );
    }

    if (
        typeof record.city !== "string"
    ) {
        throw new Error(
            "Invalid registry entry: missing city."
        );
    }

    if (
        typeof record.state !== "string"
    ) {
        throw new Error(
            "Invalid registry entry: missing state."
        );
    }

    if (
        typeof record.boundaryType !== "string"
    ) {
        throw new Error(
            "Invalid registry entry: missing boundaryType."
        );
    }

    if (
        typeof record.generatedFile !== "string"
    ) {
        throw new Error(
            "Invalid registry entry: missing generatedFile."
        );
    }

    return {
        placeFips:
            record.placeFips,

        city:
            record.city,

        state:
            normalizeState(
                record.state
            ),

        boundaryType:
            record.boundaryType as BoundaryType,

        source:
            validateSource(
                record.source
            ),

        generatedFile:
            record.generatedFile
    };
}


// =============================================================================
// Source validation
// =============================================================================

function validateSource(
    value: unknown
): MunicipalDistrictSource {

    if (
        typeof value !== "object" ||
        value === null
    ) {
        throw new Error(
            "Invalid registry source: expected an object."
        );
    }

    const record =
        value as Record<string, unknown>;

    if (
        typeof record.sourceType !== "string"
    ) {
        throw new Error(
            "Invalid registry source: missing sourceType."
        );
    }

    if (
        typeof record.url !== "string"
    ) {
        throw new Error(
            "Invalid registry source: missing url."
        );
    }

    if (
        typeof record.fieldMapping !== "object" ||
        record.fieldMapping === null
    ) {
        throw new Error(
            "Invalid registry source: missing fieldMapping."
        );
    }

    const mapping =
        record.fieldMapping as Record<
            string,
            unknown
        >;

    if (
        typeof mapping.district !== "string"
    ) {
        throw new Error(
            "Invalid registry source: missing fieldMapping.district."
        );
    }

    return {
        sourceType:
            record.sourceType,

        url:
            record.url,

        title:
            typeof record.title === "string"
                ? record.title
                : undefined,

        official:
            typeof record.official === "boolean"
                ? record.official
                : undefined,

        verified:
            typeof record.verified === "boolean"
                ? record.verified
                : undefined,

        lastVerified:
            typeof record.lastVerified === "string"
                ? record.lastVerified
                : undefined,

        format:
            typeof record.format === "string"
                ? record.format
                : undefined,

        fieldMapping: {
            district:
                mapping.district,

            name:
                typeof mapping.name === "string"
                    ? mapping.name
                    : undefined
        }
    };
}


// =============================================================================
// State normalization
// =============================================================================

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


// =============================================================================
// Name normalization
// =============================================================================

function normalizeName(
    value: string
): string {

    return value
        .normalize("NFKD")
        .replace(
            /[\u0300-\u036f]/g,
            ""
        )
        .toLowerCase()
        .replace(
            /['’]/g,
            ""
        )
        .replace(
            /[-]/g,
            " "
        )
        .replace(
            /[^\p{L}\p{N}\s]/gu,
            " "
        )
        .replace(
            /\s+/g,
            " "
        )
        .trim();
}


// =============================================================================
// State normalization
// =============================================================================

function normalizeState(
    value: string
): string {

    const normalized =
        value
            .trim()
            .toUpperCase();

    return (
        STATE_NAMES[normalized] ??
        normalized
    );
}