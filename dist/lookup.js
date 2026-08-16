import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";
import { loadRegistry } from "./registry.js";
/**
 * Look up the municipal district containing a latitude/longitude.
 */
export async function lookupMunicipalDistrict(coordinates, options = {}) {
    const registry = loadRegistry();
    const latitude = coordinates.latitude;
    const longitude = coordinates.longitude;
    if (!Number.isFinite(latitude) ||
        !Number.isFinite(longitude)) {
        throw new Error("Latitude and longitude must be finite numbers.");
    }
    if (latitude < -90 || latitude > 90) {
        throw new Error("Latitude must be between -90 and 90.");
    }
    if (longitude < -180 || longitude > 180) {
        throw new Error("Longitude must be between -180 and 180.");
    }
    const entries = registry.entries.filter((entry) => matchesRegistryEntry(entry, options));
    if (entries.length === 0) {
        return null;
    }
    const searchPoint = point([
        longitude,
        latitude
    ]);
    for (const entry of entries) {
        const geojson = await loadGeoJSON(entry);
        for (const feature of geojson.features) {
            if (!feature.geometry) {
                continue;
            }
            if (booleanPointInPolygon(searchPoint, feature)) {
                return {
                    found: true,
                    district: featureToMunicipalDistrict(feature, entry),
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
/**
 * Determine whether a registry entry applies to the
 * lookup options supplied by the caller.
 */
function matchesRegistryEntry(entry, options) {
    if (options.state &&
        entry.state.toUpperCase() !==
            options.state.toUpperCase()) {
        return false;
    }
    if (options.city &&
        entry.city.toLowerCase() !==
            options.city.toLowerCase()) {
        return false;
    }
    if (options.placeFips &&
        entry.placeFips !== options.placeFips) {
        return false;
    }
    if (options.boundaryType &&
        entry.boundaryType !== options.boundaryType) {
        return false;
    }
    return true;
}
/**
 * Load the GeoJSON file associated with a registry entry.
 */
async function loadGeoJSON(entry) {
    if (!entry.generatedFile) {
        throw new Error(`Registry entry for ${entry.city}, ${entry.state} ` +
            `does not have a generatedFile.`);
    }
    const url = new URL(entry.generatedFile, import.meta.url);
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Unable to load municipal district GeoJSON: ` +
            `${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    validateFeatureCollection(data);
    return data;
}
/**
 * Convert a GeoJSON feature into the public MunicipalDistrict
 * representation.
 */
function featureToMunicipalDistrict(feature, entry) {
    if (!feature.geometry) {
        throw new Error(`Municipal district feature has no geometry.`);
    }
    const properties = feature.properties ?? {};
    const district = properties.district ??
        properties.name ??
        properties.id ??
        "unknown";
    const name = properties.name ??
        String(district);
    const id = properties.id ??
        String(district);
    return {
        id: String(id),
        district: String(district),
        name: String(name),
        city: properties.city ??
            entry.city,
        state: properties.state ??
            entry.state,
        placeFips: properties.placeFips ??
            entry.placeFips,
        boundaryType: properties.boundaryType ??
            entry.boundaryType,
        geometry: feature.geometry
    };
}
/**
 * Basic runtime validation of the generated GeoJSON.
 */
function validateFeatureCollection(value) {
    if (typeof value !== "object" ||
        value === null) {
        throw new Error("Generated district data is not a valid object.");
    }
    const collection = value;
    if (collection.type !==
        "FeatureCollection") {
        throw new Error("Generated district data is not a GeoJSON FeatureCollection.");
    }
    if (!Array.isArray(collection.features)) {
        throw new Error("Generated district data has no features array.");
    }
}
