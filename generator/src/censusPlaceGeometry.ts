import fs from "node:fs";
import path from "node:path";

import type {
    MultiPolygon,
    Polygon
} from "geojson";

import type {
    CensusPlaceGeometryStateFile
} from "./generateCensusPlaceGeometries.js";

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const DEFAULT_GEOMETRY_DIRECTORY =
    path.resolve(
        "generator",
        "data",
        "census-place-geometries"
    );

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type CensusPlaceGeometry =
    Polygon | MultiPolygon;

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Load the Census geometry file for a state.
 *
 * Example:
 *
 *     loadCensusPlaceGeometryState("04")
 *
 * loads:
 *
 *     generator/data/census-place-geometries/04.json
 */
export function loadCensusPlaceGeometryState(
    stateFips: string,
    geometryDirectory:
        string = DEFAULT_GEOMETRY_DIRECTORY
): CensusPlaceGeometryStateFile {

    const normalizedStateFips =
        normalizeStateFips(
            stateFips
        );

    const filePath =
        path.join(
            geometryDirectory,
            `${normalizedStateFips}.json`
        );

    if (
        !fs.existsSync(
            filePath
        )
    ) {
        throw new Error(
            `Census place geometry file not found: ` +
            `${filePath}`
        );
    }

    const text =
        fs.readFileSync(
            filePath,
            "utf8"
        );

    let parsed: unknown;

    try {
        parsed =
            JSON.parse(
                text
            );
    } catch (error) {
        throw new Error(
            `Failed to parse Census place geometry file: ` +
            `${filePath}`,
            {
                cause: error
            }
        );
    }

    validateStateGeometryFile(
        parsed,
        filePath,
        normalizedStateFips
    );

    return parsed;
}

/**
 * Load a single Census place geometry by its 7-digit place GEOID.
 *
 * Example:
 *
 *     loadCensusPlaceGeometry("0477000")
 */
export function loadCensusPlaceGeometry(
    placeFips: string,
    geometryDirectory:
        string = DEFAULT_GEOMETRY_DIRECTORY
): CensusPlaceGeometry {

    const normalizedPlaceFips =
        normalizePlaceFips(
            placeFips
        );

    const stateFips =
        normalizedPlaceFips.slice(
            0,
            2
        );

    const stateFile =
        loadCensusPlaceGeometryState(
            stateFips,
            geometryDirectory
        );

    const geometry =
        stateFile.geometries[
            normalizedPlaceFips
        ];

    if (
        !geometry
    ) {
        throw new Error(
            `No Census place geometry found for ` +
            `place FIPS ${normalizedPlaceFips} ` +
            `in state ${stateFips}.`
        );
    }

    return geometry;
}

/**
 * Determine the two-digit state FIPS code from a Census place GEOID.
 */
export function getStateFipsFromPlaceFips(
    placeFips: string
): string {

    const normalized =
        normalizePlaceFips(
            placeFips
        );

    return normalized.slice(
        0,
        2
    );
}

// -----------------------------------------------------------------------------
// Validation
// -----------------------------------------------------------------------------

function validateStateGeometryFile(
    value: unknown,
    filePath: string,
    expectedStateFips: string
): asserts value is CensusPlaceGeometryStateFile {

    if (
        !value ||
        typeof value !== "object"
    ) {
        throw new Error(
            `Invalid Census place geometry file: ` +
            `${filePath}`
        );
    }

    const record =
        value as Record<
            string,
            unknown
        >;

    if (
        typeof record.state !== "string"
    ) {
        throw new Error(
            `Invalid Census place geometry file ` +
            `${filePath}: missing state.`
        );
    }

    if (
        typeof record.stateFips !== "string"
    ) {
        throw new Error(
            `Invalid Census place geometry file ` +
            `${filePath}: missing stateFips.`
        );
    }

    if (
        normalizeStateFips(
            record.stateFips
        ) !== expectedStateFips
    ) {
        throw new Error(
            `Invalid Census place geometry file ` +
            `${filePath}: stateFips does not match ` +
            `expected ${expectedStateFips}.`
        );
    }

    if (
        typeof record.vintage !== "string"
    ) {
        throw new Error(
            `Invalid Census place geometry file ` +
            `${filePath}: missing vintage.`
        );
    }

    if (
        typeof record.source !== "string"
    ) {
        throw new Error(
            `Invalid Census place geometry file ` +
            `${filePath}: missing source.`
        );
    }

    if (
        !record.geometries ||
        typeof record.geometries !== "object"
    ) {
        throw new Error(
            `Invalid Census place geometry file ` +
            `${filePath}: missing geometries.`
        );
    }

    const geometries =
        record.geometries as Record<
            string,
            unknown
        >;

    for (
        const [
            placeFips,
            geometry
        ] of Object.entries(
            geometries
        )
    ) {

        if (
            !/^\d{7}$/.test(
                placeFips
            )
        ) {
            throw new Error(
                `Invalid place FIPS "${placeFips}" ` +
                `in ${filePath}.`
            );
        }

        if (
            !isPolygonGeometry(
                geometry
            )
        ) {
            throw new Error(
                `Invalid geometry for place FIPS ` +
                `"${placeFips}" in ${filePath}.`
            );
        }
    }
}

function isPolygonGeometry(
    value: unknown
): value is CensusPlaceGeometry {

    if (
        !value ||
        typeof value !== "object"
    ) {
        return false;
    }

    const geometry =
        value as Record<
            string,
            unknown
        >;

    if (
        geometry.type !== "Polygon" &&
        geometry.type !== "MultiPolygon"
    ) {
        return false;
    }

    return Array.isArray(
        geometry.coordinates
    );
}

// -----------------------------------------------------------------------------
// Normalization
// -----------------------------------------------------------------------------

function normalizeStateFips(
    value: string
): string {

    const normalized =
        value
            .trim()
            .replace(
                /\D/g,
                ""
            )
            .padStart(
                2,
                "0"
            );

    if (
        !/^\d{2}$/.test(
            normalized
        )
    ) {
        throw new RangeError(
            `Invalid state FIPS code: ${value}`
        );
    }

    return normalized;
}

function normalizePlaceFips(
    value: string
): string {

    const normalized =
        value
            .trim()
            .replace(
                /\D/g,
                ""
            )
            .padStart(
                7,
                "0"
            );

    if (
        !/^\d{7}$/.test(
            normalized
        )
    ) {
        throw new RangeError(
            `Invalid place FIPS code: ${value}`
        );
    }

    return normalized;
}