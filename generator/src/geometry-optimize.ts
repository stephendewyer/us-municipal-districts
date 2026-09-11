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
 * The initial implementation intentionally performs no
 * simplification. Its purpose is to establish a reliable
 * baseline measurement before topology-preserving
 * simplification is introduced.
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
        geometry;

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