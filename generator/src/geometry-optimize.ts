import type {
    GeoJSONFeature,
    GeoJSONFeatureCollection
} from "./geometry.js";

import {
    booleanValid,
    feature,
    simplify
} from "@turf/turf";


export interface GeometryOptimizationOptions {

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
            feature
        ) => {

            if (!feature.geometry) {
                return count;
            }

            return (
                count +
                countVertices(
                    feature.geometry.coordinates
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
 * Determines whether two line segments intersect.
 *
 * This includes proper crossings as well as collinear overlap.
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
                (q[1] - p[1]) *
                (r[0] - q[0]) -
                (q[0] - p[0]) *
                (r[1] - q[1]);

            if (Math.abs(value) < Number.EPSILON) {
                return 0;
            }

            return value > 0
                ? 1
                : 2;
        };


    const onSegment =
        (
            p: number[],
            q: number[],
            r: number[]
        ): boolean => {

            return (
                q[0] >= Math.min(p[0], r[0]) &&
                q[0] <= Math.max(p[0], r[0]) &&
                q[1] >= Math.min(p[1], r[1]) &&
                q[1] <= Math.max(p[1], r[1])
            );
        };


    const orientation1 =
        orientation(a, b, c);

    const orientation2 =
        orientation(a, b, d);

    const orientation3 =
        orientation(c, d, a);

    const orientation4 =
        orientation(c, d, b);


    /*
     * General case: the two segments cross.
     */
    if (
        orientation1 !== orientation2 &&
        orientation3 !== orientation4
    ) {
        return true;
    }


    /*
     * Special cases: collinear segments overlap.
     */
    if (
        orientation1 === 0 &&
        onSegment(a, c, b)
    ) {
        return true;
    }

    if (
        orientation2 === 0 &&
        onSegment(a, d, b)
    ) {
        return true;
    }

    if (
        orientation3 === 0 &&
        onSegment(c, a, d)
    ) {
        return true;
    }

    if (
        orientation4 === 0 &&
        onSegment(c, b, d)
    ) {
        return true;
    }


    return false;
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

    if (ring.length < 4) {
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

            /*
             * Adjacent segments legitimately share an endpoint.
             */
            if (
                secondIndex ===
                firstIndex + 1
            ) {
                continue;
            }


            /*
             * The first and final segments legitimately
             * share the closing vertex.
             */
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

function validateGeometryIntegrity(
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

/**
 * Optimizes normalized municipal boundary geometry.
 *
 * When enabled, geometry is simplified using Turf with the
 * configured tolerance. Optimization metrics are calculated
 * against the original normalized geometry.
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
     * No simplification is performed yet.
     *
     * Keeping the normalized geometry unchanged establishes
     * a reliable baseline for future optimization.
     */
    const optimizedGeometry =
        options.simplify
            ? simplifyCollection(
                geometry,
                options.tolerance ?? 0.00001
            )
            : geometry;


    const optimizedVertexCount =
        countVerticesInCollection(
            optimizedGeometry
        );


    const optimizedByteSize =
        getByteSize(
            optimizedGeometry
        );


    const integrity =
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

        integrity
    };
}