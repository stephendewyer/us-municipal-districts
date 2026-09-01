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
 * Validate the generated municipal district registry.
 *
 * This performs structural validation of registry.json.
 *
 * It does not make network requests. ArcGIS source validation
 * belongs to the discovery pipeline.
 */
export async function validateRegistry(): Promise<RegistryValidationResult> {

    const registryPath =
        path.resolve(
            "data",
            "registry.json"
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


    let registry: unknown;


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


    const result =
        validateRegistryData(
            registry
        );


    printValidationResult(
        result
    );


    if (!result.valid) {

        /*
         * Make the CLI command fail when the registry
         * contains structural errors.
         */
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

    const errors: string[] = [];

    const warnings: string[] = [];


    // =========================================================================
    // Top-level object
    // =========================================================================

    if (
        !isObject(value)
    ) {

        return {

            valid: false,

            entries: 0,

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

            valid: false,

            entries: 0,

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
                placeFips
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
    placeFips: Set<string>
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