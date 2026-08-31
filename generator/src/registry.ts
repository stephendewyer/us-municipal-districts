import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type {
    CanonicalSource,
    CensusPlace,
    DiscoveryResult,
    DistrictType,
    RegistryEntry
} from "./types.js";


// =============================================================================
// Paths
// =============================================================================

const __filename =
    fileURLToPath(import.meta.url);

const __dirname =
    path.dirname(__filename);


/**
 * generator/src
 */
const GENERATOR_SRC_DIR =
    __dirname;


/**
 * Repository root.
 *
 * generator/src/registry.ts
 *        ↑
 * generator/src
 *        ↑
 * generator
 *        ↑
 * repository root
 */
const ROOT_DIR =
    path.resolve(
        GENERATOR_SRC_DIR,
        "../.."
    );


const REGISTRY_DIR =
    path.join(
        ROOT_DIR,
        "data",
        "municipalities"
    );


const REGISTRY_PATH =
    path.join(
        REGISTRY_DIR,
        "registry.json"
    );


// =============================================================================
// Public registry format
// =============================================================================

export interface GeneratedRegistry {
    version: string;

    generatedAt: string;

    entries: RegistryEntry[];
}


// =============================================================================
// Generator version
// =============================================================================

const GENERATOR_VERSION =
    "0.1.0";


// =============================================================================
// Build registry
// =============================================================================

/**
 * Build the municipality registry from discovery results.
 *
 * This function expects discovery results to already contain a selected
 * canonical source.
 *
 * It does not perform:
 *
 * - Census discovery
 * - ArcGIS discovery
 * - ArcGIS inspection
 * - classification
 * - deduplication
 * - canonical selection
 */
export function buildRegistry(
    results: DiscoveryResult[] = []
): GeneratedRegistry {

    const generatedAt =
        new Date().toISOString();

    const entries: RegistryEntry[] = [];

    for (const result of results) {

        if (!result.canonical) {
            continue;
        }

        const entry =
            createRegistryEntry(
                result.place,
                result.canonical,
                generatedAt
            );

        entries.push(entry);
    }

    /*
     * Keep registry ordering deterministic.
     *
     * This makes generated JSON easier to review in Git and prevents
     * otherwise identical builds from producing noisy diffs.
     */
    entries.sort(compareRegistryEntries);

    return {
        version: GENERATOR_VERSION,
        generatedAt,
        entries
    };
}


// =============================================================================
// Write registry
// =============================================================================

/**
 * Build and write the registry to:
 *
 * data/municipalities/registry.json
 */
export function writeRegistry(
    results: DiscoveryResult[]
): GeneratedRegistry {

    const registry =
        buildRegistry(results);

    fs.mkdirSync(
        REGISTRY_DIR,
        {
            recursive: true
        }
    );

    fs.writeFileSync(
        REGISTRY_PATH,
        JSON.stringify(
            registry,
            null,
            2
        ) + "\n",
        "utf8"
    );

    return registry;
}


// =============================================================================
// Create registry entry
// =============================================================================

function createRegistryEntry(
    place: CensusPlace,
    canonical: CanonicalSource,
    generatedAt: string
): RegistryEntry {

    return {
        placeFips:
            place.placeFips,

        city:
            place.city,

        state:
            place.state,

        districtType:
            canonical.districtType,

        source: {
            url:
                canonical.url,

            ...(canonical.itemId
                ? {
                    itemId:
                        canonical.itemId
                }
                : {}),

            serviceType:
                canonical.serviceType,

            title:
                canonical.title,

            official:
                canonical.officialMunicipalSource
        },

        fields: {
            district:
                canonical.districtField,

            ...(canonical.nameField
                ? {
                    name:
                        canonical.nameField
                }
                : {})
        },

        metadata: {
            generatedAt,

            generatorVersion:
                GENERATOR_VERSION,

            alternatives:
                canonical.alternatives,

            requiresReview:
                canonical.requiresReview
        }
    };
}


// =============================================================================
// Sorting
// =============================================================================

function compareRegistryEntries(
    a: RegistryEntry,
    b: RegistryEntry
): number {

    /*
     * Primary sort:
     * state
     */
    const stateComparison =
        a.state.localeCompare(
            b.state
        );

    if (stateComparison !== 0) {
        return stateComparison;
    }

    /*
     * Secondary sort:
     * city
     */
    const cityComparison =
        a.city.localeCompare(
            b.city
        );

    if (cityComparison !== 0) {
        return cityComparison;
    }

    /*
     * Tertiary sort:
     * district type
     */
    const typeComparison =
        a.districtType.localeCompare(
            b.districtType
        );

    if (typeComparison !== 0) {
        return typeComparison;
    }

    /*
     * Final deterministic key:
     * Census place FIPS
     */
    return a.placeFips.localeCompare(
        b.placeFips
    );
}


// =============================================================================
// Load generated registry
// =============================================================================

/**
 * Load an existing generated registry.
 *
 * Useful for validation and debugging.
 */
export function loadGeneratedRegistry(): GeneratedRegistry {

    if (!fs.existsSync(REGISTRY_PATH)) {
        throw new Error(
            `Registry not found: ${REGISTRY_PATH}`
        );
    }

    const contents =
        fs.readFileSync(
            REGISTRY_PATH,
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
            "Invalid registry: expected an object."
        );
    }

    const record =
        parsed as Record<string, unknown>;

    if (
        typeof record.version !== "string"
    ) {
        throw new Error(
            "Invalid registry: missing version."
        );
    }

    if (
        typeof record.generatedAt !== "string"
    ) {
        throw new Error(
            "Invalid registry: missing generatedAt."
        );
    }

    if (
        !Array.isArray(record.entries)
    ) {
        throw new Error(
            "Invalid registry: entries must be an array."
        );
    }

    return parsed as GeneratedRegistry;
}


// =============================================================================
// Utility
// =============================================================================

export function getRegistryPath(): string {
    return REGISTRY_PATH;
}
