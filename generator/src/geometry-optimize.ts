import type {
    GeoJSONFeatureCollection
} from "./geometry.js";


export interface GeometryOptimizationOptions {

    /**
     * Whether geometry simplification should be performed.
     *
     * The initial implementation intentionally leaves this disabled
     * so that normalized geometry can be benchmarked before any
     * simplification is introduced.
     */
    simplify: boolean;
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
    reductionPercent: number;
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
 * Optimizes normalized municipal boundary geometry.
 *
 * The initial implementation intentionally performs no
 * simplification. Its purpose is to establish a baseline
 * measurement before topology-preserving simplification
 * is introduced.
 */
export function optimizeGeometry(
    geometry: GeoJSONFeatureCollection,
    options: GeometryOptimizationOptions
): GeometryOptimizationResult {

    void options;

    const originalVertexCount =
        countVerticesInCollection(
            geometry
        );

    /*
     * No simplification is performed yet.
     *
     * Keeping the normalized geometry unchanged establishes
     * a reliable baseline for future optimization.
     */
    const optimizedGeometry =
        geometry;

    const optimizedVertexCount =
        countVerticesInCollection(
            optimizedGeometry
        );

    const reductionPercent =
        originalVertexCount === 0
            ? 0
            : (
                (
                    originalVertexCount -
                    optimizedVertexCount
                ) /
                originalVertexCount
            ) * 100;

    return {
        geometry: optimizedGeometry,

        report: {
            featureCount:
                geometry.features.length,

            originalVertexCount,

            optimizedVertexCount,

            reductionPercent
        }
    };
}