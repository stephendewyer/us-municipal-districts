import type {
    Feature,
    FeatureCollection,
    Geometry,
    MultiPolygon,
    Polygon
} from "geojson";

import type {
    BoundaryType
} from "../../src/registry.js";


// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface NormalizeContext {
    city: string;
    state: string;
    placeFips: string;
    boundaryType: BoundaryType;
}

export interface NormalizedDistrictProperties {
    id: string;
    district: string;
    name: string;

    city: string;
    state: string;
    placeFips: string;

    boundaryType: BoundaryType;
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


// -----------------------------------------------------------------------------
// Common source field names
// -----------------------------------------------------------------------------

const DISTRICT_FIELDS = [
    "district",
    "DISTRICT",
    "District",

    "ward",
    "WARD",
    "Ward",

    "council_district",
    "COUNCIL_DISTRICT",
    "CouncilDistrict",
    "Council_District",

    "council",
    "COUNCIL",

    "alderman",
    "ALDERMAN"
] as const;


const NAME_FIELDS = [
    "name",
    "NAME",
    "Name",

    "district_name",
    "DISTRICT_NAME",
    "DistrictName",

    "ward_name",
    "WARD_NAME"
] as const;


const ID_FIELDS = [
    "id",
    "ID",
    "Id",

    "objectid",
    "OBJECTID",
    "ObjectID",

    "fid",
    "FID"
] as const;


// -----------------------------------------------------------------------------
// Property helpers
// -----------------------------------------------------------------------------

function getProperty(
    properties: Record<string, unknown>,
    fields: readonly string[]
): unknown {

    for (const field of fields) {

        if (
            Object.prototype.hasOwnProperty.call(
                properties,
                field
            )
        ) {

            const value =
                properties[field];

            if (
                value !== null &&
                value !== undefined &&
                value !== ""
            ) {
                return value;
            }
        }
    }

    return undefined;
}


function valueToString(
    value: unknown
): string | undefined {

    if (
        value === null ||
        value === undefined
    ) {
        return undefined;
    }

    return String(value).trim();
}


// -----------------------------------------------------------------------------
// District extraction
// -----------------------------------------------------------------------------

function getDistrict(
    properties: Record<string, unknown>
): string | undefined {

    const value =
        getProperty(
            properties,
            DISTRICT_FIELDS
        );

    return valueToString(value);
}


// -----------------------------------------------------------------------------
// Name extraction
// -----------------------------------------------------------------------------

function getDistrictName(
    properties: Record<string, unknown>
): string | undefined {

    const value =
        getProperty(
            properties,
            NAME_FIELDS
        );

    return valueToString(value);
}


// -----------------------------------------------------------------------------
// ID extraction
// -----------------------------------------------------------------------------

function getDistrictId(
    properties: Record<string, unknown>,
    index: number
): string {

    const value =
        getProperty(
            properties,
            ID_FIELDS
        );

    const id =
        valueToString(value);

    if (id) {
        return id;
    }

    /*
     * If the source doesn't have a usable ID,
     * generate a deterministic ID from the
     * feature's position.
     */
    return String(index + 1);
}


// -----------------------------------------------------------------------------
// Geometry validation
// -----------------------------------------------------------------------------

function isPolygonGeometry(
    geometry: Geometry | null
): geometry is Polygon | MultiPolygon {

    if (!geometry) {
        return false;
    }

    return (
        geometry.type === "Polygon" ||
        geometry.type === "MultiPolygon"
    );
}


// -----------------------------------------------------------------------------
// Normalize one feature
// -----------------------------------------------------------------------------

function normalizeFeature(
    feature: Feature,
    index: number,
    context: NormalizeContext
): NormalizedFeature | null {

    if (
        !isPolygonGeometry(
            feature.geometry
        )
    ) {

        /*
         * Municipal district boundaries should
         * normally be polygons.
         *
         * Ignore points, lines, etc.
         */
        return null;
    }

    const properties =
        (feature.properties ?? {}) as Record<
            string,
            unknown
        >;

    const district =
        getDistrict(properties);

    const sourceName =
        getDistrictName(properties);

    const id =
        getDistrictId(
            properties,
            index
        );

    /*
     * If the source has no district field,
     * use the name as a fallback.
     */
    const normalizedDistrict =
        district ??
        sourceName ??
        id;

    /*
     * If the source has no explicit name,
     * create one from the district number.
     */
    const name =
        sourceName ??
        `${context.boundaryType} ${normalizedDistrict}`;

    return {
        type: "Feature",

        id,

        properties: {
            id,

            district:
                normalizedDistrict,

            name,

            city:
                context.city,

            state:
                context.state,

            placeFips:
                context.placeFips,

            boundaryType:
                context.boundaryType
        },

        geometry:
            feature.geometry
    };
}


// -----------------------------------------------------------------------------
// Normalize GeoJSON
// -----------------------------------------------------------------------------

export function normalizeGeoJSON(
    geojson: FeatureCollection,
    context: NormalizeContext
): NormalizedFeatureCollection {

    const features: NormalizedFeature[] = [];

    geojson.features.forEach(
        (feature, index) => {

            const normalized =
                normalizeFeature(
                    feature,
                    index,
                    context
                );

            if (normalized) {
                features.push(
                    normalized
                );
            }
        }
    );

    /*
     * Sort districts when possible.
     *
     * This produces deterministic output,
     * which is helpful when committing generated
     * data to GitHub.
     */
    features.sort(
        (a, b) => {

            const aDistrict =
                a.properties.district;

            const bDistrict =
                b.properties.district;

            const aNumber =
                Number(aDistrict);

            const bNumber =
                Number(bDistrict);

            if (
                Number.isFinite(aNumber) &&
                Number.isFinite(bNumber)
            ) {

                return (
                    aNumber -
                    bNumber
                );
            }

            return aDistrict.localeCompare(
                bDistrict,
                undefined,
                {
                    numeric: true
                }
            );
        }
    );

    return {
        type: "FeatureCollection",

        features
    };
}