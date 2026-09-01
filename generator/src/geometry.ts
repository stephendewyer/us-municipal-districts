import fs from "node:fs";
import path from "node:path";

import type {
    MunicipalDistrictRegistryEntry,
    MunicipalDistrictSource
} from "../../src/types.js";


// =============================================================================
// Types
// =============================================================================

interface GeoJSONGeometry {
    type:
        | "Polygon"
        | "MultiPolygon";

    coordinates: unknown;
}


interface GeoJSONFeature {
    type: "Feature";

    properties:
        Record<string, unknown>;

    geometry:
        | GeoJSONGeometry
        | null;
}


interface GeoJSONFeatureCollection {
    type: "FeatureCollection";

    features:
        GeoJSONFeature[];
}


// =============================================================================
// Generate geometry
// =============================================================================

/**
 * Generate normalized GeoJSON geometry for a municipal registry entry.
 *
 * The registry source URL is expected to point to an ArcGIS FeatureServer
 * or MapServer layer. The ArcGIS /query endpoint is used to retrieve
 * the actual features.
 */
export async function generateGeometry(
    entry: MunicipalDistrictRegistryEntry,
    outputRoot: string
): Promise<string> {

    const source =
        entry.source;


    console.log(
        `    Source: ${source.url}`
    );


    const geojson =
        await fetchArcGISGeoJSON(
            source
        );


    const normalized =
        normalizeGeoJSON(
            geojson,
            source,
            entry
        );


    const outputPath =
        path.join(
            outputRoot,
            entry.generatedFile
        );


    fs.mkdirSync(
        path.dirname(outputPath),
        {
            recursive: true
        }
    );


    fs.writeFileSync(
        outputPath,
        JSON.stringify(
            normalized,
            null,
            2
        ) + "\n",
        "utf8"
    );


    return outputPath;
}


// =============================================================================
// ArcGIS query
// =============================================================================

async function fetchArcGISGeoJSON(
    source: MunicipalDistrictSource
): Promise<unknown> {

    if (
        source.serviceType !== "FeatureServer" &&
        source.serviceType !== "MapServer"
    ) {
        throw new Error(
            `Unsupported ArcGIS service type "${String(source.serviceType)}": ${source.url}`
        );
    }


    /*
     * The registry URL points to the ArcGIS layer itself.
     *
     * Example:
     *
     *   .../FeatureServer/158
     *
     * Actual feature queries must use:
     *
     *   .../FeatureServer/158/query
     */
    const queryUrl =
        new URL(
            source.url.replace(
                /\/+$/,
                ""
            ) + "/query"
        );


    queryUrl.searchParams.set(
        "where",
        "1=1"
    );


    queryUrl.searchParams.set(
        "outFields",
        "*"
    );


    queryUrl.searchParams.set(
        "returnGeometry",
        "true"
    );


    /*
     * Request WGS84 coordinates so the resulting GeoJSON
     * can be consumed directly by Turf, MapLibre, Leaflet,
     * etc.
     */
    queryUrl.searchParams.set(
        "outSR",
        "4326"
    );


    queryUrl.searchParams.set(
        "f",
        "geojson"
    );


    const response =
        await fetch(
            queryUrl
        );


    if (!response.ok) {

        const body =
            await response.text();


        throw new Error(
            `ArcGIS request failed ` +
            `(${response.status} ${response.statusText}): ` +
            `${queryUrl}\n` +
            `Response: ${body.slice(0, 1000)}`
        );
    }


    const result =
        await response.json();


    /*
     * ArcGIS may return an error object with HTTP 200.
     */
    if (
        typeof result === "object" &&
        result !== null
    ) {

        const record =
            result as Record<string, unknown>;


        if (
            record.error &&
            typeof record.error === "object"
        ) {

            const error =
                record.error as Record<string, unknown>;


            throw new Error(
                `ArcGIS query error: ${
                    typeof error.message === "string"
                        ? error.message
                        : JSON.stringify(error)
                }`
            );
        }
    }


    return result;
}


// =============================================================================
// GeoJSON normalization
// =============================================================================

function normalizeGeoJSON(
    value: unknown,
    source: MunicipalDistrictSource,
    entry: MunicipalDistrictRegistryEntry
): GeoJSONFeatureCollection {

    if (
        typeof value !== "object" ||
        value === null
    ) {

        throw new Error(
            "ArcGIS response is not an object."
        );
    }


    const record =
        value as Record<string, unknown>;


    if (
        record.type !==
        "FeatureCollection"
    ) {

        throw new Error(
            "ArcGIS response is not a GeoJSON FeatureCollection."
        );
    }


    if (
        !Array.isArray(record.features)
    ) {

        throw new Error(
            "ArcGIS response has no features."
        );
    }


    const features:
        GeoJSONFeature[] =
        record.features.map(
            feature =>
                normalizeFeature(
                    feature,
                    source,
                    entry
                )
        );


    if (
        features.length === 0
    ) {

        throw new Error(
            "ArcGIS layer returned zero features."
        );
    }


    return {
        type:
            "FeatureCollection",

        features
    };
}


// =============================================================================
// Feature normalization
// =============================================================================

function normalizeFeature(
    value: unknown,
    source: MunicipalDistrictSource,
    entry: MunicipalDistrictRegistryEntry
): GeoJSONFeature {

    if (
        typeof value !== "object" ||
        value === null
    ) {

        throw new Error(
            "Invalid GeoJSON feature."
        );
    }


    const record =
        value as Record<string, unknown>;


    if (
        record.type !== "Feature"
    ) {

        throw new Error(
            "Invalid GeoJSON feature type."
        );
    }


    if (
        typeof record.properties !== "object" ||
        record.properties === null
    ) {

        throw new Error(
            "Feature has no properties."
        );
    }


    const properties =
        record.properties as Record<
            string,
            unknown
        >;


    const districtField =
        source.fieldMapping.district;


    const district =
        properties[
            districtField
        ];


    if (
        district === undefined ||
        district === null
    ) {

        throw new Error(
            `District field "${districtField}" ` +
            "was not found in a feature."
        );
    }


    const normalizedProperties:
        Record<string, unknown> = {

        placeFips:
            entry.placeFips,

        city:
            entry.city,

        state:
            entry.state,

        boundaryType:
            entry.boundaryType,

        district:
            String(district)
    };


    /*
     * Preserve the optional district representative/name field.
     */
    if (
        source.fieldMapping.name
    ) {

        const name =
            properties[
                source.fieldMapping.name
            ];


        if (
            name !== undefined &&
            name !== null
        ) {

            normalizedProperties.name =
                String(name);
        }
    }


    return {
        type:
            "Feature",

        properties:
            normalizedProperties,

        geometry:
            normalizeGeometry(
                record.geometry
            )
    };
}


// =============================================================================
// Geometry validation
// =============================================================================

function normalizeGeometry(
    value: unknown
):
    GeoJSONGeometry {

    if (
        value === null
    ) {

        throw new Error(
            "Feature has null geometry."
        );
    }


    if (
        typeof value !== "object"
    ) {

        throw new Error(
            "Feature has invalid geometry."
        );
    }


    const record =
        value as Record<string, unknown>;


    if (
        record.type !== "Polygon" &&
        record.type !== "MultiPolygon"
    ) {

        throw new Error(
            `Unsupported geometry type: ${String(record.type)}`
        );
    }


    if (
        record.coordinates === undefined
    ) {

        throw new Error(
            "Feature geometry has no coordinates."
        );
    }


    return {
        type:
            record.type,

        coordinates:
            record.coordinates
    };
}