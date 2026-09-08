import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test, {
    after
} from "node:test";

import {
    validateRegistryData
} from "../../generator/src/validate.js";

import type {
    RegistryEntry,
    RegistrySource
} from "../../generator/src/types.js";


// =============================================================================
// Test directory
// =============================================================================

const testDirectory =
    path.resolve(
        "data",
        ".validate-tests"
    );


after(
    async () => {

        await fs.rm(
            testDirectory,
            {
                recursive: true,
                force: true
            }
        );
    }
);


// =============================================================================
// Test helpers
// =============================================================================

async function writeGeometry(
    fileName: string,
    geometry: unknown
): Promise<string> {

    await fs.mkdir(
        testDirectory,
        {
            recursive: true
        }
    );

    const absolutePath =
        path.join(
            testDirectory,
            fileName
        );

    await fs.writeFile(
        absolutePath,
        JSON.stringify(
            geometry,
            null,
            2
        ),
        "utf8"
    );

    return path
        .relative(
            path.resolve("data"),
            absolutePath
        )
        .replaceAll(
            path.sep,
            "/"
        );
}


async function writeRawGeometry(
    fileName: string,
    contents: string
): Promise<string> {

    await fs.mkdir(
        testDirectory,
        {
            recursive: true
        }
    );

    const absolutePath =
        path.join(
            testDirectory,
            fileName
        );

    await fs.writeFile(
        absolutePath,
        contents,
        "utf8"
    );

    return path
        .relative(
            path.resolve("data"),
            absolutePath
        )
        .replaceAll(
            path.sep,
            "/"
        );
}


function createSource(
    overrides:
        Partial<RegistrySource> = {}
): RegistrySource {

    return {
        sourceType:
            "arcgis",

        url:
            "https://example.com/arcgis/rest/services/TucsonWards/FeatureServer/0",

        itemId:
            "test-item-id",

        serviceType:
            "FeatureServer",

        title:
            "Tucson Wards",

        official:
            true,

        verified:
            true,

        fieldMapping: {
            district:
                "WARD",

            name:
                "NAME"
        },

        ...overrides
    };
}


function createEntry(
    generatedFile: string
): RegistryEntry {

    return {
        placeFips:
            "0477000",

        city:
            "Tucson",

        state:
            "AZ",

        boundaryType:
            "ward",

        source:
            createSource(),

        generatedFile,

        metadata: {
            generatedAt:
                "2026-09-07T00:00:00.000Z",

            generatorVersion:
                "0.1.0",

            alternatives: [],

            requiresReview:
                false
        }
    };
}


function createRegistry(
    entry: RegistryEntry
) {

    return {
        version:
            "0.1.0",

        generatedAt:
            "2026-09-07T00:00:00.000Z",

        entries: [
            entry
        ]
    };
}


function createPolygonGeometry() {

    return {
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
                        "Ward 1",

                    name:
                        "Lane Santa Cruz"
                },

                geometry: {
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
                }
            }
        ]
    };
}


function createMultiPolygonGeometry() {

    return {
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
                        "Ward 1"
                },

                geometry: {
                    type:
                        "MultiPolygon",

                    coordinates: [
                        [
                            [
                                [
                                    -110.98,
                                    32.22
                                ],
                                [
                                    -110.97,
                                    32.22
                                ],
                                [
                                    -110.97,
                                    32.23
                                ],
                                [
                                    -110.98,
                                    32.23
                                ],
                                [
                                    -110.98,
                                    32.22
                                ]
                            ]
                        ]
                    ]
                }
            }
        ]
    };
}


// =============================================================================
// Valid geometry
// =============================================================================

test(
    "validateRegistryData accepts a valid registry and generated geometry",
    async () => {

        const generatedFile =
            await writeGeometry(
                "valid.geojson",
                createPolygonGeometry()
            );

        const registry =
            createRegistry(
                createEntry(
                    generatedFile
                )
            );

        const result =
            validateRegistryData(
                registry
            );

        assert.equal(
            result.valid,
            true
        );

        assert.equal(
            result.entries,
            1
        );

        assert.deepEqual(
            result.errors,
            []
        );
    }
);


test(
    "validateRegistryData accepts MultiPolygon geometry",
    async () => {

        const generatedFile =
            await writeGeometry(
                "multipolygon.geojson",
                createMultiPolygonGeometry()
            );

        const registry =
            createRegistry(
                createEntry(
                    generatedFile
                )
            );

        const result =
            validateRegistryData(
                registry
            );

        assert.equal(
            result.valid,
            true
        );

        assert.deepEqual(
            result.errors,
            []
        );
    }
);


// =============================================================================
// Generated file validation
// =============================================================================

test(
    "validateRegistryData rejects a missing generated geometry file",
    () => {

        const entry =
            createEntry(
                ".validate-tests/missing.geojson"
            );

        const result =
            validateRegistryData(
                createRegistry(
                    entry
                )
            );

        assert.equal(
            result.valid,
            false
        );

        assert.ok(
            result.errors.some(
                error =>
                    error.includes(
                        "generatedFile does not exist"
                    )
            )
        );
    }
);


test(
    "validateRegistryData rejects invalid geometry JSON",
    async () => {

        const generatedFile =
            await writeRawGeometry(
                "invalid-json.geojson",
                "{ invalid json"
            );

        const result =
            validateRegistryData(
                createRegistry(
                    createEntry(
                        generatedFile
                    )
                )
            );

        assert.equal(
            result.valid,
            false
        );

        assert.ok(
            result.errors.some(
                error =>
                    error.includes(
                        "generatedFile contains invalid JSON"
                    )
            )
        );
    }
);


test(
    "validateRegistryData rejects a non-FeatureCollection geometry file",
    async () => {

        const generatedFile =
            await writeGeometry(
                "not-feature-collection.geojson",
                {
                    type:
                        "Feature",

                    properties: {},

                    geometry:
                        null
                }
            );

        const result =
            validateRegistryData(
                createRegistry(
                    createEntry(
                        generatedFile
                    )
                )
            );

        assert.equal(
            result.valid,
            false
        );

        assert.ok(
            result.errors.some(
                error =>
                    error.includes(
                        "must contain a GeoJSON FeatureCollection"
                    )
            )
        );
    }
);


test(
    "validateRegistryData rejects an empty FeatureCollection",
    async () => {

        const generatedFile =
            await writeGeometry(
                "empty.geojson",
                {
                    type:
                        "FeatureCollection",

                    features: []
                }
            );

        const result =
            validateRegistryData(
                createRegistry(
                    createEntry(
                        generatedFile
                    )
                )
            );

        assert.equal(
            result.valid,
            false
        );

        assert.ok(
            result.errors.some(
                error =>
                    error.includes(
                        "generatedFile contains no features"
                    )
            )
        );
    }
);


// =============================================================================
// Generated feature validation
// =============================================================================

test(
    "validateRegistryData rejects a feature with missing district",
    async () => {

        const geometry = {
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
                            "ward"
                    },

                    geometry: {
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
                    }
                }
            ]
        };

        const generatedFile =
            await writeGeometry(
                "missing-district.geojson",
                geometry
            );

        const result =
            validateRegistryData(
                createRegistry(
                    createEntry(
                        generatedFile
                    )
                )
            );

        assert.equal(
            result.valid,
            false
        );

        assert.ok(
            result.errors.some(
                error =>
                    error.includes(
                        "properties.district is required"
                    )
            )
        );
    }
);


test(
    "validateRegistryData rejects a feature with the wrong placeFips",
    async () => {

        const geometry = {
            type:
                "FeatureCollection",

            features: [
                {
                    type:
                        "Feature",

                    properties: {
                        placeFips:
                            "0400000",

                        city:
                            "Tucson",

                        state:
                            "AZ",

                        boundaryType:
                            "ward",

                        district:
                            "Ward 1"
                    },

                    geometry: {
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
                    }
                }
            ]
        };

        const generatedFile =
            await writeGeometry(
                "wrong-place-fips.geojson",
                geometry
            );

        const result =
            validateRegistryData(
                createRegistry(
                    createEntry(
                        generatedFile
                    )
                )
            );

        assert.equal(
            result.valid,
            false
        );

        assert.ok(
            result.errors.some(
                error =>
                    error.includes(
                        "properties.placeFips must equal the registry placeFips"
                    )
            )
        );
    }
);


test(
    "validateRegistryData rejects a feature with the wrong city",
    async () => {

        const geometry = {
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
                            "Phoenix",

                        state:
                            "AZ",

                        boundaryType:
                            "ward",

                        district:
                            "Ward 1"
                    },

                    geometry: {
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
                    }
                }
            ]
        };

        const generatedFile =
            await writeGeometry(
                "wrong-city.geojson",
                geometry
            );

        const result =
            validateRegistryData(
                createRegistry(
                    createEntry(
                        generatedFile
                    )
                )
            );

        assert.equal(
            result.valid,
            false
        );

        assert.ok(
            result.errors.some(
                error =>
                    error.includes(
                        "properties.city must equal the registry city"
                    )
            )
        );
    }
);


test(
    "validateRegistryData rejects a feature with the wrong state",
    async () => {

        const geometry = {
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
                            "CA",

                        boundaryType:
                            "ward",

                        district:
                            "Ward 1"
                    },

                    geometry: {
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
                    }
                }
            ]
        };

        const generatedFile =
            await writeGeometry(
                "wrong-state.geojson",
                geometry
            );

        const result =
            validateRegistryData(
                createRegistry(
                    createEntry(
                        generatedFile
                    )
                )
            );

        assert.equal(
            result.valid,
            false
        );

        assert.ok(
            result.errors.some(
                error =>
                    error.includes(
                        "properties.state must equal the registry state"
                    )
            )
        );
    }
);


test(
    "validateRegistryData rejects a feature with the wrong boundary type",
    async () => {

        const geometry = {
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
                            "council-district",

                        district:
                            "Ward 1"
                    },

                    geometry: {
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
                    }
                }
            ]
        };

        const generatedFile =
            await writeGeometry(
                "wrong-boundary-type.geojson",
                geometry
            );

        const result =
            validateRegistryData(
                createRegistry(
                    createEntry(
                        generatedFile
                    )
                )
            );

        assert.equal(
            result.valid,
            false
        );

        assert.ok(
            result.errors.some(
                error =>
                    error.includes(
                        "properties.boundaryType must equal the registry boundaryType"
                    )
            )
        );
    }
);


test(
    "validateRegistryData rejects an invalid geometry type",
    async () => {

        const geometry = {
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
                            "Ward 1"
                    },

                    geometry: {
                        type:
                            "Point",

                        coordinates: [
                            -110.98,
                            32.22
                        ]
                    }
                }
            ]
        };

        const generatedFile =
            await writeGeometry(
                "invalid-geometry-type.geojson",
                geometry
            );

        const result =
            validateRegistryData(
                createRegistry(
                    createEntry(
                        generatedFile
                    )
                )
            );

        assert.equal(
            result.valid,
            false
        );

        assert.ok(
            result.errors.some(
                error =>
                    error.includes(
                        'geometry.type must be "Polygon" or "MultiPolygon"'
                    )
            )
        );
    }
);


test(
    "validateRegistryData rejects missing geometry coordinates",
    async () => {

        const geometry = {
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
                            "Ward 1"
                    },

                    geometry: {
                        type:
                            "Polygon"
                    }
                }
            ]
        };

        const generatedFile =
            await writeGeometry(
                "missing-coordinates.geojson",
                geometry
            );

        const result =
            validateRegistryData(
                createRegistry(
                    createEntry(
                        generatedFile
                    )
                )
            );

        assert.equal(
            result.valid,
            false
        );

        assert.ok(
            result.errors.some(
                error =>
                    error.includes(
                        "geometry.coordinates must be an array"
                    )
            )
        );
    }
);


test(
    "validateRegistryData rejects missing feature properties",
    async () => {

        const geometry = {
            type:
                "FeatureCollection",

            features: [
                {
                    type:
                        "Feature",

                    geometry: {
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
                    }
                }
            ]
        };

        const generatedFile =
            await writeGeometry(
                "missing-properties.geojson",
                geometry
            );

        const result =
            validateRegistryData(
                createRegistry(
                    createEntry(
                        generatedFile
                    )
                )
            );

        assert.equal(
            result.valid,
            false
        );

        assert.ok(
            result.errors.some(
                error =>
                    error.includes(
                        "properties must be an object"
                    )
            )
        );
    }
);


test(
    "validateRegistryData rejects a non-Feature feature",
    async () => {

        const geometry = {
            type:
                "FeatureCollection",

            features: [
                {
                    type:
                        "Geometry",

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
                            "Ward 1"
                    },

                    geometry: {
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
                    }
                }
            ]
        };

        const generatedFile =
            await writeGeometry(
                "invalid-feature-type.geojson",
                geometry
            );

        const result =
            validateRegistryData(
                createRegistry(
                    createEntry(
                        generatedFile
                    )
                )
            );

        assert.equal(
            result.valid,
            false
        );

        assert.ok(
            result.errors.some(
                error =>
                    error.includes(
                        '.type must be "Feature"'
                    )
            )
        );
    }
);


// =============================================================================
// Path safety
// =============================================================================

test(
    "validateRegistryData rejects a generatedFile that escapes the data directory",
    () => {

        const entry =
            createEntry(
                "../outside-data.geojson"
            );

        const result =
            validateRegistryData(
                createRegistry(
                    entry
                )
            );

        assert.equal(
            result.valid,
            false
        );

        assert.ok(
            result.errors.some(
                error =>
                    error.includes(
                        "must resolve inside the data directory"
                    )
            )
        );
    }
);


// =============================================================================
// Warnings
// =============================================================================

test(
    "validateRegistryData warns when an entry requires review",
    async () => {

        const generatedFile =
            await writeGeometry(
                "requires-review.geojson",
                createPolygonGeometry()
            );

        const entry =
            createEntry(
                generatedFile
            );

        entry.metadata.requiresReview =
            true;

        const result =
            validateRegistryData(
                createRegistry(
                    entry
                )
            );

        assert.equal(
            result.valid,
            true
        );

        assert.equal(
            result.warnings.length,
            1
        );

        assert.match(
            result.warnings[0],
            /requires manual review/
        );
    }
);