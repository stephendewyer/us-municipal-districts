import type {
    ArcGISQueryFeature
} from "./queryArcGISLayer.js";

import {
    queryArcGISLayer
} from "./queryArcGISLayer.js";

import {
    arcgisRingsToGeoJSON,
    type ArcGISPolygonGeometry
} from "./arcgisGeometry.js";

import type {
    Polygon,
    MultiPolygon
} from "geojson";


// =============================================================================
// Types
// =============================================================================

export type ArcGISGeoJSONGeometry =
    Polygon | MultiPolygon;


export interface ArcGISGeometryQueryResult {

    success:
        boolean;

    url:
        string;

    geometries:
        ArcGISGeoJSONGeometry[];

    featureCount:
        number;

    exceededTransferLimit:
        boolean;

    /**
     * Spatial reference of all returned geometries.
     *
     * This is always WGS 84 / EPSG:4326 because
     * queryArcGISLayerGeometry() explicitly requests
     * outSR=4326 from ArcGIS.
     */
    outputSpatialReference:
        number;

    error?:
        string;
}


// =============================================================================
// Public API
// =============================================================================

/**
 * Query all polygon geometries from an ArcGIS layer.
 *
 * ArcGIS can return only a subset of features when a layer
 * exceeds its transfer limit. This function therefore
 * continues querying until ArcGIS reports that the transfer
 * limit has not been exceeded.
 *
 * All returned geometries are explicitly requested in
 * WGS 84 / EPSG:4326 so that they are compatible with
 * GeoJSON and the Census place geometries used elsewhere
 * in this package.
 */
export async function queryArcGISLayerGeometry(
    url: string,
    options: {
        where?: string;
        pageSize?: number;
    } = {}
): Promise<ArcGISGeometryQueryResult> {

    const normalizedUrl =
        normalizeUrl(url);

    const pageSize =
        options.pageSize ??
        250;

    let offset =
        0;

    const geometries:
        ArcGISGeoJSONGeometry[] = [];

    let totalFeatureCount =
        0;

    let exceededTransferLimit =
        false;

    while (true) {

        const result =
            await queryArcGISLayer(
                normalizedUrl,
                {
                    where:
                        options.where ??
                        "1=1",

                    resultRecordCount:
                        pageSize,

                    resultOffset:
                        offset,

                    returnGeometry:
                        true,

                    outFields:
                        [],

                    /*
                     * Request all geometries in WGS 84.
                     *
                     * This is critical because the rest of
                     * the package performs point-in-polygon
                     * and Census geography comparisons using
                     * longitude/latitude coordinates.
                     */
                    outSR:
                        4326
                }
            );

        if (!result.success) {

            return {
                success:
                    false,

                url:
                    normalizedUrl,

                geometries:
                    [],

                featureCount:
                    totalFeatureCount,

                exceededTransferLimit,

                outputSpatialReference:
                    4326,

                error:
                    result.error ??
                    "ArcGIS geometry query failed."
            };
        }

        totalFeatureCount +=
            result.featureCount;

        for (
            const feature
                of result.features
        ) {

            const geometry =
                normalizeFeatureGeometry(
                    feature
                );

            if (geometry) {

                geometries.push(
                    geometry
                );
            }
        }

        exceededTransferLimit =
            result.exceededTransferLimit;

        /*
         * ArcGIS has returned the final page.
         */
        if (
            !result.exceededTransferLimit ||
            result.featureCount === 0
        ) {
            break;
        }

        /*
         * Prevent an accidental infinite loop if an
         * ArcGIS service reports transfer-limit behavior
         * but does not return any new records.
         */
        if (
            result.featureCount <= 0
        ) {
            break;
        }

        offset +=
            result.featureCount;
    }

    return {
        success:
            true,

        url:
            normalizedUrl,

        geometries,

        featureCount:
            totalFeatureCount,

        exceededTransferLimit,

        outputSpatialReference:
            4326
    };
}


// =============================================================================
// Feature conversion
// =============================================================================

function normalizeFeatureGeometry(
    feature: ArcGISQueryFeature
): ArcGISGeoJSONGeometry | undefined {

    if (
        !feature.geometry ||
        typeof feature.geometry !== "object"
    ) {
        return undefined;
    }

    const geometry =
        feature.geometry as Record<
            string,
            unknown
        >;

    /*
     * This helper currently handles polygon geometries,
     * which ArcGIS represents using "rings".
     */
    if (
        !Array.isArray(
            geometry.rings
        )
    ) {
        return undefined;
    }

    const arcGISGeometry:
        ArcGISPolygonGeometry = {

        rings:
            geometry.rings as number[][][],

        ...(geometry.spatialReference &&
            typeof geometry.spatialReference === "object"
            ? {
                spatialReference:
                    normalizeSpatialReference(
                        geometry.spatialReference
                    )
            }
            : {})
    };

    try {

        return arcgisRingsToGeoJSON(
            arcGISGeometry
        );

    } catch {

        /*
         * A malformed individual feature should not make
         * an otherwise usable layer fail completely.
         */
        return undefined;
    }
}


// =============================================================================
// Spatial reference normalization
// =============================================================================

function normalizeSpatialReference(
    value: object
): {
    wkid?: number;
    latestWkid?: number;
} {

    const record =
        value as Record<
            string,
            unknown
        >;

    return {
        ...(typeof record.wkid === "number"
            ? {
                wkid:
                    record.wkid
            }
            : {}),

        ...(typeof record.latestWkid === "number"
            ? {
                latestWkid:
                    record.latestWkid
            }
            : {})
    };
}


// =============================================================================
// URL normalization
// =============================================================================

function normalizeUrl(
    url: string
): string {

    return url
        .trim()
        .replace(
            /\/+$/,
            ""
        );
}