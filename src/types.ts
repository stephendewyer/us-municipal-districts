// src/types.ts

import type {
    Polygon,
    MultiPolygon
} from "geojson";


// =============================================================================
// Boundary types
// =============================================================================

/**
 * Type of municipal political boundary.
 */
export type BoundaryType =
    | "ward"
    | "council-district"
    | "city-council-district"
    | "aldermanic-district"
    | "municipal-district";


// =============================================================================
// Coordinates
// =============================================================================

/**
 * Geographic coordinates in decimal degrees.
 */
export interface Coordinates {

    /**
     * Latitude.
     *
     * Range: -90 to 90.
     */
    latitude: number;

    /**
     * Longitude.
     *
     * Range: -180 to 180.
     */
    longitude: number;
}


// =============================================================================
// Municipal district
// =============================================================================

/**
 * A municipal political district containing a geographic location.
 */
export interface MunicipalDistrict {

    /**
     * Unique identifier for the district.
     */
    id: string;

    /**
     * District number or identifier.
     *
     * Examples:
     *
     * "1"
     * "2"
     * "At-Large"
     */
    district: string;

    /**
     * Human-readable district name.
     */
    name: string;

    /**
     * Municipality name.
     */
    city: string;

    /**
     * State abbreviation.
     */
    state: string;

    /**
     * Census place GEOID.
     */
    placeFips: string;

    /**
     * Type of municipal political boundary.
     */
    boundaryType: BoundaryType;

    /**
     * District boundary geometry.
     */
    geometry: Polygon | MultiPolygon;
}


// =============================================================================
// Lookup options
// =============================================================================

/**
 * Options used to identify the municipality whose district
 * should be searched.
 */
export interface MunicipalDistrictLookupOptions {

    /**
     * Municipality name.
     *
     * Example:
     * "Phoenix"
     */
    city?: string;

    /**
     * State abbreviation or full state name.
     *
     * Examples:
     * "AZ"
     * "Arizona"
     */
    state?: string;

    /**
     * Census place GEOID.
     *
     * Example:
     * "0455000"
     */
    placeFips?: string;

    /**
     * Restrict the lookup to a particular boundary type.
     */
    boundaryType?: BoundaryType;
}


// =============================================================================
// Lookup result
// =============================================================================

/**
 * Result returned by a municipal district lookup.
 */
export interface MunicipalDistrictLookupResult {

    /**
     * Whether a district containing the supplied coordinates
     * was found.
     */
    found: boolean;

    /**
     * Matching district.
     *
     * null when no district was found.
     */
    district: MunicipalDistrict | null;

    /**
     * Coordinates used for the lookup.
     */
    coordinates: Coordinates;
}


// =============================================================================
// Registry
// =============================================================================

/**
 * Complete municipal district registry.
 */
export interface MunicipalDistrictRegistry {

    /**
     * Registry schema version.
     */
    version: string;

    /**
     * ISO timestamp indicating when the registry was generated.
     */
    generatedAt: string;

    /**
     * Registry entries.
     */
    entries: MunicipalDistrictRegistryEntry[];
}


/**
 * Registry entry for a municipality.
 */
export interface MunicipalDistrictRegistryEntry {

    /**
     * Census place GEOID.
     */
    placeFips: string;

    /**
     * Municipality name.
     */
    city: string;

    /**
     * State abbreviation.
     */
    state: string;

    /**
     * Type of municipal boundary.
     */
    boundaryType: BoundaryType;

    /**
     * Boundary data source.
     */
    source: MunicipalDistrictSource;
    
    /**
     * Relative path to the generated normalized GeoJSON file.
     *
     * Example:
     * municipalities/0477000/ward.geojson
     */
    generatedFile: string;
}


/**
 * Source information for a municipal boundary dataset.
 */
export interface MunicipalDistrictSource {
    /**
     * Type of geographic data source.
     */
    sourceType: string;

    /**
     * URL of the original geographic data source.
     */
    url: string;

    /**
     * Human-readable source title.
     */
    title?: string;

    /**
     * Whether the source is an official municipal source.
     */
    official?: boolean;

    /**
     * Whether the source has been verified as representing
     * the intended municipal boundary.
     */
    verified?: boolean;

    /**
     * Date the source was last verified.
     *
     * Stored as an ISO 8601 date/time string.
     */
    lastVerified?: string;

    /**
     * Geographic data format.
     */
    format?: string;

    /**
     * Mapping between normalized properties and source fields.
     */
    fieldMapping: {
        district: string;
        name?: string;
    };
}


// =============================================================================
// Field mapping
// =============================================================================

/**
 * Maps normalized municipal district fields to source dataset fields.
 */
export interface MunicipalDistrictFieldMapping {

    /**
     * Source field containing the district identifier.
     */
    district: string;

    /**
     * Optional source field containing the district name.
     */
    name?: string;
}
