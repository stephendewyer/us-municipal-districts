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