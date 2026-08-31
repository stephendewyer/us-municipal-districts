import type {
    Feature,
    FeatureCollection,
    Polygon,
    MultiPolygon
} from "geojson";

import type {
    DistrictType
} from "../../generator/src/types.js";


// =============================================================================
// Types
// =============================================================================

export interface NormalizeOptions {

    city: string;

    state: string;

    placeFips: string;

    boundaryType: DistrictType;

    /**
     * Field containing the district identifier.
     *
     * If omitted, common field names such as WARD and DISTRICT
     * are detected automatically.
     */
    districtField?: string;

    /**
     * Optional field containing the human-readable district name.
     */
    nameField?: string;
}


export interface NormalizedDistrictProperties {
    id?: string;

    district?: string;

    name?: string;

    city: string;

    state: string;

    placeFips: string;

    boundaryType: DistrictType;

    [key: string]: unknown;
}


export type NormalizedFeature =
    Feature<
        Polygon | MultiPolygon,
        NormalizedDistrictProperties
    >;


export type NormalizedFeatureCollection =
    FeatureCollection<
        Polygon | MultiPolygon,
        NormalizedDistrictProperties
    >;


// =============================================================================
// Public API
// =============================================================================

/**
 * Normalize an ArcGIS/GeoJSON municipal boundary dataset into the
 * package's standard GeoJSON structure.
 *
 * The original properties are preserved while standardized properties
 * are added:
 *
 *   district
 *   name
 *   city
 *   state
 *   placeFips
 *   boundaryType
 */
export function normalizeGeoJSON(
    source: FeatureCollection,
    options: NormalizeOptions
): NormalizedFeatureCollection {

    const districtField =
        options.districtField ??
        detectDistrictField(source);

    const nameField =
        options.nameField ??
        detectNameField(source);

    const features =
        source.features.map(
            (feature, index) =>
                normalizeFeature(
                    feature,
                    index,
                    districtField,
                    nameField,
                    options
                )
        );

    return {
        type: "FeatureCollection",

        features
    };
}


// =============================================================================
// Feature normalization
// =============================================================================

function normalizeFeature(
    feature: Feature,
    index: number,
    districtField: string | undefined,
    nameField: string | undefined,
    options: NormalizeOptions
): NormalizedFeature {

    const properties =
        feature.properties ?? {};

    const district =
        districtField
            ? getProperty(
                properties,
                districtField
            )
            : undefined;

    const name =
        nameField
            ? getProperty(
                properties,
                nameField
            )
            : undefined;

    const normalizedDistrict =
        normalizeValue(
            district
        );

    const normalizedName =
        normalizeValue(
            name
        );

    const id =
        normalizeValue(
            feature.id
        ) ??
        normalizedDistrict ??
        String(index + 1);

    return {
        type: "Feature",

        id,

        geometry:
            normalizeGeometry(
                feature.geometry
            ),

        properties: {
            ...properties,

            id,

            district:
                normalizedDistrict,

            name:
                normalizedName ??
                normalizedDistrict,

            city:
                options.city,

            state:
                options.state,

            placeFips:
                options.placeFips,

            boundaryType:
                options.boundaryType
        }
    };
}


// =============================================================================
// Geometry
// =============================================================================

function normalizeGeometry(
    geometry: Feature["geometry"]
): Polygon | MultiPolygon {

    if (!geometry) {
        throw new Error(
            "Cannot normalize feature without geometry."
        );
    }

    if (
        geometry.type === "Polygon" ||
        geometry.type === "MultiPolygon"
    ) {
        return geometry;
    }

    throw new Error(
        `Unsupported municipal boundary geometry: ${geometry.type}`
    );
}


// =============================================================================
// District field detection
// =============================================================================

const DISTRICT_FIELD_NAMES = [
    "district",
    "district_id",
    "districtid",
    "district_no",
    "district_num",
    "district_number",
    "districtname",

    "ward",
    "ward_id",
    "wardid",
    "ward_no",
    "ward_num",
    "ward_number",
    "wardname",

    "council_district",
    "councildistrict",
    "council_district_id"
];


function detectDistrictField(
    source: FeatureCollection
): string | undefined {

    const fieldNames =
        collectPropertyNames(source);

    /*
     * First look for exact matches.
     */
    for (const candidate of DISTRICT_FIELD_NAMES) {

        const normalizedCandidate =
            normalizeFieldName(
                candidate
            );

        const match =
            fieldNames.find(
                field =>
                    normalizeFieldName(
                        field
                    ) === normalizedCandidate
            );

        if (match) {
            return match;
        }
    }

    /*
     * Then look for fields containing district/ward.
     */
    const partial =
        fieldNames.find(
            field => {

                const normalized =
                    normalizeFieldName(
                        field
                    );

                return (
                    normalized.includes("district") ||
                    normalized.includes("ward")
                );
            }
        );

    return partial;
}


// =============================================================================
// Name field detection
// =============================================================================

const NAME_FIELD_NAMES = [
    "name",
    "district_name",
    "ward_name",
    "council_name",
    "label",
    "description"
];


function detectNameField(
    source: FeatureCollection
): string | undefined {

    const fieldNames =
        collectPropertyNames(source);

    for (const candidate of NAME_FIELD_NAMES) {

        const normalizedCandidate =
            normalizeFieldName(
                candidate
            );

        const match =
            fieldNames.find(
                field =>
                    normalizeFieldName(
                        field
                    ) === normalizedCandidate
            );

        if (match) {
            return match;
        }
    }

    return undefined;
}


// =============================================================================
// Property helpers
// =============================================================================

function collectPropertyNames(
    source: FeatureCollection
): string[] {

    const names =
        new Set<string>();

    for (const feature of source.features) {

        if (!feature.properties) {
            continue;
        }

        for (
            const name of Object.keys(
                feature.properties
            )
        ) {
            names.add(name);
        }
    }

    return [...names];
}


function getProperty(
    properties: Record<string, unknown>,
    field: string
): unknown {

    /*
     * Try the exact field name first.
     */
    if (
        Object.prototype.hasOwnProperty.call(
            properties,
            field
        )
    ) {
        return properties[field];
    }

    /*
     * Fall back to case-insensitive matching.
     */
    const normalizedField =
        normalizeFieldName(
            field
        );

    const actualField =
        Object.keys(properties).find(
            key =>
                normalizeFieldName(key) ===
                normalizedField
        );

    return actualField
        ? properties[actualField]
        : undefined;
}


function normalizeValue(
    value: unknown
): string | undefined {

    if (
        value === undefined ||
        value === null
    ) {
        return undefined;
    }

    if (
        typeof value === "string"
    ) {
        const result =
            value.trim();

        return result.length > 0
            ? result
            : undefined;
    }

    if (
        typeof value === "number" ||
        typeof value === "boolean"
    ) {
        return String(value);
    }

    return undefined;
}


function normalizeFieldName(
    value: string
): string {

    return value
        .toLowerCase()
        .replace(
            /[^a-z0-9]/g,
            ""
        );
}