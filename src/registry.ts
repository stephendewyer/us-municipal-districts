import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type {
    BoundaryType,
    MunicipalDistrictRegistry,
    MunicipalDistrictRegistryEntry,
    MunicipalDistrictSource,
    MunicipalDistrictMetadata,
    MunicipalDistrictAlternative
} from "./types.js";

export type {
    MunicipalDistrictRegistry,
    MunicipalDistrictRegistryEntry,
    MunicipalDistrictSource
};

export interface RegistrySearchOptions {
    city?: string;
    state?: string;
    placeFips?: string;
    boundaryType?: BoundaryType;
}


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
    options: RegistrySearchOptions  = {}
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
    options: RegistrySearchOptions = {}
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
    options: RegistrySearchOptions 
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
        !isBoundaryType(
            record.boundaryType
        )
    ) {
        throw new Error(
            `Invalid registry entry: unsupported boundaryType "${record.boundaryType}".`
        );
    }

    if (
        typeof record.generatedFile !== "string"
    ) {
        throw new Error(
            "Invalid registry entry: missing generatedFile."
        );
    }

    if (
        record.source === undefined
    ) {
        throw new Error(
            "Invalid registry entry: missing source."
        );
    }

    if (
        record.metadata === undefined
    ) {
        throw new Error(
            "Invalid registry entry: missing metadata."
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
            record.boundaryType,

        source:
            validateSource(
                record.source
            ),

        generatedFile:
            record.generatedFile,

        metadata:
            validateMetadata(
                record.metadata
            )
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
        record.sourceType !== "arcgis"
    ) {
        throw new Error(
            `Invalid registry source: unsupported sourceType "${record.sourceType}".`
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

    if (
        typeof record.official !== "boolean"
    ) {
        throw new Error(
            "Invalid registry source: official must be a boolean."
        );
    }

    if (
        typeof record.verified !== "boolean"
    ) {
        throw new Error(
            "Invalid registry source: verified must be a boolean."
        );
    }

    if (
        record.serviceType !== "FeatureServer" &&
        record.serviceType !== "MapServer"
    ) {
        throw new Error(
            "Invalid registry source: serviceType must be FeatureServer or MapServer."
        );
    }

    return {
        sourceType:
            "arcgis",

        url:
            record.url,

        itemId:
            typeof record.itemId === "string"
                ? record.itemId
                : undefined,

        serviceType:
            record.serviceType,

        title:
            typeof record.title === "string"
                ? record.title
                : undefined,

        official:
            typeof record.official === "boolean"
                ? record.official
                : false,

        verified:
            typeof record.verified === "boolean"
                ? record.verified
                : false,

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
// Metadata validation
// =============================================================================

function validateMetadata(
    value: unknown
): MunicipalDistrictMetadata {

    if (
        typeof value !== "object" ||
        value === null
    ) {
        throw new Error(
            "Invalid registry metadata: expected an object."
        );
    }

    const record =
        value as Record<string, unknown>;

    if (
        typeof record.generatedAt !== "string"
    ) {
        throw new Error(
            "Invalid registry metadata: missing generatedAt."
        );
    }

    if (
        typeof record.generatorVersion !== "string"
    ) {
        throw new Error(
            "Invalid registry metadata: missing generatorVersion."
        );
    }

    if (
        typeof record.requiresReview !== "boolean"
    ) {
        throw new Error(
            "Invalid registry metadata: requiresReview must be a boolean."
        );
    }

    let alternatives:
        MunicipalDistrictAlternative[] = [];

    if (
        record.alternatives !== undefined
    ) {

        if (
            !Array.isArray(
                record.alternatives
            )
        ) {
            throw new Error(
                "Invalid registry metadata: alternatives must be an array."
            );
        }

        alternatives =
            record.alternatives.map(
                validateAlternative
            );
    }

    return {
        generatedAt:
            record.generatedAt,

        generatorVersion:
            record.generatorVersion,

        alternatives,

        requiresReview:
            record.requiresReview
    };
}


// =============================================================================
// Alternative source validation
// =============================================================================

function validateAlternative(
    value: unknown
): MunicipalDistrictAlternative {

    if (
        typeof value !== "object" ||
        value === null
    ) {
        throw new Error(
            "Invalid registry alternative: expected an object."
        );
    }

    const record =
        value as Record<string, unknown>;

    if (
        typeof record.url !== "string"
    ) {
        throw new Error(
            "Invalid registry alternative: missing url."
        );
    }

    if (
        typeof record.official !== "boolean"
    ) {
        throw new Error(
            "Invalid registry alternative: official must be a boolean."
        );
    }

    if (
        typeof record.score !== "number"
    ) {
        throw new Error(
            "Invalid registry alternative: score must be a number."
        );
    }

    return {
        url:
            record.url,

        itemId:
            typeof record.itemId === "string"
                ? record.itemId
                : undefined,

        title:
            typeof record.title === "string"
                ? record.title
                : undefined,

        serviceType:
            record.serviceType === "FeatureServer" ||
            record.serviceType === "MapServer" ||
            record.serviceType === "unknown"
                ? record.serviceType
                : "unknown",

        official:
            typeof record.official === "boolean"
                ? record.official
                : false,

        score:
            typeof record.score === "number"
                ? record.score
                : 0
    };
}


// =============================================================================
// Boundary type validation
// =============================================================================

function isBoundaryType(
    value: string
): value is BoundaryType {

    return (
        value === "ward" ||
        value === "council-district" ||
        value === "city-council-district" ||
        value === "aldermanic-district" ||
        value === "municipal-district"
    );
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