import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
    booleanPointInPolygon,
    point
} from "@turf/turf";

import type {
    Feature,
    FeatureCollection,
    Polygon,
    MultiPolygon
} from "geojson";

import {
    findRegistryEntries
} from "./registry.js";

import type {
    BoundaryType,
    Coordinates,
    MunicipalDistrict,
    MunicipalDistrictLookupOptions,
    MunicipalDistrictLookupResult,
    MunicipalDistrictRegistryEntry
} from "./types.js";


// =============================================================================
// Paths
// =============================================================================

const MODULE_DIRECTORY =
    path.dirname(
        fileURLToPath(import.meta.url)
    );

/**
 * Root directory of the npm package.
 *
 * When compiled, this will normally be the directory containing
 * dist/, geometry/, data/, etc.
 */
const PACKAGE_ROOT =
    path.resolve(
        MODULE_DIRECTORY,
        ".."
    );


// =============================================================================
// Registry search
// =============================================================================

/**
 * Options used when searching registry metadata.
 *
 * These are deliberately separate from MunicipalDistrictLookupOptions
 * because registry searches do not require geographic coordinates.
 */
export interface RegistrySearchOptions {
    city?: string;
    state?: string;
    placeFips?: string;
    boundaryType?: BoundaryType;
}


/**
 * Search the municipal registry.
 *
 * This searches registry metadata and does not perform
 * geographic point-in-polygon lookup.
 */
export function searchRegistry(
    options: RegistrySearchOptions = {}
): MunicipalDistrictRegistryEntry[] {

    return findRegistryEntries({
        city:
            options.city,

        state:
            options.state,

        placeFips:
            options.placeFips,

        boundaryType:
            options.boundaryType
    });
}


/**
 * Alias for searchRegistry().
 */
export const searchMunicipalDistricts =
    searchRegistry;


// =============================================================================
// Municipality lookup
// =============================================================================

/**
 * Find registry entries for a municipality.
 *
 * This is a metadata lookup and does not perform geographic
 * point-in-polygon testing.
 *
 * If multiple boundary datasets exist for a municipality,
 * all matching registry entries are returned.
 */
export function findMunicipality(
    city: string,
    state?: string
): MunicipalDistrictRegistryEntry[] {

    return searchRegistry({
        city,
        state
    });
}


// =============================================================================
// Geographic lookup
// =============================================================================

/**
 * Find the municipal district containing a latitude/longitude.
 *
 * The latitude and longitude are required. Optional municipality
 * identifiers can be supplied to narrow the registry search before
 * performing the geographic lookup.
 *
 * Example:
 *
 * lookupMunicipalDistrict({
 *     latitude: 32.2226,
 *     longitude: -110.9747,
 *     city: "Tucson",
 *     state: "AZ"
 * });
 */
export function lookupMunicipalDistrict(
    options: MunicipalDistrictLookupOptions
): MunicipalDistrictLookupResult {

    validateCoordinates(
        options.latitude,
        options.longitude
    );

    const coordinates: Coordinates = {
        latitude:
            options.latitude,

        longitude:
            options.longitude
    };

    /*
     * Search the registry first.
     *
     * This is important for a nationwide package because we do not
     * want to scan every municipality's geometry for every lookup.
     */
    const entries =
        searchRegistry({
            city:
                options.city,

            state:
                options.state,

            placeFips:
                options.placeFips,

            boundaryType:
                options.boundaryType
        });

    if (
        entries.length === 0
    ) {
        return {
            found: false,
            district: null,
            coordinates
        };
    }

    const turfPoint =
        point([
            options.longitude,
            options.latitude
        ]);

    /*
     * Try each matching registry entry.
     *
     * Normally there should be one matching municipality/boundary
     * dataset, but multiple entries are possible.
     */
    for (const entry of entries) {

        const geojson =
            loadMunicipalityGeoJSON(
                entry
            );

        if (!geojson) {
            continue;
        }

        for (const feature of geojson.features) {

            if (
                !feature.geometry ||
                (
                    feature.geometry.type !== "Polygon" &&
                    feature.geometry.type !== "MultiPolygon"
                )
            ) {
                continue;
            }

            if (
                booleanPointInPolygon(
                    turfPoint,
                    feature as Feature<
                        Polygon | MultiPolygon
                    >
                )
            ) {

                const district =
                    featureToMunicipalDistrict(
                        feature,
                        entry
                    );

                return {
                    found: true,
                    district,
                    coordinates
                };
            }
        }
    }

    return {
        found: false,
        district: null,
        coordinates
    };
}


// =============================================================================
// GeoJSON loading
// =============================================================================

/**
 * Load the normalized GeoJSON associated with a registry entry.
 *
 * The registry stores the generated file path, for example:
 *
 * geometry/0477000/ward.geojson
 */
export function loadMunicipalityGeoJSON(
    entry: MunicipalDistrictRegistryEntry
): FeatureCollection<
    Polygon | MultiPolygon
> | null {

    if (
        !entry.generatedFile ||
        typeof entry.generatedFile !== "string"
    ) {
        return null;
    }

    /*
     * Resolve the generated file relative to the package root.
     */
    const filePath =
        path.resolve(
            PACKAGE_ROOT,
            entry.generatedFile
        );

    /*
     * Prevent a malformed registry entry from escaping the package
     * root through "../" path traversal.
     */
    const relativePath =
        path.relative(
            PACKAGE_ROOT,
            filePath
        );

    if (
        relativePath.startsWith("..") ||
        path.isAbsolute(relativePath)
    ) {
        throw new Error(
            `Invalid generatedFile path: ${entry.generatedFile}`
        );
    }

    if (
        !fs.existsSync(filePath)
    ) {
        return null;
    }

    let parsed: unknown;

    try {

        parsed =
            JSON.parse(
                fs.readFileSync(
                    filePath,
                    "utf8"
                )
            );

    } catch {

        return null;
    }

    if (
        !isFeatureCollection(parsed)
    ) {
        return null;
    }

    return parsed;
}


// =============================================================================
// GeoJSON validation
// =============================================================================

/**
 * Check whether a value is a GeoJSON FeatureCollection containing
 * Polygon or MultiPolygon features.
 */
function isFeatureCollection(
    value: unknown
): value is FeatureCollection<
    Polygon | MultiPolygon
> {

    if (
        typeof value !== "object" ||
        value === null
    ) {
        return false;
    }

    const record =
        value as Record<string, unknown>;

    if (
        record.type !==
        "FeatureCollection"
    ) {
        return false;
    }

    if (
        !Array.isArray(
            record.features
        )
    ) {
        return false;
    }

    /*
     * Validate the geometry type of each feature rather than merely
     * trusting that the file is a FeatureCollection.
     */
    for (const feature of record.features) {

        if (
            typeof feature !== "object" ||
            feature === null
        ) {
            return false;
        }

        const featureRecord =
            feature as Record<string, unknown>;

        if (
            featureRecord.type !== "Feature"
        ) {
            return false;
        }

        const geometry =
            featureRecord.geometry;

        if (
            typeof geometry !== "object" ||
            geometry === null
        ) {
            return false;
        }

        const geometryRecord =
            geometry as Record<string, unknown>;

        if (
            geometryRecord.type !== "Polygon" &&
            geometryRecord.type !== "MultiPolygon"
        ) {
            return false;
        }
    }

    return true;
}


// =============================================================================
// Geographic helper
// =============================================================================

/**
 * Test whether a latitude/longitude is inside a GeoJSON polygon
 * or multipolygon feature.
 */
export function pointInMunicipalBoundary(
    latitude: number,
    longitude: number,
    feature: Feature<
        Polygon | MultiPolygon
    >
): boolean {

    validateCoordinates(
        latitude,
        longitude
    );

    return booleanPointInPolygon(
        point([
            longitude,
            latitude
        ]),
        feature
    );
}


// =============================================================================
// Convert GeoJSON feature
// =============================================================================

/**
 * Convert a normalized GeoJSON feature into the public
 * MunicipalDistrict type.
 */
export function featureToMunicipalDistrict(
    feature: Feature<
        Polygon | MultiPolygon
    >,
    entry: MunicipalDistrictRegistryEntry
): MunicipalDistrict {

    const properties =
        feature.properties ?? {};

    const fieldMapping =
        entry.source.fieldMapping;

    /*
     * The generated GeoJSON should normally contain normalized
     * "district" and "name" properties.
     *
     * Fall back to the original source field names so this function
     * also works with geometry generated from older data.
     */
    const districtValue =
        properties.district ??
        properties[
            fieldMapping.district
        ];

    const nameValue =
        properties.name ??
        (
            fieldMapping.name
                ? properties[
                    fieldMapping.name
                ]
                : undefined
        );

    const district =
        String(
            districtValue ?? ""
        ).trim();

    /*
     * MunicipalDistrict.name is required by the public type.
     *
     * If the source does not contain a separate name, use the
     * district identifier as a sensible fallback.
     */
    const name =
        String(
            nameValue ??
            district
        ).trim();

    /*
     * Prefer a normalized ID, then a GeoJSON feature ID, and finally
     * construct a deterministic ID from the municipality and district.
     */
    const propertyId =
        properties.id;

    let id: string;

    if (
        typeof propertyId === "string" ||
        typeof propertyId === "number"
    ) {
        id =
            String(
                propertyId
            ).trim();

    } else if (
        feature.id !== undefined
    ) {
        id =
            String(
                feature.id
            ).trim();

    } else {
        id =
            `${entry.placeFips}-${entry.boundaryType}-${district}`;
    }

    return {
        id,

        district,

        name,

        city:
            entry.city,

        state:
            entry.state,

        placeFips:
            entry.placeFips,

        boundaryType:
            entry.boundaryType,

        geometry:
            feature.geometry
    };
}


// =============================================================================
// Coordinate validation
// =============================================================================

/**
 * Validate geographic coordinates.
 */
function validateCoordinates(
    latitude: number,
    longitude: number
): void {

    if (
        !Number.isFinite(latitude) ||
        latitude < -90 ||
        latitude > 90
    ) {
        throw new RangeError(
            `Invalid latitude: ${latitude}`
        );
    }

    if (
        !Number.isFinite(longitude) ||
        longitude < -180 ||
        longitude > 180
    ) {
        throw new RangeError(
            `Invalid longitude: ${longitude}`
        );
    }
}


// =============================================================================
// Convenience helpers
// =============================================================================

/**
 * Find all registry entries for a municipality.
 */
export function findMunicipalDistrictSources(
    city: string,
    state?: string
): MunicipalDistrictRegistryEntry[] {

    return searchRegistry({
        city,
        state
    });
}


/**
 * Search specifically for a boundary type.
 */
export function findBoundarySources(
    boundaryType: BoundaryType,
    options: RegistrySearchOptions = {}
): MunicipalDistrictRegistryEntry[] {

    return searchRegistry({
        ...options,
        boundaryType
    });
}