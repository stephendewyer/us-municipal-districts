import fs from "node:fs";
import path from "node:path";

import type {
    RegistryEntry,
    RegistrySource,
    RegistryFields,
    RegistryMetadata,
    DistrictType,
    ArcGISServiceType
} from "./types.js";


// =============================================================================
// Registry validation result
// =============================================================================

export interface RegistryValidationResult {

    valid: boolean;

    entries: number;

    errors: string[];

    warnings: string[];
}


// =============================================================================
// Public API
// =============================================================================

/**
 * Validate the production municipal district registry.
 *
 * Uses:
 *
 * data/municipalities/registry.json
 */
export async function validateRegistry():
    Promise<RegistryValidationResult> {

    return validateRegistryFile(
        path.resolve(
            "data",
            "municipalities",
            "registry.json"
        )
    );
}


/**
 * Validate a registry at an explicit filesystem path.
 *
 * This is useful for:
 *
 * - smoke tests
 * - temporary registries
 * - CI validation
 * - debugging generated datasets
 *
 * The registry path may be absolute or relative to the
 * current working directory.
 */
export async function validateRegistryFile(
    registryFilePath: string
): Promise<RegistryValidationResult> {

    const registryPath =
        path.resolve(
            registryFilePath
        );


    if (
        !fs.existsSync(
            registryPath
        )
    ) {

        throw new Error(
            `Registry file not found: ${registryPath}`
        );
    }


    const contents =
        fs.readFileSync(
            registryPath,
            "utf8"
        );


    let registry:
        unknown;


    try {

        registry =
            JSON.parse(
                contents
            );

    } catch (error) {

        throw new Error(
            `Registry contains invalid JSON: ${
                error instanceof Error
                    ? error.message
                    : String(error)
            }`
        );
    }


    /*
     * Generated geometry paths in the registry are relative
     * to the repository data directory.
     */
    const dataRoot =
        path.resolve(
            "data"
        );


    const result =
        validateRegistryDataAtPath(
            registry,
            dataRoot
        );


    printValidationResult(
        result
    );


    if (
        !result.valid
    ) {

        throw new Error(
            `Registry validation failed with ${
                result.errors.length
            } error${
                result.errors.length === 1
                    ? ""
                    : "s"
            }.`
        );
    }


    return result;
}


// =============================================================================
// Validate registry object
// =============================================================================

export function validateRegistryData(
    value: unknown
): RegistryValidationResult {

    return validateRegistryDataAtPath(
        value,
        path.resolve(
            "data"
        )
    );
}


// =============================================================================
// Validate registry object at path
// =============================================================================

function validateRegistryDataAtPath(
    value: unknown,
    dataRoot: string
): RegistryValidationResult {

    const errors:
        string[] = [];

    const warnings:
        string[] = [];


    // =========================================================================
    // Top-level object
    // =========================================================================

    if (
        !isObject(value)
    ) {

        return {

            valid:
                false,

            entries:
                0,

            errors: [
                "Registry must be a JSON object."
            ],

            warnings: []
        };
    }


    // =========================================================================
    // Entries
    // =========================================================================

    const entries =
        value.entries;


    if (
        !Array.isArray(entries)
    ) {

        return {

            valid:
                false,

            entries:
                0,

            errors: [
                "Registry.entries must be an array."
            ],

            warnings: []
        };
    }


    // =========================================================================
    // Validate entries
    // =========================================================================

    const placeFips =
        new Set<string>();


    entries.forEach(
        (
            entry,
            index
        ) => {

            validateEntry(
                entry,
                index,
                errors,
                warnings,
                placeFips,
                dataRoot
            );
        }
    );


    return {

        valid:
            errors.length === 0,

        entries:
            entries.length,

        errors,

        warnings
    };
}


// =============================================================================
// Validate registry entry
// =============================================================================

function validateEntry(
    value: unknown,
    index: number,
    errors: string[],
    warnings: string[],
    placeFips: Set<string>,
    dataRoot: string
): void {

    const prefix =
        `entries[${index}]`;


    if (
        !isObject(value)
    ) {

        errors.push(
            `${prefix} must be an object.`
        );

        return;
    }


    const entry =
        value as Partial<RegistryEntry>;


    // =========================================================================
    // Required basic fields
    // =========================================================================

    if (
        !isNonEmptyString(
            entry.placeFips
        )
    ) {

        errors.push(
            `${prefix}.placeFips is required.`
        );

    }
    else {

        if (
            placeFips.has(
                entry.placeFips
            )
        ) {

            errors.push(
                `${prefix}.placeFips "${entry.placeFips}" is duplicated.`
            );

        }
        else {

            placeFips.add(
                entry.placeFips
            );
        }


        if (
            !/^\d{7}$/.test(
                entry.placeFips
            )
        ) {

            errors.push(
                `${prefix}.placeFips must be a 7-digit Census place GEOID.`
            );
        }
    }


    if (
        !isNonEmptyString(
            entry.city
        )
    ) {

        errors.push(
            `${prefix}.city is required.`
        );
    }


    if (
        !isNonEmptyString(
            entry.state
        )
    ) {

        errors.push(
            `${prefix}.state is required.`
        );
    }


    if (
        !isDistrictType(
            entry.boundaryType
        )
    ) {

        errors.push(
            `${prefix}.districtType is invalid.`
        );
    }


    // =========================================================================
    // Source
    // =========================================================================

    validateSource(
        entry.source,
        prefix,
        errors
    );


    // =========================================================================
    // Fields
    // =========================================================================

    validateFields(
        entry.source?.fieldMapping,
        prefix,
        errors
    );


    // =========================================================================
    // Metadata
    // =========================================================================

    validateMetadata(
        entry.metadata,
        prefix,
        errors
    );


    // =========================================================================
    // Generated geometry
    // =========================================================================

    validateGeneratedGeometryFile(
        entry,
        prefix,
        errors,
        dataRoot
    );


    // =========================================================================
    // Warnings
    // =========================================================================

    if (
        isObject(entry.metadata) &&
        entry.metadata.requiresReview === true
    ) {

        warnings.push(
            `${prefix} requires manual review.`
        );
    }
}


// =============================================================================
// Validate source
// =============================================================================

function validateSource(
    value: unknown,
    prefix: string,
    errors: string[]
): void {

    if (
        !isObject(value)
    ) {

        errors.push(
            `${prefix}.source must be an object.`
        );

        return;
    }


    const source =
        value as Partial<RegistrySource>;


    if (
        !isNonEmptyString(
            source.url
        )
    ) {

        errors.push(
            `${prefix}.source.url is required.`
        );

    }
    else {

        if (
            !isArcGISUrl(
                source.url
            )
        ) {

            errors.push(
                `${prefix}.source.url does not appear to be an ArcGIS REST URL.`
            );
        }
    }


    if (
        !isServiceType(
            source.serviceType
        )
    ) {

        errors.push(
            `${prefix}.source.serviceType is invalid.`
        );
    }


    if (
        !isNonEmptyString(
            source.title
        )
    ) {

        errors.push(
            `${prefix}.source.title is required.`
        );
    }


    if (
        typeof source.official !== "boolean"
    ) {

        errors.push(
            `${prefix}.source.official must be boolean.`
        );
    }
}


// =============================================================================
// Validate fields
// =============================================================================

function validateFields(
    value: unknown,
    prefix: string,
    errors: string[]
): void {

    if (
        !isObject(value)
    ) {

        errors.push(
            `${prefix}.fields must be an object.`
        );

        return;
    }


    const fields =
        value as Partial<RegistryFields>;


    if (
        !isNonEmptyString(
            fields.district
        )
    ) {

        errors.push(
            `${prefix}.fields.district is required.`
        );
    }


    if (
        fields.name !== undefined &&
        !isNonEmptyString(
            fields.name
        )
    ) {

        errors.push(
            `${prefix}.fields.name must be a non-empty string when present.`
        );
    }
}


// =============================================================================
// Validate metadata
// =============================================================================

function validateMetadata(
    value: unknown,
    prefix: string,
    errors: string[]
): void {

    if (
        !isObject(value)
    ) {

        errors.push(
            `${prefix}.metadata must be an object.`
        );

        return;
    }


    const metadata =
        value as Partial<RegistryMetadata>;


    if (
        !isNonEmptyString(
            metadata.generatedAt
        )
    ) {

        errors.push(
            `${prefix}.metadata.generatedAt is required.`
        );
    }


    if (
        typeof metadata.requiresReview !== "boolean"
    ) {

        errors.push(
            `${prefix}.metadata.requiresReview must be boolean.`
        );
    }


    if (
        metadata.generatorVersion !== undefined &&
        !isNonEmptyString(
            metadata.generatorVersion
        )
    ) {

        errors.push(
            `${prefix}.metadata.generatorVersion must be a string.`
        );
    }


    if (
        metadata.alternatives !== undefined &&
        !Array.isArray(
            metadata.alternatives
        )
    ) {

        errors.push(
            `${prefix}.metadata.alternatives must be an array.`
        );
    }
}


// =============================================================================
// Validate generated geometry
// =============================================================================

interface GeneratedGeometryFeature {
    type?: unknown;
    properties?: unknown;
    geometry?: unknown;
}


interface GeneratedGeometryFeatureCollection {
    type?: unknown;
    features?: unknown;
}


function validateGeneratedGeometryFile(
    entry: Partial<RegistryEntry>,
    prefix: string,
    errors: string[],
    dataRoot: string
): void {

    if (
        !isNonEmptyString(
            entry.generatedFile
        )
    ) {

        errors.push(
            `${prefix}.generatedFile is required.`
        );

        return;
    }


    const geometryPath =
        path.resolve(
            dataRoot,
            entry.generatedFile
        );


    /*
     * Prevent generatedFile from escaping the data directory.
     */
    const relativePath =
        path.relative(
            dataRoot,
            geometryPath
        );


    if (
        relativePath === ".." ||
        relativePath.startsWith(
            `..${path.sep}`
        ) ||
        path.isAbsolute(
            relativePath
        )
    ) {

        errors.push(
            `${prefix}.generatedFile must resolve inside the data directory.`
        );

        return;
    }


    if (
        !fs.existsSync(
            geometryPath
        )
    ) {

        errors.push(
            `${prefix}.generatedFile does not exist: ${geometryPath}`
        );

        return;
    }


    let contents:
        string;

    try {

        contents =
            fs.readFileSync(
                geometryPath,
                "utf8"
            );

    } catch (error) {

        errors.push(
            `${prefix}.generatedFile could not be read: ${
                error instanceof Error
                    ? error.message
                    : String(error)
            }`
        );

        return;
    }


    let geometry:
        unknown;

    try {

        geometry =
            JSON.parse(
                contents
            );

    } catch (error) {

        errors.push(
            `${prefix}.generatedFile contains invalid JSON: ${
                error instanceof Error
                    ? error.message
                    : String(error)
            }`
        );

        return;
    }


    validateGeneratedGeometry(
        geometry,
        entry,
        prefix,
        errors
    );
}


// =============================================================================
// Validate generated geometry object
// =============================================================================

function validateGeneratedGeometry(
    value: unknown,
    entry: Partial<RegistryEntry>,
    prefix: string,
    errors: string[]
): void {

    if (
        !isObject(value)
    ) {

        errors.push(
            `${prefix}.generatedFile must contain a JSON object.`
        );

        return;
    }


    const collection =
        value as GeneratedGeometryFeatureCollection;


    if (
        collection.type !==
        "FeatureCollection"
    ) {

        errors.push(
            `${prefix}.generatedFile must contain a GeoJSON FeatureCollection.`
        );

        return;
    }


    if (
        !Array.isArray(
            collection.features
        )
    ) {

        errors.push(
            `${prefix}.generatedFile.features must be an array.`
        );

        return;
    }


    if (
        collection.features.length === 0
    ) {

        errors.push(
            `${prefix}.generatedFile contains no features.`
        );

        return;
    }


    for (
        let i = 0;
        i < collection.features.length;
        i++
    ) {

        validateGeneratedFeature(
            collection.features[i],
            entry,
            prefix,
            i,
            errors
        );
    }
}


// =============================================================================
// Validate generated feature
// =============================================================================

function validateGeneratedFeature(
    value: unknown,
    entry: Partial<RegistryEntry>,
    prefix: string,
    index: number,
    errors: string[]
): void {

    const featurePrefix =
        `${prefix}.generatedFile.features[${index}]`;


    if (
        !isObject(value)
    ) {

        errors.push(
            `${featurePrefix} must be an object.`
        );

        return;
    }


    const feature =
        value as GeneratedGeometryFeature;


    if (
        feature.type !==
        "Feature"
    ) {

        errors.push(
            `${featurePrefix}.type must be "Feature".`
        );
    }


    // =========================================================================
    // Properties
    // =========================================================================

    if (
        !isObject(
            feature.properties
        )
    ) {

        errors.push(
            `${featurePrefix}.properties must be an object.`
        );

    } else {

        const properties =
            feature.properties;


        if (
            properties.placeFips !==
            entry.placeFips
        ) {

            errors.push(
                `${featurePrefix}.properties.placeFips must equal the registry placeFips.`
            );
        }


        if (
            properties.city !==
            entry.city
        ) {

            errors.push(
                `${featurePrefix}.properties.city must equal the registry city.`
            );
        }


        if (
            properties.state !==
            entry.state
        ) {

            errors.push(
                `${featurePrefix}.properties.state must equal the registry state.`
            );
        }


        if (
            properties.boundaryType !==
            entry.boundaryType
        ) {

            errors.push(
                `${featurePrefix}.properties.boundaryType must equal the registry boundaryType.`
            );
        }


        if (
            !isNonEmptyString(
                properties.district
            )
        ) {

            errors.push(
                `${featurePrefix}.properties.district is required.`
            );
        }
    }


    // =========================================================================
    // Geometry
    // =========================================================================

    if (
        !isObject(
            feature.geometry
        )
    ) {

        errors.push(
            `${featurePrefix}.geometry must be an object.`
        );

        return;
    }


    const geometry =
        feature.geometry as Record<string, unknown>;


    if (
        geometry.type !== "Polygon" &&
        geometry.type !== "MultiPolygon"
    ) {

        errors.push(
            `${featurePrefix}.geometry.type must be "Polygon" or "MultiPolygon".`
        );
    }


    if (
        !Array.isArray(
            geometry.coordinates
        )
    ) {

        errors.push(
            `${featurePrefix}.geometry.coordinates must be an array.`
        );
    }
}


// =============================================================================
// Type helpers
// =============================================================================

function isObject(
    value: unknown
): value is Record<string, any> {

    return (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
    );
}


function isNonEmptyString(
    value: unknown
): value is string {

    return (
        typeof value === "string" &&
        value.trim().length > 0
    );
}


function isDistrictType(
    value: unknown
): value is DistrictType {

    return (
        value === "ward" ||
        value === "council-district" ||
        value === "aldermanic-district" ||
        value === "municipal-district"
    );
}


function isServiceType(
    value: unknown
): value is ArcGISServiceType {

    return (
        value === "FeatureServer" ||
        value === "MapServer" ||
        value === "unknown"
    );
}


function isArcGISUrl(
    value: string
): boolean {

    try {

        const url =
            new URL(
                value
            );


        return (
            /^https?:$/.test(
                url.protocol
            ) &&
            /\/(FeatureServer|MapServer)(?:\/\d+)?/i.test(
                url.pathname
            )
        );

    } catch {

        return false;
    }
}


// =============================================================================
// CLI output
// =============================================================================

function printValidationResult(
    result: RegistryValidationResult
): void {

    console.log(
        "\nRegistry validation"
    );


    console.log(
        `  Entries: ${result.entries}`
    );


    console.log(
        `  Errors: ${result.errors.length}`
    );


    console.log(
        `  Warnings: ${result.warnings.length}`
    );


    if (
        result.errors.length > 0
    ) {

        console.log(
            "\nErrors:"
        );


        for (
            const error of
            result.errors
        ) {

            console.log(
                `  ✗ ${error}`
            );
        }
    }


    if (
        result.warnings.length > 0
    ) {

        console.log(
            "\nWarnings:"
        );


        for (
            const warning of
            result.warnings
        ) {

            console.log(
                `  ⚠ ${warning}`
            );
        }
    }


    if (
        result.valid
    ) {

        console.log(
            "\n✓ Registry is valid."
        );
    }
}