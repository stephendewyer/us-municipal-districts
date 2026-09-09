import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type {
    CanonicalSource,
    CensusPlace,
    DiscoveryResult,
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
        __dirname,
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
 *
 * This function builds a registry containing only the supplied discovery
 * results. Use writeRegistry() when updating the persistent registry so
 * existing municipalities are preserved.
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
    entries.sort(
        compareRegistryEntries
    );

    return {
        version:
            GENERATOR_VERSION,

        generatedAt,

        entries
    };
}


// =============================================================================
// Persistent registry merge
// =============================================================================

/**
 * Merge newly discovered municipalities into the existing registry.
 *
 * Only municipalities represented by the current discovery results are
 * replaced. Existing entries for all other municipalities are preserved.
 *
 * This allows commands such as:
 *
 *   npm run discover -- --city "Chicago" --state "IL"
 *
 * followed by:
 *
 *   npm run discover -- --city "Tucson" --state "AZ"
 *
 * without deleting Chicago from the registry.
 */
function mergeRegistry(
    existingRegistry:
        GeneratedRegistry | undefined,
    discoveredRegistry:
        GeneratedRegistry
): GeneratedRegistry {

    /*
     * No existing registry means there is nothing to merge with.
     */
    if (!existingRegistry) {
        return discoveredRegistry;
    }

    /*
     * Determine which municipalities are represented by this discovery run.
     *
     * We use placeFips as the primary identity because it uniquely identifies
     * a Census place.
     *
     * A municipality can potentially have more than one boundary type, so
     * we remove entries by placeFips + boundaryType rather than placeFips
     * alone.
     */
    const discoveredKeys =
        new Set(
            discoveredRegistry.entries.map(
                entry =>
                    makeRegistryEntryKey(
                        entry
                    )
            )
        );

    /*
     * Preserve existing entries that were not part of this discovery run.
     */
    const preservedEntries =
        existingRegistry.entries.filter(
            entry =>
                !discoveredKeys.has(
                    makeRegistryEntryKey(
                        entry
                    )
                )
        );

    /*
     * Add the newly discovered entries.
     */
    const mergedEntries = [
        ...preservedEntries,
        ...discoveredRegistry.entries
    ];

    /*
     * Keep the complete registry deterministic.
     */
    mergedEntries.sort(
        compareRegistryEntries
    );

    return {
        version:
            GENERATOR_VERSION,

        generatedAt:
            discoveredRegistry.generatedAt,

        entries:
            mergedEntries
    };
}


/**
 * Build a stable identity key for a registry entry.
 *
 * A municipality may have multiple boundary types, so placeFips alone is
 * intentionally not sufficient.
 */
function makeRegistryEntryKey(
    entry: RegistryEntry
): string {

    return [
        entry.placeFips,
        entry.boundaryType
    ].join(
        "::"
    );
}


// =============================================================================
// Registry comparison
// =============================================================================

function registriesAreSubstantivelyEqual(
    existing:
        GeneratedRegistry,
    generated:
        GeneratedRegistry
): boolean {

    return (
        JSON.stringify(
            normalizeRegistryForComparison(
                existing
            )
        ) ===
        JSON.stringify(
            normalizeRegistryForComparison(
                generated
            )
        )
    );
}


function normalizeRegistryForComparison(
    registry:
        GeneratedRegistry
): GeneratedRegistry {

    return {
        ...registry,

        /*
         * Registry generation timestamps are intentionally ignored
         * when determining whether substantive data changed.
         */
        generatedAt:
            "",

        entries:
            registry.entries.map(
                entry => ({
                    ...entry,

                    metadata: {
                        ...entry.metadata,

                        generatedAt:
                            ""
                    }
                })
            )
    };
}


// =============================================================================
// Write registry
// =============================================================================

/**
 * Build and write the registry to:
 *
 * data/municipalities/registry.json
 *
 * Newly discovered municipalities replace their existing entries while
 * municipalities not included in the current discovery run are preserved.
 */
export function writeRegistry(
    results: DiscoveryResult[]
): GeneratedRegistry {

    /*
     * Build the registry for the current discovery run.
     */
    const discoveredRegistry =
        buildRegistry(
            results
        );

    /*
     * Load the persistent registry, if one exists.
     */
    const existingRegistry =
        loadExistingRegistryForComparison();

    /*
     * Merge the current discovery results into the persistent registry.
     */
    const registry =
        mergeRegistry(
            existingRegistry,
            discoveredRegistry
        );

    fs.mkdirSync(
        REGISTRY_DIR,
        {
            recursive:
                true
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


function loadExistingRegistryForComparison():
    GeneratedRegistry | undefined {

    if (
        !fs.existsSync(
            REGISTRY_PATH
        )
    ) {

        return undefined;
    }

    return loadGeneratedRegistry();
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

        boundaryType:
            canonical.districtType,

        source: {
            sourceType:
                "arcgis",

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
                canonical.officialMunicipalSource,

            /*
             * A source selected by the canonical-selection stage has
             * already been inspected and accepted by the generator.
             */
            verified:
                true,

            fieldMapping: {
                district:
                    canonical.districtField,

                ...(canonical.nameField
                    ? {
                        name:
                            canonical.nameField
                    }
                    : {})
            }
        },

        generatedFile:
            `geometry/${place.placeFips}/${canonical.districtType}.geojson`,

        metadata: {
            generatedAt,

            generatorVersion:
                GENERATOR_VERSION,

            alternatives:
                canonical.alternatives.map(
                    alternative => ({
                        url:
                            alternative.url,

                        ...(alternative.itemId
                            ? {
                                itemId:
                                    alternative.itemId
                                }
                            : {}),

                        ...(alternative.title
                            ? {
                                title:
                                    alternative.title
                                }
                            : {}),

                        serviceType:
                            alternative.serviceType ??
                            "unknown",

                        /*
                         * Alternatives are not selected as the
                         * municipality's canonical source.
                         */
                        official:
                            false,

                        score:
                            alternative.score ??
                            0
                    })
                ),

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
     * boundary type
     */
    const typeComparison =
        a.boundaryType.localeCompare(
            b.boundaryType
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
export function loadGeneratedRegistry():
    GeneratedRegistry {

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

    let parsed: unknown;

    try {
        parsed =
            JSON.parse(contents);
    } catch (error) {
        throw new Error(
            `Invalid registry JSON: ${
                error instanceof Error
                    ? error.message
                    : String(error)
            }`
        );
    }

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