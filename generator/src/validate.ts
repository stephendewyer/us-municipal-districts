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

const REGISTRY_PATH =
    path.resolve(
        __dirname,
        "../../data/municipalities"
    );


// =============================================================================
// Public API
// =============================================================================

/**
 * Validate all generated municipal registry entries.
 *
 * This validates the structure of the generated JSON files and checks
 * important fields such as:
 *
 * - place FIPS
 * - city
 * - state
 * - district type
 * - ArcGIS source URL
 * - district field
 * - generated timestamp
 */
export async function validateRegistry(): Promise<void> {

    console.log(
        "\nValidating municipal registry...\n"
    );

    if (!fs.existsSync(REGISTRY_PATH)) {

        throw new Error(
            `Registry directory not found: ${REGISTRY_PATH}`
        );
    }

    const files =
        findJsonFiles(REGISTRY_PATH);

    if (files.length === 0) {

        throw new Error(
            `No registry entries found in ${REGISTRY_PATH}`
        );
    }

    let valid = 0;
    let invalid = 0;

    for (const file of files) {

        try {

            const entry =
                loadRegistryEntry(file);

            validateRegistryEntry(
                entry,
                file
            );

            console.log(
                `✓ ${path.relative(
                    REGISTRY_PATH,
                    file
                )}`
            );

            valid++;

        } catch (error) {

            console.error(
                `✗ ${path.relative(
                    REGISTRY_PATH,
                    file
                )}`
            );

            console.error(
                `  ${error instanceof Error
                    ? error.message
                    : String(error)}`
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
// File discovery
// =============================================================================

function findJsonFiles(
    directory: string
): string[] {

    const results: string[] = [];

    const entries =
        fs.readdirSync(
            directory,
            {
                withFileTypes: true
            }
        );

    for (const entry of entries) {

        const fullPath =
            path.join(
                directory,
                entry.name
            );

        if (entry.isDirectory()) {

            results.push(
                ...findJsonFiles(fullPath)
            );

            continue;
        }

        if (
            entry.isFile() &&
            entry.name.endsWith(".json")
        ) {

            results.push(fullPath);
        }
    }

    return results.sort();
}


// =============================================================================
// Loading
// =============================================================================

function loadRegistryEntry(
    file: string
): RegistryEntry {

    const contents =
        fs.readFileSync(
            file,
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
            "Registry entry must be a JSON object."
        );
    }

    return parsed as RegistryEntry;
}


// =============================================================================
// Registry entry validation
// =============================================================================

function validateRegistryEntry(
    entry: RegistryEntry,
    file: string
): void {

    // -------------------------------------------------------------------------
    // Place FIPS
    // -------------------------------------------------------------------------

    if (
        typeof entry.placeFips !== "string" ||
        !/^\d{7}$/.test(entry.placeFips)
    ) {

        throw new Error(
            "placeFips must be a 7-digit Census place GEOID."
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
            "city is required."
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
            "state must be a two-letter abbreviation."
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
            `Invalid districtType: ${String(
                entry.districtType
            )}`
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
            "source is required."
        );
    }


    if (
        typeof entry.source.url !== "string" ||
        !isHttpUrl(entry.source.url)
    ) {

        throw new Error(
            "source.url must be a valid HTTP or HTTPS URL."
        );
    }


    if (
        entry.source.serviceType !==
            "FeatureServer" &&
        entry.source.serviceType !==
            "MapServer"
    ) {

        throw new Error(
            "source.serviceType must be FeatureServer or MapServer."
        );
    }


    if (
        typeof entry.source.title !== "string" ||
        entry.source.title.trim() === ""
    ) {

        throw new Error(
            "source.title is required."
        );
    }


    if (
        typeof entry.source.official !== "boolean"
    ) {

        throw new Error(
            "source.official must be a boolean."
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
            "fields is required."
        );
    }


    if (
        typeof entry.fields.district !== "string" ||
        entry.fields.district.trim() === ""
    ) {

        throw new Error(
            "fields.district is required."
        );
    }


    if (
        entry.fields.name !== undefined &&
        typeof entry.fields.name !== "string"
    ) {

        throw new Error(
            "fields.name must be a string when provided."
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
            "metadata is required."
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
            "metadata.generatedAt must be a valid date."
        );
    }


    if (
        typeof entry.metadata.requiresReview !== "boolean"
    ) {

        throw new Error(
            "metadata.requiresReview must be a boolean."
        );
    }


    // -------------------------------------------------------------------------
    // File name sanity check
    // -------------------------------------------------------------------------

    validateFileName(
        file,
        entry
    );
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


// =============================================================================
// File name validation
// =============================================================================

function validateFileName(
    file: string,
    entry: RegistryEntry
): void {

    const filename =
        path.basename(
            file,
            ".json"
        );

    /*
     * This is intentionally a warning rather than an error because
     * registry.ts may use a different naming convention.
     */
    const expected =
        `${entry.state.toLowerCase()}-${
            slugify(entry.city)
        }`;

    if (
        filename !== expected
    ) {

        console.warn(
            `  Warning: filename "${filename}.json" does not match ` +
            `expected "${expected}.json".`
        );
    }
}


// =============================================================================
// Slugification
// =============================================================================

function slugify(
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
            /[^a-z0-9]+/g,
            "-"
        )
        .replace(
            /^-+|-+$/g,
            ""
        );
}