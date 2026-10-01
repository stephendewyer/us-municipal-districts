import type {
    GeoJSONFeature,
    GeoJSONFeatureCollection
} from "./geometry.js";

import {
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


export interface GeometryOptimizationResult {

    /**
     * Optimized GeoJSON.
     */
    geometry: GeoJSONFeatureCollection;

    /**
     * Metrics describing the optimization.
     */
    report: GeometryOptimizationReport;
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

    return {
        geometry: optimizedGeometry,

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
        }
    };
}