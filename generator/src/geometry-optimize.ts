import type {
    GeoJSONFeature,
    GeoJSONFeatureCollection
} from "./geometry.js";

import {
    area,
    booleanValid,
    feature,
    simplify
} from "@turf/turf";


export interface GeometryOptimizationOptions {

    /**
     * Whether coordinate precision should be reduced.
     */
    roundCoordinates: boolean;

    /**
     * Number of decimal places to retain when rounding
     * coordinate values.
     */
    coordinatePrecision?: number;

    /**
     * Whether geometry simplification should be performed.
     */
    simplify: boolean;

    /**
     * Simplification tolerance in degrees.
     *
     * The tolerance is interpreted in the coordinate system
     * of the normalized GeoJSON geometry.
     */
    tolerance?: number;

    /**
     * Maximum allowed relative area change caused by optimization.
     *
     * For example, 0.01 permits up to a 1% area change.
     */
    maxAreaChangeRatio?: number;
}


export interface GeometryOptimizationReport {

    /**
     * Number of features in the geometry.
     */
    featureCount: number;

    /**
     * Number of coordinate positions before optimization.
     */
    originalVertexCount: number;

    /**
     * Number of coordinate positions after optimization.
     */
    optimizedVertexCount: number;

    /**
     * Percentage reduction in coordinate positions.
     */
    vertexReductionPercent: number;

    /**
     * Serialized GeoJSON size before optimization.
     */
    originalByteSize: number;

    /**
     * Serialized GeoJSON size after optimization.
     */
    optimizedByteSize: number;

    /**
     * Percentage reduction in serialized GeoJSON size.
     */
    byteReductionPercent: number;
}


export interface GeometryIntegrityReport {

    /**
     * Whether the optimized geometry contains the same
     * number of features as the original geometry.
     */
    featureCountPreserved: boolean;

    /**
     * Whether every optimized feature has a supported
     * geometry type.
     */
    geometryTypesPreserved: boolean;

    /**
     * Whether every optimized polygon geometry is valid.
     */
    validGeometries: boolean;

    /**
     * Whether district properties are unchanged.
     */
    propertiesPreserved: boolean;

    /**
     * Whether all integrity checks passed.
     */
    valid: boolean;
}


export interface GeometryOptimizationResult {

    /**
     * Optimized GeoJSON.
     */
    geometry: GeoJSONFeatureCollection;

    /**
     * Metrics describing the optimization.
     */
    report: GeometryOptimizationReport;

    /**
     * Integrity checks comparing optimized geometry
     * with the original normalized geometry.
     */
    integrity: GeometryIntegrityReport;
}


// =============================================================================
// Geometry simplification
// =============================================================================

function simplifyFeature(
    feature: GeoJSONFeature,
    tolerance: number
): GeoJSONFeature {

    if (
        feature.geometry === null
    ) {
        return feature;
    }

    const simplified =
        simplify(
            feature as any,
            {
                tolerance,
                highQuality: true,
                mutate: false
            }
        );

    return simplified as GeoJSONFeature;
}


function simplifyCollection(
    geometry: GeoJSONFeatureCollection,
    tolerance: number
): GeoJSONFeatureCollection {

    return {
        type:
            "FeatureCollection",

        features:
            geometry.features.map(
                feature =>
                    simplifyFeature(
                        feature,
                        tolerance
                    )
            )
    };
}


// =============================================================================
// Coordinate precision
// =============================================================================

/**
 * Determines whether a value is an array containing numeric
 * coordinate values.
 */
function isCoordinate(
    value: unknown
): value is number[] {

    return (
        Array.isArray(value) &&
        value.length >= 2 &&
        value.every(
            coordinate =>
                typeof coordinate === "number"
        )
    );
}


/**
 * Rounds a coordinate value to a fixed number of decimal places.
 */
function roundCoordinate(
    value: number,
    precision: number
): number {

    const factor =
        10 ** precision;

    return (
        Math.round(
            value * factor
        ) / factor
    );
}


/**
 * Recursively rounds all coordinate values in a GeoJSON
 * coordinate array.
 */
function roundCoordinates(
    coordinates: unknown,
    precision: number
): unknown {

    if (!Array.isArray(coordinates)) {
        return coordinates;
    }

    if (isCoordinate(coordinates)) {
        return coordinates.map(
            coordinate =>
                roundCoordinate(
                    coordinate,
                    precision
                )
        );
    }

    return coordinates.map(
        value =>
            roundCoordinates(
                value,
                precision
            )
    );
}

/**
 * Rounds coordinate precision for a single GeoJSON feature.
 */
function roundFeatureCoordinates(
    feature: GeoJSONFeature,
    precision: number
): GeoJSONFeature {

    if (
        feature.geometry === null
    ) {
        return feature;
    }

    return {
        ...feature,

        geometry: {
            ...feature.geometry,

            coordinates:
                roundCoordinates(
                    feature.geometry.coordinates,
                    precision
                ) as typeof feature.geometry.coordinates
        }
    };
}

/**
 * Rounds coordinate precision throughout a FeatureCollection.
 */
function roundCollectionCoordinates(
    geometry: GeoJSONFeatureCollection,
    precision: number
): GeoJSONFeatureCollection {

    return {
        ...geometry,

        features:
            geometry.features.map(
                feature =>
                    roundFeatureCoordinates(
                        feature,
                        precision
                    )
            )
    };
}


// =============================================================================
// Geometry metrics
// =============================================================================

/**
 * Calculates the total Turf area of all polygonal features
 * in a FeatureCollection.
 *
 * Turf area is returned in square meters.
 */
function calculateCollectionArea(
    geometry: GeoJSONFeatureCollection
): number {

    return geometry.features.reduce(
        (
            total: number,
            featureItem
        ) => {

            if (
                featureItem.geometry === null
            ) {
                return total;
            }

            if (
                featureItem.geometry.type !== "Polygon" &&
                featureItem.geometry.type !== "MultiPolygon"
            ) {
                return total;
            }

            return (
                total +
                area(
                    feature(
                        featureItem.geometry as any
                    )
                )
            );
        },
        0
    );
}

/**
 * Determines whether optimization changed the total polygon
 * area beyond the permitted relative threshold.
 */
function hasExcessiveAreaChange(
    original: GeoJSONFeatureCollection,
    optimized: GeoJSONFeatureCollection,
    maxAreaChangeRatio: number
): boolean {

    const originalArea =
        calculateCollectionArea(
            original
        );

    const optimizedArea =
        calculateCollectionArea(
            optimized
        );


    /*
     * An empty-area geometry cannot provide a meaningful
     * relative area comparison.
     */
    if (
        originalArea === 0
    ) {
        return (
            optimizedArea !== 0
        );
    }


    const areaChangeRatio =
        Math.abs(
            optimizedArea -
            originalArea
        ) /
        originalArea;


    return (
        areaChangeRatio >
        maxAreaChangeRatio
    );
}

/**
 * Recursively counts coordinate positions in Polygon and
 * MultiPolygon coordinate arrays.
 */
function countVertices(
    coordinates: unknown
): number {

    if (!Array.isArray(coordinates)) {
        return 0;
    }

    if (isCoordinate(coordinates)) {
        return 1;
    }

    return coordinates.reduce(
        (
            count: number,
            value: unknown
        ) =>
            count +
            countVertices(value),
        0
    );
}


/**
 * Counts all coordinate positions in a GeoJSON FeatureCollection.
 */
function countVerticesInCollection(
    geometry: GeoJSONFeatureCollection
): number {

    return geometry.features.reduce(
        (
            count: number,
            featureItem
        ) => {

            if (!featureItem.geometry) {
                return count;
            }

            return (
                count +
                countVertices(
                    featureItem.geometry.coordinates
                )
            );
        },
        0
    );
}


/**
 * Returns the UTF-8 byte size of serialized GeoJSON.
 */
function getByteSize(
    geometry: GeoJSONFeatureCollection
): number {

    return Buffer.byteLength(
        JSON.stringify(geometry),
        "utf8"
    );
}


/**
 * Calculates percentage reduction between two values.
 */
function calculateReductionPercent(
    original: number,
    optimized: number
): number {

    if (original === 0) {
        return 0;
    }

    return (
        (
            original -
            optimized
        ) /
        original
    ) * 100;
}


// =============================================================================
// Geometry integrity validation
// =============================================================================

/**
 * Determines whether two line segments properly cross.
 *
 * A proper crossing occurs when each segment passes from one
 * side of the other segment to the opposite side.
 *
 * Collinear overlap and endpoint touching are intentionally not
 * treated as proper crossings. Municipal boundary geometries can
 * legitimately contain coincident or touching vertices/edges, and
 * treating those as self-intersections produces false positives.
 */
function segmentsIntersect(
    a: number[],
    b: number[],
    c: number[],
    d: number[]
): boolean {

    const orientation =
        (
            p: number[],
            q: number[],
            r: number[]
        ): number => {

            const value =
                (q[0] - p[0]) *
                (r[1] - p[1]) -
                (q[1] - p[1]) *
                (r[0] - p[0]);

            const epsilon =
                1e-12;

            if (
                Math.abs(value) <= epsilon
            ) {
                return 0;
            }

            return value > 0
                ? 1
                : -1;
        };


    const orientation1 =
        orientation(
            a,
            b,
            c
        );

    const orientation2 =
        orientation(
            a,
            b,
            d
        );

    const orientation3 =
        orientation(
            c,
            d,
            a
        );

    const orientation4 =
        orientation(
            c,
            d,
            b
        );


    /*
     * A proper crossing requires each segment's endpoints
     * to lie on opposite sides of the other segment.
     *
     * In particular, this deliberately excludes:
     *
     * - collinear segments
     * - shared endpoints
     * - endpoint-on-segment touching
     * - collinear overlap
     */
    return (
        orientation1 !== 0 &&
        orientation2 !== 0 &&
        orientation3 !== 0 &&
        orientation4 !== 0 &&
        orientation1 !== orientation2 &&
        orientation3 !== orientation4
    );
}


/**
 * Determines whether a LinearRing intersects itself.
 *
 * Adjacent segments are allowed to share their endpoints.
 * The first and final segments are also allowed to share
 * the closing vertex.
 */
function hasRingSelfIntersection(
    ring: number[][]
): boolean {

    if (
        ring.length < 4
    ) {
        return true;
    }


    for (
        let firstIndex = 0;
        firstIndex < ring.length - 1;
        firstIndex++
    ) {

        const firstStart =
            ring[firstIndex];

        const firstEnd =
            ring[firstIndex + 1];


        for (
            let secondIndex = firstIndex + 1;
            secondIndex < ring.length - 1;
            secondIndex++
        ) {

            if (
                secondIndex ===
                firstIndex + 1
            ) {
                continue;
            }


            if (
                firstIndex === 0 &&
                secondIndex === ring.length - 2
            ) {
                continue;
            }


            const secondStart =
                ring[secondIndex];

            const secondEnd =
                ring[secondIndex + 1];


            if (
                segmentsIntersect(
                    firstStart,
                    firstEnd,
                    secondStart,
                    secondEnd
                )
            ) {
                return true;
            }
        }
    }


    return false;
}


/**
 * Determines whether all rings in a Polygon are free
 * of self-intersections.
 */
function polygonHasSelfIntersection(
    coordinates: unknown
): boolean {

    if (!Array.isArray(coordinates)) {
        return true;
    }

    return coordinates.some(
        ring => {

            if (!Array.isArray(ring)) {
                return true;
            }

            return hasRingSelfIntersection(
                ring as number[][]
            );
        }
    );
}


/**
 * Determines whether a Polygon or MultiPolygon contains
 * a self-intersecting ring.
 */
function geometryHasSelfIntersection(
    geometry: GeoJSONFeature["geometry"]
): boolean {

    if (
        geometry === null
    ) {
        return true;
    }


    if (
        geometry.type === "Polygon"
    ) {

        return polygonHasSelfIntersection(
            geometry.coordinates as number[][][]
        );
    }


    if (
        geometry.type === "MultiPolygon"
    ) {

        const polygons =
            geometry.coordinates as number[][][][];


        return polygons.some(
            polygon =>
                polygonHasSelfIntersection(
                    polygon
                )
        );
    }


    return false;
}


export function validateGeometryIntegrity(
    original: GeoJSONFeatureCollection,
    optimized: GeoJSONFeatureCollection
): GeometryIntegrityReport {

    const featureCountPreserved =
        original.features.length ===
        optimized.features.length;


    const geometryTypesPreserved =
        original.features.every(
            (originalFeature, index) => {

                const optimizedFeature =
                    optimized.features[index];

                if (
                    originalFeature.geometry === null ||
                    optimizedFeature.geometry === null
                ) {
                    return (
                        originalFeature.geometry ===
                        optimizedFeature.geometry
                    );
                }

                return (
                    originalFeature.geometry.type ===
                    optimizedFeature.geometry.type
                );
            }
        );


    const validGeometries =
        optimized.features.every(
            featureItem => {

                if (
                    featureItem.geometry === null
                ) {
                    return false;
                }


                try {

                    const turfValid =
                        booleanValid(
                            feature(
                                featureItem.geometry as any
                            )
                        );


                    const hasSelfIntersection =
                        geometryHasSelfIntersection(
                            featureItem.geometry
                        );

                    if (!turfValid || hasSelfIntersection) {
                        console.log(
                            "GEOMETRY INVALID DEBUG:",
                            {
                                district:
                                    featureItem.properties?.district,

                                geometryType:
                                    featureItem.geometry.type,

                                turfValid,

                                hasSelfIntersection
                            }
                        );
                    }

                    return (
                        turfValid &&
                        !hasSelfIntersection
                    );

                } catch {

                    return false;
                }
            }
        );


    const propertiesPreserved =
        original.features.every(
            (originalFeature, index) => {

                const optimizedFeature =
                    optimized.features[index];

                return JSON.stringify(
                    originalFeature.properties
                ) === JSON.stringify(
                    optimizedFeature.properties
                );
            }
        );


    const valid =
        featureCountPreserved &&
        geometryTypesPreserved &&
        validGeometries &&
        propertiesPreserved;


    return {
        featureCountPreserved,
        geometryTypesPreserved,
        validGeometries,
        propertiesPreserved,
        valid
    };
}


// =============================================================================
// Optimization pipeline
// =============================================================================

/**
 * Optimizes normalized municipal boundary geometry.
 *
 * Optimization occurs in two stages:
 *
 * 1. Coordinate precision reduction.
 * 2. Optional Turf geometry simplification.
 *
 * The final geometry is validated against the original
 * normalized geometry. If optimization produces invalid
 * geometry, the original geometry is returned.
 */
export function optimizeGeometry(
    geometry: GeoJSONFeatureCollection,
    options: GeometryOptimizationOptions
): GeometryOptimizationResult {

    const originalVertexCount =
        countVerticesInCollection(
            geometry
        );


    const originalByteSize =
        getByteSize(
            geometry
        );


    /*
     * -------------------------------------------------------------------------
     * Optimization pipeline
     * -------------------------------------------------------------------------
     *
     * Optimization is performed in this order:
     *
     *   1. Coordinate precision reduction
     *   2. Geometry simplification
     *
     * Each stage operates on the result of the previous stage.
     */

    let optimizedGeometry =
        geometry;


    /*
     * -------------------------------------------------------------------------
     * Stage 1: coordinate precision reduction
     * -------------------------------------------------------------------------
     */

    if (
        options.roundCoordinates
    ) {

        optimizedGeometry =
            roundCollectionCoordinates(
                optimizedGeometry,
                options.coordinatePrecision ?? 6
            );
    }


    /*
     * -------------------------------------------------------------------------
     * Stage 2: topology-preserving simplification
     * -------------------------------------------------------------------------
     */

    if (
        options.simplify
    ) {

        optimizedGeometry =
            simplifyCollection(
                optimizedGeometry,
                options.tolerance ?? 0.00001
            );
    }


    /*
     * -------------------------------------------------------------------------
     * Integrity validation
     * -------------------------------------------------------------------------
     *
     * Validate the final optimized geometry against the original
     * normalized geometry.
     */

    const integrity =
        validateGeometryIntegrity(
            geometry,
            optimizedGeometry
        );

    const maxAreaChangeRatio =
        options.maxAreaChangeRatio ??
        0.01;

    const excessiveAreaChange =
        hasExcessiveAreaChange(
            geometry,
            optimizedGeometry,
            maxAreaChangeRatio
        );

    /*
     * Never return invalid geometry.
     *
     * If optimization produced invalid geometry, fall back to the
     * original normalized geometry.
     */

    if (
        !integrity.valid ||
        excessiveAreaChange
    ) {

        optimizedGeometry =
            geometry;
    }


    const optimizedVertexCount =
        countVerticesInCollection(
            optimizedGeometry
        );


    const optimizedByteSize =
        getByteSize(
            optimizedGeometry
        );


    /*
     * Recalculate integrity against the geometry that will actually
     * be returned.
     *
     * This is important when the optimization pipeline falls back
     * to the original geometry.
     */

    const finalIntegrity =
        validateGeometryIntegrity(
            geometry,
            optimizedGeometry
        );


    return {
        geometry:
            optimizedGeometry,

        report: {
            featureCount:
                geometry.features.length,

            originalVertexCount,

            optimizedVertexCount,

            vertexReductionPercent:
                calculateReductionPercent(
                    originalVertexCount,
                    optimizedVertexCount
                ),

            originalByteSize,

            optimizedByteSize,

            byteReductionPercent:
                calculateReductionPercent(
                    originalByteSize,
                    optimizedByteSize
                )
        },

        integrity:
            finalIntegrity
    };
}