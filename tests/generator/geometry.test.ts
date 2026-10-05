import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, {
    afterEach
} from "node:test";

import type {
    MunicipalDistrictRegistryEntry,
    MunicipalDistrictSource
} from "../../src/types.js";

import {
    generateGeometry
} from "../../generator/src/geometry.js";

import {
    optimizeGeometry,
    validateGeometryIntegrity
} from "../../generator/src/geometry-optimize.js";


// =============================================================================
// Test helpers
// =============================================================================

const originalFetch =
    globalThis.fetch;

const temporaryDirectories:
    string[] = [];


afterEach(
    async () => {

        globalThis.fetch =
            originalFetch;

        for (
            const directory
            of temporaryDirectories
        ) {

            await fs.rm(
                directory,
                {
                    recursive: true,
                    force: true
                }
            );
        }

        temporaryDirectories.length = 0;
    }
);


function createSource(
    overrides:
        Partial<MunicipalDistrictSource> = {}
):
    MunicipalDistrictSource {

    return {
        sourceType:
            "arcgis",

        url:
            "https://example.com/arcgis/rest/services/TucsonWards/FeatureServer/0",

        serviceType:
            "FeatureServer",

        title:
            "Tucson Wards",

        official:
            true,

        verified:
            true,

        fieldMapping:
            {
                district:
                    "WARD",

                name:
                    "NAME"
            },

        ...overrides
    };
}


function createEntry(
    source:
        MunicipalDistrictSource =
            createSource()
):
    MunicipalDistrictRegistryEntry {

    /*
     * The production registry entry contains additional metadata.
     * These tests only need the fields consumed by generateGeometry().
     */
    return {
        placeFips:
            "0477000",

        city:
            "Tucson",

        state:
            "AZ",

        boundaryType:
            "ward",

        source,

        generatedFile:
            "geometry/0477000/ward.geojson",

        metadata:
            {}
    } as MunicipalDistrictRegistryEntry;
}


function createFeatureCollection(
    geometry:
        Record<string, unknown>,
    properties:
        Record<string, unknown> = {
            WARD: 1,
            NAME: "Ward 1"
        }
) {

    return {
        type:
            "FeatureCollection",

        features: [
            {
                type:
                    "Feature",

                properties,

                geometry
            }
        ]
    };
}


function mockFetch(
    responseBody:
        unknown,
    status = 200,
    statusText = "OK"
) {

    let requestedUrl:
        string | undefined;

    globalThis.fetch =
        (async (
            input:
                RequestInfo | URL
        ) => {

            requestedUrl =
                String(input);

            return new Response(
                JSON.stringify(
                    responseBody
                ),
                {
                    status,
                    statusText,
                    headers: {
                        "content-type":
                            "application/json"
                    }
                }
            );
        }) as typeof fetch;

    return {
        getRequestedUrl:
            () => requestedUrl
    };
}


async function createTemporaryDirectory():
    Promise<string> {

    const directory =
        await fs.mkdtemp(
            path.join(
                os.tmpdir(),
                "us-municipal-districts-geometry-"
            )
        );

    temporaryDirectories.push(
        directory
    );

    return directory;
}


// =============================================================================
// Tests
// =============================================================================

test(
    "generateGeometry queries a FeatureServer layer and writes normalized GeoJSON",
    async () => {

        const entry =
            createEntry(
                createSource({
                    url:
                        "https://example.com/arcgis/rest/services/TucsonWards/FeatureServer/0"
                })
            );

        const geometry = {
            type:
                "Polygon",

            coordinates: [
                [
                    [-110.98, 32.22],
                    [-110.97, 32.22],
                    [-110.97, 32.23],
                    [-110.98, 32.23],
                    [-110.98, 32.22]
                ]
            ]
        };

        const mock =
            mockFetch(
                createFeatureCollection(
                    geometry,
                    {
                        WARD:
                            1,

                        NAME:
                            "Ward 1",

                        ignoredField:
                            "should not be preserved"
                    }
                )
            );

        const outputRoot =
            await createTemporaryDirectory();

        const outputPath =
            await generateGeometry(
                entry,
                outputRoot
            );

        assert.equal(
            mock.getRequestedUrl(),
            "https://example.com/arcgis/rest/services/TucsonWards/FeatureServer/0/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=geojson"
        );

        assert.equal(
            outputPath,
            path.join(
                outputRoot,
                "geometry/0477000/ward.geojson"
            )
        );

        const output =
            JSON.parse(
                await fs.readFile(
                    outputPath,
                    "utf8"
                )
            );

        assert.deepEqual(
            output,
            {
                type:
                    "FeatureCollection",

                features: [
                    {
                        type:
                            "Feature",

                        properties: {
                            placeFips:
                                "0477000",

                            city:
                                "Tucson",

                            state:
                                "AZ",

                            boundaryType:
                                "ward",

                            district:
                                "1",

                            name:
                                "Ward 1"
                        },

                        geometry
                    }
                ]
            }
        );
    }
);


test(
    "generateGeometry queries a MapServer layer",
    async () => {

        const entry =
            createEntry(
                createSource({
                    serviceType:
                        "MapServer",

                    url:
                        "https://example.com/arcgis/rest/services/TucsonWards/MapServer/3"
                })
            );

        const mock =
            mockFetch(
                createFeatureCollection({
                    type:
                        "MultiPolygon",

                    coordinates: [
                        [
                            [
                                [-110.98, 32.22],
                                [-110.97, 32.22],
                                [-110.97, 32.23],
                                [-110.98, 32.23],
                                [-110.98, 32.22]
                            ]
                        ]
                    ]
                })
            );

        const outputRoot =
            await createTemporaryDirectory();

        await generateGeometry(
            entry,
            outputRoot
        );

        assert.equal(
            mock.getRequestedUrl(),
            "https://example.com/arcgis/rest/services/TucsonWards/MapServer/3/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=geojson"
        );
    }
);


test(
    "generateGeometry rejects unsupported ArcGIS service types",
    async () => {

        const entry =
            createEntry(
                createSource({
                    serviceType:
                        "unknown"
                })
            );

        const outputRoot =
            await createTemporaryDirectory();

        await assert.rejects(
            () =>
                generateGeometry(
                    entry,
                    outputRoot
                ),

            /Unsupported ArcGIS service type "unknown"/
        );
    }
);


test(
    "generateGeometry rejects HTTP errors",
    async () => {

        const entry =
            createEntry();

        mockFetch(
            {
                error:
                    "Service unavailable"
            },
            500,
            "Internal Server Error"
        );

        const outputRoot =
            await createTemporaryDirectory();

        await assert.rejects(
            () =>
                generateGeometry(
                    entry,
                    outputRoot
                ),

            /ArcGIS request failed \(500 Internal Server Error\)/
        );
    }
);


test(
    "generateGeometry rejects ArcGIS errors returned with HTTP 200",
    async () => {

        const entry =
            createEntry();

        mockFetch({
            error: {
                code:
                    400,

                message:
                    "Invalid query"
            }
        });

        const outputRoot =
            await createTemporaryDirectory();

        await assert.rejects(
            () =>
                generateGeometry(
                    entry,
                    outputRoot
                ),

            /ArcGIS query error: Invalid query/
        );
    }
);


test(
    "generateGeometry rejects non-FeatureCollection responses",
    async () => {

        const entry =
            createEntry();

        mockFetch({
            type:
                "Feature"
        });

        const outputRoot =
            await createTemporaryDirectory();

        await assert.rejects(
            () =>
                generateGeometry(
                    entry,
                    outputRoot
                ),

            /ArcGIS response is not a GeoJSON FeatureCollection/
        );
    }
);


test(
    "generateGeometry rejects empty FeatureCollections",
    async () => {

        const entry =
            createEntry();

        mockFetch({
            type:
                "FeatureCollection",

            features: []
        });

        const outputRoot =
            await createTemporaryDirectory();

        await assert.rejects(
            () =>
                generateGeometry(
                    entry,
                    outputRoot
                ),

            /ArcGIS layer returned zero features/
        );
    }
);


test(
    "generateGeometry rejects features without a district field",
    async () => {

        const entry =
            createEntry();

        mockFetch(
            createFeatureCollection(
                {
                    type:
                        "Polygon",

                    coordinates: [
                        [
                            [-110.98, 32.22],
                            [-110.97, 32.22],
                            [-110.97, 32.23],
                            [-110.98, 32.23],
                            [-110.98, 32.22]
                        ]
                    ]
                },
                {
                    NAME:
                        "Ward 1"
                }
            )
        );

        const outputRoot =
            await createTemporaryDirectory();

        await assert.rejects(
            () =>
                generateGeometry(
                    entry,
                    outputRoot
                ),

            /District field "WARD" was not found in a feature/
        );
    }
);


test(
    "generateGeometry rejects null geometry",
    async () => {

        const entry =
            createEntry();

        mockFetch({
            type:
                "FeatureCollection",

            features: [
                {
                    type:
                        "Feature",

                    properties: {
                        WARD:
                            1
                    },

                    geometry:
                        null
                }
            ]
        });

        const outputRoot =
            await createTemporaryDirectory();

        await assert.rejects(
            () =>
                generateGeometry(
                    entry,
                    outputRoot
                ),

            /Feature has null geometry/
        );
    }
);


test(
    "generateGeometry rejects unsupported geometry types",
    async () => {

        const entry =
            createEntry();

        mockFetch(
            createFeatureCollection({
                type:
                    "Point",

                coordinates: [
                    -110.98,
                    32.22
                ]
            })
        );

        const outputRoot =
            await createTemporaryDirectory();

        await assert.rejects(
            () =>
                generateGeometry(
                    entry,
                    outputRoot
                ),

            /Unsupported geometry type: Point/
        );
    }
);


test(
    "generateGeometry rejects malformed geometry coordinates",
    async () => {

        const entry =
            createEntry();

        mockFetch(
            createFeatureCollection({
                type:
                    "Polygon"
            })
        );

        const outputRoot =
            await createTemporaryDirectory();

        await assert.rejects(
            () =>
                generateGeometry(
                    entry,
                    outputRoot
                ),

            /Feature geometry has invalid coordinates/
        );
    }
);


test(
    "generateGeometry omits name when the configured name field is null",
    async () => {

        const entry =
            createEntry();

        mockFetch(
            createFeatureCollection(
                {
                    type:
                        "Polygon",

                    coordinates: [
                        [
                            [-110.98, 32.22],
                            [-110.97, 32.22],
                            [-110.97, 32.23],
                            [-110.98, 32.23],
                            [-110.98, 32.22]
                        ]
                    ]
                },
                {
                    WARD:
                        2,

                    NAME:
                        null
                }
            )
        );

        const outputRoot =
            await createTemporaryDirectory();

        const outputPath =
            await generateGeometry(
                entry,
                outputRoot
            );

        const output =
            JSON.parse(
                await fs.readFile(
                    outputPath,
                    "utf8"
                )
            );

        assert.deepEqual(
            output.features[0].properties,
            {
                placeFips:
                    "0477000",

                city:
                    "Tucson",

                state:
                    "AZ",

                boundaryType:
                    "ward",

                district:
                    "2"
            }
        );
    }
);


test(
    "optimizeGeometry preserves geometry when simplification is disabled",
    () => {

        const geometry = {
            type:
                "FeatureCollection" as const,

            features: [
                {
                    type:
                        "Feature" as const,

                    properties: {
                        district:
                            "1"
                    },

                    geometry: {
                        type:
                            "Polygon" as const,

                        coordinates: [
                            [
                                [0, 0],
                                [1, 0],
                                [1, 1],
                                [0, 1],
                                [0, 0]
                            ]
                        ]
                    }
                }
            ]
        };

        const result =
            optimizeGeometry(
                geometry,
                {
                    roundCoordinates: true,
                    coordinatePrecision: 6,
                    simplify: true,
                    tolerance: 0.00001
                }
            );

        assert.deepEqual(
            result.geometry,
            geometry
        );

        assert.equal(
            result.report.featureCount,
            1
        );

        assert.equal(
            result.report.originalVertexCount,
            5
        );

        assert.equal(
            result.report.optimizedVertexCount,
            5
        );

        assert.equal(
            result.report.vertexReductionPercent,
            0
        );

        assert.equal(
            result.report.originalByteSize,
            result.report.optimizedByteSize
        );

        assert.equal(
            result.report.byteReductionPercent,
            0
        );
    }
);


test(
    "optimizeGeometry falls back to original geometry when optimization changes area excessively",
    () => {

        const geometry = {
            type:
                "FeatureCollection" as const,

            features: [
                {
                    type:
                        "Feature" as const,

                    properties: {
                        district:
                            "1"
                    },

                    geometry: {
                        type:
                            "Polygon" as const,

                        coordinates: [
                            [
                                [0.1, 0.1],
                                [0.9, 0.1],
                                [0.9, 0.9],
                                [0.1, 0.9],
                                [0.1, 0.1]
                            ]
                        ]
                    }
                }
            ]
        };

        const result =
            optimizeGeometry(
                geometry,
                {
                    roundCoordinates:
                        true,

                    coordinatePrecision:
                        0,

                    simplify:
                        false,

                    maxAreaChangeRatio:
                        0.01
                }
            );


        assert.deepEqual(
            result.geometry,
            geometry
        );

        assert.equal(
            result.integrity.valid,
            true
        );

        assert.equal(
            result.report.originalVertexCount,
            result.report.optimizedVertexCount
        );

        assert.equal(
            result.report.originalByteSize,
            result.report.optimizedByteSize
        );

        assert.equal(
            result.report.vertexReductionPercent,
            0
        );

        assert.equal(
            result.report.byteReductionPercent,
            0
        );
    }
);


test(
    "optimizeGeometry allows optimization within the area-change threshold",
    () => {

        const geometry = {
            type:
                "FeatureCollection" as const,

            features: [
                {
                    type:
                        "Feature" as const,

                    properties: {
                        district:
                            "1"
                    },

                    geometry: {
                        type:
                            "Polygon" as const,

                        coordinates: [
                            [
                                [0, 0],
                                [1, 0],
                                [1, 1],
                                [0, 1],
                                [0, 0]
                            ]
                        ]
                    }
                }
            ]
        };

        const result =
            optimizeGeometry(
                geometry,
                {
                    roundCoordinates:
                        true,

                    coordinatePrecision:
                        0,

                    simplify:
                        false,

                    maxAreaChangeRatio:
                        0.01
                }
            );


        assert.deepEqual(
            result.geometry,
            geometry
        );

        assert.equal(
            result.integrity.valid,
            true
        );
    }
);


test(
    "optimizeGeometry counts Polygon and MultiPolygon vertices",
    () => {

        const geometry = {
            type:
                "FeatureCollection" as const,

            features: [
                {
                    type:
                        "Feature" as const,

                    properties: {},

                    geometry: {
                        type:
                            "Polygon" as const,

                        coordinates: [
                            [
                                [0, 0],
                                [1, 0],
                                [1, 1],
                                [0, 1],
                                [0, 0]
                            ]
                        ]
                    }
                },
                {
                    type:
                        "Feature" as const,

                    properties: {},

                    geometry: {
                        type:
                            "MultiPolygon" as const,

                        coordinates: [
                            [
                                [
                                    [2, 2],
                                    [3, 2],
                                    [3, 3],
                                    [2, 3],
                                    [2, 2]
                                ]
                            ],
                            [
                                [
                                    [4, 4],
                                    [5, 4],
                                    [5, 5],
                                    [4, 5],
                                    [4, 4]
                                ]
                            ]
                        ]
                    }
                }
            ]
        };

        const result =
            optimizeGeometry(
                geometry,
                {
                    roundCoordinates: true,
                    coordinatePrecision: 6,
                    simplify: true,
                    tolerance: 0.00001
                }
            );

        assert.equal(
            result.report.featureCount,
            2
        );

        assert.equal(
            result.report.originalVertexCount,
            15
        );

        assert.equal(
            result.report.optimizedVertexCount,
            15
        );
    }
);


test(
    "optimizeGeometry simplifies geometry when enabled",
    () => {

        const geometry = {
            type:
                "FeatureCollection" as const,

            features: [
                {
                    type:
                        "Feature" as const,

                    properties: {
                        district:
                            "1"
                    },

                    geometry: {
                        type:
                            "Polygon" as const,

                        coordinates: [
                            [
                                [0, 0],
                                [0.1, 0],
                                [0.2, 0],
                                [0.3, 0],
                                [0.4, 0],
                                [1, 0],
                                [1, 1],
                                [0, 1],
                                [0, 0]
                            ]
                        ]
                    }
                }
            ]
        };

        const result =
            optimizeGeometry(
                geometry,
                {
                    roundCoordinates: true,
                    coordinatePrecision: 6,
                    simplify: true,
                    tolerance: 0.00001
                }
            );

        assert.ok(
            result.report.optimizedVertexCount <
            result.report.originalVertexCount
        );

        assert.ok(
            result.report.optimizedByteSize <
            result.report.originalByteSize
        );

        assert.ok(
            result.report.vertexReductionPercent >
            0
        );

        assert.ok(
            result.report.byteReductionPercent >
            0
        );
    }
);


test(
    "optimizeGeometry reports valid geometry integrity",
    () => {

        const geometry = {
            type:
                "FeatureCollection" as const,

            features: [
                {
                    type:
                        "Feature" as const,

                    properties: {
                        district:
                            "1"
                    },

                    geometry: {
                        type:
                            "Polygon" as const,

                        coordinates: [
                            [
                                [-110.98, 32.22],
                                [-110.97, 32.22],
                                [-110.97, 32.23],
                                [-110.98, 32.23],
                                [-110.98, 32.22]
                            ]
                        ]
                    }
                }
            ]
        };


        const result =
            optimizeGeometry(
                geometry,
                {
                    roundCoordinates: true,
                    coordinatePrecision: 6,
                    simplify: true,
                    tolerance: 0.00001
                }
            );


        assert.equal(
            result.integrity.featureCountPreserved,
            true
        );

        assert.equal(
            result.integrity.geometryTypesPreserved,
            true
        );

        assert.equal(
            result.integrity.validGeometries,
            true
        );

        assert.equal(
            result.integrity.propertiesPreserved,
            true
        );

        assert.equal(
            result.integrity.valid,
            true
        );
    }
);


test(
    "validateGeometryIntegrity detects changed properties",
    () => {

        const original = {
            type: "FeatureCollection" as const,
            features: [
                {
                    type: "Feature" as const,
                    properties: {
                        district: "1"
                    },
                    geometry: {
                        type: "Polygon" as const,
                        coordinates: [
                            [
                                [-110.98, 32.22],
                                [-110.97, 32.22],
                                [-110.97, 32.23],
                                [-110.98, 32.23],
                                [-110.98, 32.22]
                            ]
                        ]
                    }
                }
            ]
        };

        const changed = {
            ...original,
            features: [
                {
                    ...original.features[0],
                    properties: {
                        district: "2"
                    }
                }
            ]
        };

        const result =
            validateGeometryIntegrity(
                original,
                changed
            );

        assert.equal(
            result.propertiesPreserved,
            false
        );

        assert.equal(
            result.valid,
            false
        );
    }
);


test(
    "geometry integrity detects invalid geometry",
    () => {

        const geometry = {
            type:
                "FeatureCollection" as const,

            features: [
                {
                    type:
                        "Feature" as const,

                    properties: {
                        district:
                            "1"
                    },

                    geometry: {
                        type:
                            "Polygon" as const,

                        coordinates: [
                            [
                                [-110.98, 32.22],
                                [-110.97, 32.23],
                                [-110.97, 32.22],
                                [-110.98, 32.23],
                                [-110.98, 32.22]
                            ]
                        ]
                    }
                }
            ]
        };

        const result =
            validateGeometryIntegrity(
                geometry,
                geometry
            );

        assert.equal(
            result.validGeometries,
            false
        );

        assert.equal(
            result.valid,
            false
        );
    }
);


test(
    "geometry optimization preserves geometry when simplification is disabled",
    () => {

        const geometry = {
            type:
                "FeatureCollection" as const,

            features: [
                {
                    type:
                        "Feature" as const,

                    properties: {
                        district:
                            "1"
                    },

                    geometry: {
                        type:
                            "Polygon" as const,

                        coordinates: [
                            [
                                [-110.98, 32.22],
                                [-110.97, 32.22],
                                [-110.97, 32.23],
                                [-110.98, 32.23],
                                [-110.98, 32.22]
                            ]
                        ]
                    }
                }
            ]
        };


        const result =
            optimizeGeometry(
                geometry,
                {
                    roundCoordinates: true,
                    coordinatePrecision: 6,
                    simplify: false,
                    tolerance: 0.00001
                }
            );


        assert.deepEqual(
            result.geometry,
            geometry
        );


        assert.equal(
            result.report.originalVertexCount,
            result.report.optimizedVertexCount
        );


        assert.equal(
            result.report.originalByteSize,
            result.report.optimizedByteSize
        );


        assert.equal(
            result.report.vertexReductionPercent,
            0
        );


        assert.equal(
            result.report.byteReductionPercent,
            0
        );


        assert.equal(
            result.integrity.valid,
            true
        );
    }
);


test(
    "geometry optimization reduces vertices when simplification is enabled",
    () => {

        const geometry = {
            type:
                "FeatureCollection" as const,

            features: [
                {
                    type:
                        "Feature" as const,

                    properties: {
                        district:
                            "1"
                    },

                    geometry: {
                        type:
                            "Polygon" as const,

                        coordinates: [
                            [
                                [-110.9800, 32.2200],
                                [-110.9799, 32.2200],
                                [-110.9798, 32.2200],
                                [-110.9797, 32.2200],
                                [-110.9796, 32.2200],
                                [-110.9795, 32.2200],
                                [-110.9794, 32.2200],
                                [-110.9793, 32.2200],
                                [-110.9792, 32.2200],
                                [-110.9791, 32.2200],
                                [-110.9790, 32.2200],
                                [-110.9790, 32.2300],
                                [-110.9800, 32.2300],
                                [-110.9800, 32.2200]
                            ]
                        ]
                    }
                }
            ]
        };


        const result =
            optimizeGeometry(
                geometry,
                {
                    roundCoordinates: true,
                    coordinatePrecision: 6,
                    simplify: true,
                    tolerance: 0.00001
                }
            );


        assert.ok(
            result.report.optimizedVertexCount <
            result.report.originalVertexCount
        );


        assert.ok(
            result.report.vertexReductionPercent >
            0
        );


        assert.ok(
            result.report.optimizedByteSize <
            result.report.originalByteSize
        );


        assert.ok(
            result.report.byteReductionPercent >
            0
        );


        assert.equal(
            result.integrity.valid,
            true
        );
    }
);


test(
    "geometry optimization preserves district properties",
    () => {

        const geometry = {
            type:
                "FeatureCollection" as const,

            features: [
                {
                    type:
                        "Feature" as const,

                    properties: {
                        district:
                            "1",

                        name:
                            "Ward 1"
                    },

                    geometry: {
                        type:
                            "Polygon" as const,

                        coordinates: [
                            [
                                [-110.98, 32.22],
                                [-110.97, 32.22],
                                [-110.97, 32.23],
                                [-110.98, 32.23],
                                [-110.98, 32.22]
                            ]
                        ]
                    }
                }
            ]
        };


        const result =
            optimizeGeometry(
                geometry,
                {
                    roundCoordinates: true,
                    coordinatePrecision: 6,
                    simplify: true,
                    tolerance: 0.00001
                }
            );


        assert.deepEqual(
            result.geometry.features[0].properties,
            geometry.features[0].properties
        );


        assert.equal(
            result.integrity.propertiesPreserved,
            true
        );
    }
);


test(
    "geometry optimization preserves polygon holes",
    () => {

        const geometry = {
            type:
                "FeatureCollection" as const,

            features: [
                {
                    type:
                        "Feature" as const,

                    properties: {
                        district:
                            "1"
                    },

                    geometry: {
                        type:
                            "Polygon" as const,

                        coordinates: [

                            // Outer ring
                            [
                                [-110.99, 32.21],
                                [-110.96, 32.21],
                                [-110.96, 32.24],
                                [-110.99, 32.24],
                                [-110.99, 32.21]
                            ],

                            // Hole
                            [
                                [-110.98, 32.22],
                                [-110.97, 32.22],
                                [-110.97, 32.23],
                                [-110.98, 32.23],
                                [-110.98, 32.22]
                            ]
                        ]
                    }
                }
            ]
        };


        const result =
            optimizeGeometry(
                geometry,
                {
                    roundCoordinates: true,
                    coordinatePrecision: 6,
                    simplify: true,
                    tolerance: 0.00001
                }
            );


        const optimized =
            result.geometry.features[0].geometry;


        assert.ok(
            optimized !== null
        );


        if (
            optimized.type !== "Polygon"
        ) {
            throw new Error(
                "Expected optimized geometry to be a Polygon"
            );
        }


        const coordinates =
            optimized.coordinates as number[][][];

        assert.equal(
            coordinates.length,
            2
        );


        assert.equal(
            result.integrity.valid,
            true
        );
    }
);


test(
    "geometry optimization rounds coordinate precision",
    () => {

        const geometry = {
            type: "FeatureCollection" as const,

            features: [
                {
                    type: "Feature" as const,

                    properties: {
                        district: "1"
                    },

                    geometry: {
                        type: "Polygon" as const,

                        coordinates: [
                            [
                                [-110.980123456, 32.220123456],
                                [-110.970123456, 32.220123456],
                                [-110.970123456, 32.230123456],
                                [-110.980123456, 32.230123456],
                                [-110.980123456, 32.220123456]
                            ]
                        ]
                    }
                }
            ]
        };


        const result =
            optimizeGeometry(
                geometry,
                {
                    roundCoordinates: true,
                    simplify: false,
                    coordinatePrecision: 6
                }
            );


        const optimized =
            result.geometry.features[0].geometry;


        assert.ok(
            optimized !== null
        );


        assert.equal(
            optimized.type,
            "Polygon"
        );


        if (
            optimized.type !== "Polygon"
        ) {
            throw new Error(
                "Expected optimized geometry to be a Polygon"
            );
        }


        const coordinates =
            optimized.coordinates as number[][][];


        assert.deepEqual(
            coordinates[0][0],
            [-110.980123, 32.220123]
        );
    }
);


test(
    "optimizeGeometry produces deterministic output",
    () => {

        const geometry = {
            type: "FeatureCollection" as const,
            features: [
                {
                    type: "Feature" as const,
                    properties: {
                        district: "1"
                    },
                    geometry: {
                        type: "Polygon" as const,
                        coordinates: [
                            [
                                [-110.980123456, 32.220123456],
                                [-110.9799, 32.2200],
                                [-110.9795, 32.2200],
                                [-110.9790, 32.2200],
                                [-110.9790, 32.2300],
                                [-110.9800, 32.2300],
                                [-110.980123456, 32.220123456]
                            ]
                        ]
                    }
                }
            ]
        };

        const options = {
            roundCoordinates: true,
            coordinatePrecision: 6,
            simplify: true,
            tolerance: 0.00001
        };

        const first =
            optimizeGeometry(
                geometry,
                options
            );

        const second =
            optimizeGeometry(
                geometry,
                options
            );

        assert.deepEqual(
            first.geometry,
            second.geometry
        );

        assert.deepEqual(
            first.report,
            second.report
        );

        assert.deepEqual(
            first.integrity,
            second.integrity
        );
    }
);


test(
    "optimizeGeometry never increases vertex or byte counts",
    () => {

        const geometry = {
            type: "FeatureCollection" as const,
            features: [
                {
                    type: "Feature" as const,
                    properties: {
                        district: "1"
                    },
                    geometry: {
                        type: "Polygon" as const,
                        coordinates: [
                            [
                                [-110.980123456, 32.220123456],
                                [-110.970123456, 32.220123456],
                                [-110.970123456, 32.230123456],
                                [-110.980123456, 32.230123456],
                                [-110.980123456, 32.220123456]
                            ]
                        ]
                    }
                }
            ]
        };

        const result =
            optimizeGeometry(
                geometry,
                {
                    roundCoordinates: true,
                    coordinatePrecision: 6,
                    simplify: true,
                    tolerance: 0.00001
                }
            );

        assert.ok(
            result.report.optimizedVertexCount <=
            result.report.originalVertexCount
        );

        assert.ok(
            result.report.optimizedByteSize <=
            result.report.originalByteSize
        );
    }
);