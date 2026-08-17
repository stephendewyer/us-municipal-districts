import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
    booleanPointInPolygon,
    point
} from "@turf/turf";

import {
    findRegistryEntries
} from "./registry.js";

import type {
    Feature,
    FeatureCollection,
    Polygon,
    MultiPolygon
} from "geojson";

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

const __filename =
    fileURLToPath(import.meta.url);

const __dirname =
    path.dirname(__filename);

/**
 * Directory containing generated municipal boundary data.
 */
const MUNICIPALITIES_PATH =
    path.resolve(
        __dirname,
        "../data/municipalities"
    );


// =============================================================================
// Registry search
// =============================================================================

/**
 * Search the municipal registry.
 *
 * This searches registry metadata and does not perform
 * geographic point-in-polygon lookup.
 */
export function searchRegistry(
    options: MunicipalDistrictLookupOptions = {}
): MunicipalDistrictRegistryEntry[] {

    return findRegistryEntries(options);
}


// =============================================================================
// Municipality lookup
// =============================================================================

/**
 * Find a municipality's registry entry.
 */
export function findMunicipality(
    options: MunicipalDistrictLookupOptions
): MunicipalDistrictRegistryEntry | undefined {

    return searchRegistry(options)[0];
}


// =============================================================================
// Geographic lookup
// =============================================================================

/**
 * Find the municipal district containing a latitude/longitude.
 *
 * The registry is first used to identify the appropriate municipality
 * and boundary dataset. The corresponding normalized GeoJSON is then
 * loaded and searched with Turf.
 */
export function lookupMunicipalDistrict(
    latitude: number,
    longitude: number,
    options: MunicipalDistrictLookupOptions = {}
): MunicipalDistrictLookupResult {

    validateCoordinates(
        latitude,
        longitude
    );

    const coordinates: Coordinates = {
        latitude,
        longitude
    };

    const entries =
        searchRegistry(options);

    if (entries.length === 0) {
        return {
            found: false,
            district: null,
            coordinates
        };
    }

    const turfPoint =
        point([
            longitude,
            latitude
        ]);

    /*
     * Try each matching registry entry.
     *
     * Usually there will be one entry for a municipality/boundary type.
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

function loadMunicipalityGeoJSON(
    entry: MunicipalDistrictRegistryEntry
): FeatureCollection<
    Polygon | MultiPolygon
> | null {

    /*
     * Prefer a predictable municipality-specific directory.
     *
     * Example:
     *
     * data/municipalities/0477000/ward.geojson
     */
    const directory =
        path.join(
            MUNICIPALITIES_PATH,
            entry.placeFips
        );

    const filename =
        `${entry.boundaryType}.geojson`;

    const filePath =
        path.join(
            directory,
            filename
        );

    if (!fs.existsSync(filePath)) {
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

    return true;
}


// =============================================================================
// Convert GeoJSON feature
// =============================================================================

function featureToMunicipalDistrict(
    feature: Feature<
        Polygon | MultiPolygon
    >,
    entry: MunicipalDistrictRegistryEntry
): MunicipalDistrict {

    const properties =
        feature.properties ?? {};

    const fieldMapping =
        entry.source.fieldMapping;

    const districtValue =
        properties[
            fieldMapping.district
        ];

    const nameValue =
        fieldMapping.name
            ? properties[
                fieldMapping.name
            ]
            : undefined;

    const district =
        String(
            districtValue ?? ""
        ).trim();

    const name =
        String(
            nameValue ??
            district
        ).trim();

    /*
     * Use a stable ID when the source does not provide one.
     */
    const id =
        typeof properties.id === "string"
            ? properties.id
            : `${entry.placeFips}-${entry.boundaryType}-${district}`;

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
    options: MunicipalDistrictLookupOptions = {}
): MunicipalDistrictRegistryEntry[] {

    return searchRegistry({
        ...options,
        boundaryType
    });
}


/**
 * Alias for searchRegistry().
 */
export const searchMunicipalDistricts =
    searchRegistry;