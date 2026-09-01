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
// ArcGIS service types
// =============================================================================

/**
 * ArcGIS service type used as a municipal boundary source.
 */
export type ArcGISServiceType =
    | "FeatureServer"
    | "MapServer"
    | "unknown";


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
     *
     * Example:
     * "0.1.0"
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
 * Registry entry describing the canonical geometry source
 * for one municipality and boundary type.
 */
export interface MunicipalDistrictRegistryEntry {

    /**
     * Census place GEOID.
     *
     * Example:
     * "0477000"
     */
    placeFips: string;

    /**
     * Municipality name.
     *
     * Example:
     * "Tucson"
     */
    city: string;

    /**
     * Two-letter state abbreviation.
     *
     * Example:
     * "AZ"
     */
    state: string;

    /**
     * Type of municipal political boundary.
     */
    boundaryType: BoundaryType;

    /**
     * Canonical source used to generate the geometry.
     */
    source: MunicipalDistrictSource;

    /**
     * Path to the generated GeoJSON file relative to
     * data/municipalities/.
     *
     * Example:
     * "geometry/0477000/ward.geojson"
     */
    generatedFile: string;

    /**
     * Metadata associated with the registry entry.
     */
    metadata: MunicipalDistrictMetadata;
}


// =============================================================================
// Registry metadata
// =============================================================================

/**
 * Metadata generated during source discovery and geometry generation.
 */
export interface MunicipalDistrictMetadata {

    /**
     * ISO timestamp indicating when this entry was generated.
     */
    generatedAt: string;

    /**
     * Version of the generator that produced the entry.
     */
    generatorVersion: string;

    /**
     * Alternative sources discovered for this municipality.
     */
    alternatives: MunicipalDistrictAlternative[];

    /**
     * Whether the entry requires manual review.
     */
    requiresReview: boolean;
}


/**
 * An alternative source discovered during source selection.
 */
export interface MunicipalDistrictAlternative {

    /**
     * Source URL.
     */
    url: string;

    /**
     * ArcGIS Portal item ID.
     */
    itemId?: string;

    /**
     * Human-readable source title.
     */
    title?: string;

    /**
     * ArcGIS service type.
     */
    serviceType: ArcGISServiceType;

    /**
     * Whether the source is an official municipal source.
     */
    official: boolean;

    /**
     * Source discovery/ranking score.
     */
    score: number;
}


// =============================================================================
// Municipal district source
// =============================================================================

/**
 * Canonical source used to generate municipal district geometry.
 */
export interface MunicipalDistrictSource {

    sourceType: string;
    /**
     * Source URL.
     *
     * For example:
     *
     * https://.../FeatureServer/158
     */
    url: string;

    /**
     * ArcGIS Portal item ID.
     */
    itemId?: string;

    /**
     * ArcGIS service type.
     */
    serviceType: ArcGISServiceType;

    /**
     * Human-readable source title.
     */
    title?: string;

    /**
     * Whether this is an official municipal/government source.
     */
    official: boolean;

    /**
     * Whether the source has been verified.
     */
    verified: boolean;

    /**
     * Mapping from normalized fields to source fields.
     */
    fieldMapping: MunicipalDistrictFieldMapping;
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
     *
     * Example:
     * "WARD"
     */
    district: string;

    /**
     * Optional source field containing the district name.
     *
     * Example:
     * "NAME"
     */
    name?: string;
}