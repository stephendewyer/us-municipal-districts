import fs from "node:fs/promises";
import path from "node:path";

import {
    GENERATOR_DATA_DIR,
    PACKAGE_DATA_DIR
} from "./config.js";

import { normalizeGeoJSON } from "./normalize.js";

import type {
    MunicipalDistrictRegistry,
    MunicipalDistrictRegistryEntry
} from "../../src/types.js";


// -----------------------------------------------------------------------------
// Paths
// -----------------------------------------------------------------------------

const GENERATOR_REGISTRY_FILE = path.join(
    GENERATOR_DATA_DIR,
    "registry.json"
);

const PACKAGE_REGISTRY_FILE = path.join(
    PACKAGE_DATA_DIR,
    "registry.json"
);


// -----------------------------------------------------------------------------
// File helpers
// -----------------------------------------------------------------------------

async function ensureDirectory(
    directory: string
): Promise<void> {

    await fs.mkdir(
        directory,
        {
            recursive: true
        }
    );
}


async function readJSON<T>(
    file: string
): Promise<T> {

    const contents = await fs.readFile(
        file,
        "utf8"
    );

    return JSON.parse(contents) as T;
}


async function writeJSON(
    file: string,
    data: unknown
): Promise<void> {

    await ensureDirectory(
        path.dirname(file)
    );

    await fs.writeFile(
        file,
        JSON.stringify(
            data,
            null,
            2
        ) + "\n",
        "utf8"
    );
}


// -----------------------------------------------------------------------------
// Registry
// -----------------------------------------------------------------------------

async function loadGeneratorRegistry(): Promise<
    MunicipalDistrictRegistry
> {

    return readJSON<MunicipalDistrictRegistry>(
        GENERATOR_REGISTRY_FILE
    );
}


// -----------------------------------------------------------------------------
// GeoJSON
// -----------------------------------------------------------------------------

async function buildEntry(
    entry: MunicipalDistrictRegistryEntry
): Promise<MunicipalDistrictRegistryEntry> {

    if (!entry.generatedFile) {
        throw new Error(
            `Registry entry for ${entry.city}, ${entry.state} ` +
            `(${entry.placeFips}) does not have a generatedFile.`
        );
    }

    /*
     * The generator is expected to produce normalized GeoJSON
     * before this stage.
     *
     * Example:
     *
     * generator/data/normalized/AZ/0477000-ward.geojson
     *
     * becomes:
     *
     * data/AZ/0477000-ward.geojson
     */

    const sourceFile = path.join(
        GENERATOR_DATA_DIR,
        entry.generatedFile
    );

    const destinationFile = path.join(
        PACKAGE_DATA_DIR,
        entry.generatedFile
    );

    try {

        const contents = await fs.readFile(
            sourceFile,
            "utf8"
        );

        const geojson = JSON.parse(
            contents
        );

        /*
         * normalizeGeoJSON() should produce the public
         * package format.
         */
        const normalized = normalizeGeoJSON(
            geojson,
            {
                city: entry.city,
                state: entry.state,
                placeFips: entry.placeFips,
                boundaryType: entry.boundaryType
            }
        );

        await writeJSON(
            destinationFile,
            normalized
        );

    } catch (error) {

        throw new Error(
            `Failed to build ${entry.city}, ${entry.state} ` +
            `(${entry.placeFips}): ` +
            `${error instanceof Error ? error.message : String(error)}`
        );
    }

    return entry;
}


// -----------------------------------------------------------------------------
// Main build
// -----------------------------------------------------------------------------

export async function build(): Promise<void> {

    console.log(
        "Building municipal district package..."
    );

    await ensureDirectory(
        PACKAGE_DATA_DIR
    );

    const registry =
        await loadGeneratorRegistry();

    console.log(
        `Found ${registry.entries.length} registry entries.`
    );

    const entries: MunicipalDistrictRegistryEntry[] = [];

    for (const entry of registry.entries) {

        console.log(
            `Building ${entry.city}, ${entry.state} ` +
            `${entry.boundaryType}...`
        );

        const builtEntry =
            await buildEntry(entry);

        entries.push(
            builtEntry
        );
    }

    const packageRegistry: MunicipalDistrictRegistry = {
        ...registry,

        generatedAt:
            new Date().toISOString(),

        entries
    };

    await writeJSON(
        PACKAGE_REGISTRY_FILE,
        packageRegistry
    );

    console.log(
        `Wrote ${PACKAGE_REGISTRY_FILE}`
    );

    console.log(
        "Municipal district package build complete."
    );
}


// -----------------------------------------------------------------------------
// CLI
// -----------------------------------------------------------------------------

if (
    import.meta.url ===
    `file://${process.argv[1].replaceAll("\\", "/")}`
) {

    build().catch(
        error => {

            console.error(
                error
            );

            process.exit(
                1
            );
        }
    );
}