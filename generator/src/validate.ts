import fs from "node:fs/promises";
import path from "node:path";

import type {
    MunicipalDistrictRegistry,
    MunicipalDistrictRegistryEntry
} from "../../src/types.js";


// -----------------------------------------------------------------------------
// Validate registry
// -----------------------------------------------------------------------------

export async function validate(
    registryPath = path.resolve(
        "registry.json"
    )
): Promise<void> {

    const contents =
        await fs.readFile(
            registryPath,
            "utf8"
        );

    const registry =
        JSON.parse(
            contents
        ) as MunicipalDistrictRegistry;


    const errors: string[] = [];


    if (
        !registry ||
        typeof registry !== "object"
    ) {
        errors.push(
            "Registry is not an object."
        );
    }


    if (
        !Array.isArray(
            registry.entries
        )
    ) {
        errors.push(
            "Registry entries must be an array."
        );
    }


    if (
        errors.length > 0
    ) {

        throw new Error(
            [
                "Registry validation failed:",
                ...errors.map(
                    error =>
                        `- ${error}`
                )
            ].join("\n")
        );
    }


    for (
        const [
            index,
            entry
        ]
            of registry.entries.entries()
    ) {

        validateEntry(
            entry,
            index,
            errors
        );
    }


    if (
        errors.length > 0
    ) {

        throw new Error(
            [
                "Registry validation failed:",
                ...errors.map(
                    error =>
                        `- ${error}`
                )
            ].join("\n")
        );
    }


    console.log(
        `Registry validation passed: ${registry.entries.length} entries.`
    );
}


// -----------------------------------------------------------------------------
// Entry validation
// -----------------------------------------------------------------------------

function validateEntry(
    entry: MunicipalDistrictRegistryEntry,
    index: number,
    errors: string[]
): void {

    const prefix =
        `entries[${index}]`;


    if (
        !entry.city
    ) {
        errors.push(
            `${prefix}.city is required`
        );
    }


    if (
        !entry.state
    ) {
        errors.push(
            `${prefix}.state is required`
        );
    }


    if (
        !entry.placeFips
    ) {
        errors.push(
            `${prefix}.placeFips is required`
        );
    }


    if (
        !entry.boundaryType
    ) {
        errors.push(
            `${prefix}.boundaryType is required`
        );
    }


    if (
        !entry.source
    ) {
        errors.push(
            `${prefix}.source is required`
        );
    }
}