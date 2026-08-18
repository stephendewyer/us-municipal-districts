import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type {
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

const GENERATOR_SRC_DIR =
    __dirname;

const ROOT_DIR =
    path.resolve(
        GENERATOR_SRC_DIR,
        "../.."
    );

const REGISTRY_DIR =
    path.join(
        ROOT_DIR,
        "data"
    );

const REGISTRY_PATH =
    path.join(
        REGISTRY_DIR,
        "registry.json"
    )
// ==================================================================
// Public API
// =============================================================================

export async function validateRegistry(): Promise<void> {

    console.log(
        "\nValidating municipal registry...\n"
    );

    if (!fs.existsSync(REGISTRY_PATH)) {

        throw new Error(
            `Registry file not found: ${REGISTRY_PATH}`
        );
    }

    const registry =
        loadRegistry();

    let valid = 0;
    let invalid = 0;

    // =========================================================================
    // Validate registry metadata
    // =========================================================================

    if (
        typeof registry.version !== "string" ||
        registry.version.trim() === ""
    ) {

        throw new Error(
            "Registry version is missing."
        );
    }

    if (
        typeof registry.generatedAt !== "string" ||
        Number.isNaN(
            Date.parse(
                registry.generatedAt
            )
        )
    ) {

        throw new Error(
            "Registry generatedAt must be a valid date."
        );
    }

    if (
        !Array.isArray(registry.entries)
    ) {

        throw new Error(
            "Registry entries must be an array."
        );
    }

    // =========================================================================
    // Validate entries
    // =========================================================================

    for (
        let index = 0;
        index < registry.entries.length;
        index++
    ) {

        const entry =
            registry.entries[index];

        if (!entry) {
            continue;
        }

        try {

            validateRegistryEntry(
                entry,
                index
            );

            console.log(
                `✓ ${entry.state} — ${entry.city} — ` +
                `${entry.districtType}`
            );

            valid++;

        } catch (error) {

            console.error(
                `✗ Entry ${index + 1}`
            );

            console.error(
                `  ${
                    error instanceof Error
                        ? error.message
                        : String(error)
                }`
            );

            invalid++;
        }
    }

    console.log(
        `\nValidation complete: ${valid} valid, ${invalid} invalid.`
    );

    if (invalid > 0) {

        throw new Error(
            `${invalid} registry entr${
                invalid === 1
                    ? "y"
                    : "ies"
            } failed validation.`
        );
    }
}


// =============================================================================
// Registry loading
// =============================================================================

interface GeneratedRegistry {

    version: string;

    generatedAt: string;

    entries: RegistryEntry[];
}


function loadRegistry(): GeneratedRegistry {

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
            `Invalid JSON: ${
                error instanceof Error
                    ? error.message
                    : String(error)
            }`
        );
    }

    if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
    ) {

        throw new Error(
            "Registry must be a JSON object."
        );
    }

    const record =
        parsed as Record<string, unknown>;

    if (
        typeof record.version !== "string"
    ) {

        throw new Error(
            "Registry version is missing."
        );
    }

    if (
        typeof record.generatedAt !== "string"
    ) {

        throw new Error(
            "Registry generatedAt is missing."
        );
    }

    if (
        !Array.isArray(record.entries)
    ) {

        throw new Error(
            "Registry entries must be an array."
        );
    }

    return {
        version:
            record.version,

        generatedAt:
            record.generatedAt,

        entries:
            record.entries as RegistryEntry[]
    };
}


// =============================================================================
// Registry entry validation
// =============================================================================

function validateRegistryEntry(
    entry: RegistryEntry,
    index: number
): void {

    // -------------------------------------------------------------------------
    // Place FIPS
    // -------------------------------------------------------------------------

    if (
        typeof entry.placeFips !== "string" ||
        !/^\d{7}$/.test(entry.placeFips)
    ) {

        throw new Error(
            `Entry ${index + 1}: placeFips must be a ` +
            `7-digit Census place GEOID.`
        );
    }


    // -------------------------------------------------------------------------
    // City
    // -------------------------------------------------------------------------

    if (
        typeof entry.city !== "string" ||
        entry.city.trim() === ""
    ) {

        throw new Error(
            `Entry ${index + 1}: city is required.`
        );
    }


    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    if (
        typeof entry.state !== "string" ||
        !/^[A-Z]{2}$/.test(entry.state)
    ) {

        throw new Error(
            `Entry ${index + 1}: state must be a ` +
            `two-letter abbreviation.`
        );
    }


    // -------------------------------------------------------------------------
    // District type
    // -------------------------------------------------------------------------

    if (
        !isDistrictType(
            entry.districtType
        )
    ) {

        throw new Error(
            `Entry ${index + 1}: invalid districtType: ` +
            `${String(entry.districtType)}`
        );
    }


    // -------------------------------------------------------------------------
    // Source
    // -------------------------------------------------------------------------

    if (
        !entry.source ||
        typeof entry.source !== "object"
    ) {

        throw new Error(
            `Entry ${index + 1}: source is required.`
        );
    }


    if (
        typeof entry.source.url !== "string" ||
        !isHttpUrl(entry.source.url)
    ) {

        throw new Error(
            `Entry ${index + 1}: source.url must be a ` +
            `valid HTTP or HTTPS URL.`
        );
    }


    if (
        entry.source.serviceType !== "FeatureServer" &&
        entry.source.serviceType !== "MapServer"
    ) {

        throw new Error(
            `Entry ${index + 1}: source.serviceType must be ` +
            `FeatureServer or MapServer.`
        );
    }


    if (
        typeof entry.source.title !== "string" ||
        entry.source.title.trim() === ""
    ) {

        throw new Error(
            `Entry ${index + 1}: source.title is required.`
        );
    }


    if (
        typeof entry.source.official !== "boolean"
    ) {

        throw new Error(
            `Entry ${index + 1}: source.official must be a boolean.`
        );
    }


    // -------------------------------------------------------------------------
    // Fields
    // -------------------------------------------------------------------------

    if (
        !entry.fields ||
        typeof entry.fields !== "object"
    ) {

        throw new Error(
            `Entry ${index + 1}: fields is required.`
        );
    }


    if (
        typeof entry.fields.district !== "string" ||
        entry.fields.district.trim() === ""
    ) {

        throw new Error(
            `Entry ${index + 1}: fields.district is required.`
        );
    }


    if (
        entry.fields.name !== undefined &&
        typeof entry.fields.name !== "string"
    ) {

        throw new Error(
            `Entry ${index + 1}: fields.name must be a string ` +
            `when provided.`
        );
    }


    // -------------------------------------------------------------------------
    // Metadata
    // -------------------------------------------------------------------------

    if (
        !entry.metadata ||
        typeof entry.metadata !== "object"
    ) {

        throw new Error(
            `Entry ${index + 1}: metadata is required.`
        );
    }


    if (
        typeof entry.metadata.generatedAt !== "string" ||
        Number.isNaN(
            Date.parse(
                entry.metadata.generatedAt
            )
        )
    ) {

        throw new Error(
            `Entry ${index + 1}: metadata.generatedAt must be ` +
            `a valid date.`
        );
    }


    if (
        typeof entry.metadata.requiresReview !== "boolean"
    ) {

        throw new Error(
            `Entry ${index + 1}: metadata.requiresReview must be ` +
            `a boolean.`
        );
    }
}


// =============================================================================
// District type
// =============================================================================

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


// =============================================================================
// URL validation
// =============================================================================

function isHttpUrl(
    value: string
): boolean {

    try {

        const url =
            new URL(value);

        return (
            url.protocol === "http:" ||
            url.protocol === "https:"
        );

    } catch {

        return false;
    }
}