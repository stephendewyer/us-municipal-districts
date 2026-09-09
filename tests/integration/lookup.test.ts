import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import type {
    FeatureCollection,
    Polygon
} from "geojson";

import {
    pointInMunicipalBoundary,
    featureToMunicipalDistrict
} from "../../src/lookup.js";

import type {
    MunicipalDistrictRegistryEntry,
    MunicipalDistrictSource
} from "../../src/types.js";


// =============================================================================
// Test fixtures
// =============================================================================

const TUCSON_PLACE_FIPS =
    "0477000";


const TUCSON_SOURCE:
    MunicipalDistrictSource = {

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

    fieldMapping: {

        district:
            "WARD",

        name:
            "NAME"
    }
};


const TUCSON_ENTRY:
    MunicipalDistrictRegistryEntry = {

    placeFips:
        TUCSON_PLACE_FIPS,

    city:
        "Tucson",

    state:
        "AZ",

    boundaryType:
        "ward",

    source:
        TUCSON_SOURCE,

    generatedFile:
        "geometry/0477000/ward.geojson",

    metadata:
        {}
} as MunicipalDistrictRegistryEntry;


// =============================================================================
// Geometry fixtures
// =============================================================================

function createSquareFeature(
    options: {
        district: number | string;
        name: string;
        minLongitude?: number;
        maxLongitude?: number;
        minLatitude?: number;
        maxLatitude?: number;
    }
) {

    const minLongitude =
        options.minLongitude ??
        -111.00;

    const maxLongitude =
        options.maxLongitude ??
        -110.99;

    const minLatitude =
        options.minLatitude ??
        32.22;

    const maxLatitude =
        options.maxLatitude ??
        32.23;

    return {

        type:
            "Feature" as const,

        properties: {

            district:
                String(
                    options.district
                ),

            name:
                options.name
        },

        geometry: {

            type:
                "Polygon" as const,

            coordinates: [[

                [
                    minLongitude,
                    minLatitude
                ],

                [
                    maxLongitude,
                    minLatitude
                ],

                [
                    maxLongitude,
                    maxLatitude
                ],

                [
                    minLongitude,
                    maxLatitude
                ],

                [
                    minLongitude,
                    minLatitude
                ]

            ]]
        }
    };
}


function createFeatureCollection():
    FeatureCollection<Polygon> {

    return {

        type:
            "FeatureCollection",

        features: [

            createSquareFeature({

                district:
                    1,

                name:
                    "Ward 1",

                minLongitude:
                    -111.00,

                maxLongitude:
                    -110.99,

                minLatitude:
                    32.22,

                maxLatitude:
                    32.23
            }),

            createSquareFeature({

                district:
                    2,

                name:
                    "Ward 2",

                minLongitude:
                    -110.99,

                maxLongitude:
                    -110.98,

                minLatitude:
                    32.22,

                maxLatitude:
                    32.23
            })

        ]
    };
}


// =============================================================================
// Tests
// =============================================================================

test(
    "pointInMunicipalBoundary returns true for a point inside a polygon",
    () => {

        const feature =
            createSquareFeature({

                district:
                    1,

                name:
                    "Ward 1"
            });

        const result =
            pointInMunicipalBoundary(
                32.225,
                -110.995,
                feature
            );

        assert.equal(
            result,
            true
        );
    }
);


test(
    "pointInMunicipalBoundary returns false for a point outside a polygon",
    () => {

        const feature =
            createSquareFeature({

                district:
                    1,

                name:
                    "Ward 1"
            });

        const result =
            pointInMunicipalBoundary(
                32.225,
                -110.975,
                feature
            );

        assert.equal(
            result,
            false
        );
    }
);


test(
    "pointInMunicipalBoundary handles adjacent municipal districts",
    () => {

        const collection =
            createFeatureCollection();

        const ward1 =
            collection.features[0];

        const ward2 =
            collection.features[1];

        assert.ok(
            ward1
        );

        assert.ok(
            ward2
        );

        const pointInWard1 =
            pointInMunicipalBoundary(
                32.225,
                -110.995,
                ward1
            );

        const pointInWard2 =
            pointInMunicipalBoundary(
                32.225,
                -110.985,
                ward2
            );

        assert.equal(
            pointInWard1,
            true
        );

        assert.equal(
            pointInWard2,
            true
        );
    }
);


test(
    "featureToMunicipalDistrict converts normalized GeoJSON properties",
    () => {

        const feature =
            createSquareFeature({

                district:
                    1,

                name:
                    "Ward 1"
            });

        const district =
            featureToMunicipalDistrict(
                feature,
                TUCSON_ENTRY
            );

        assert.deepEqual(
            district,
            {

                id:
                    "0477000-ward-1",

                district:
                    "1",

                name:
                    "Ward 1",

                city:
                    "Tucson",

                state:
                    "AZ",

                placeFips:
                    "0477000",

                boundaryType:
                    "ward",

                geometry:
                    feature.geometry
            }
        );
    }
);


test(
    "featureToMunicipalDistrict falls back to configured source fields",
    () => {

        const feature = {

            type:
                "Feature" as const,

            properties: {

                WARD:
                    2,

                NAME:
                    "Ward 2"
            },

            geometry: {

                type:
                    "Polygon" as const,

                coordinates: [[

                    [
                        -111.00,
                        32.22
                    ],

                    [
                        -110.99,
                        32.22
                    ],

                    [
                        -110.99,
                        32.23
                    ],

                    [
                        -111.00,
                        32.23
                    ],

                    [
                        -111.00,
                        32.22
                    ]

                ]]
            }
        };

        const district =
            featureToMunicipalDistrict(
                feature,
                TUCSON_ENTRY
            );

        assert.equal(
            district.district,
            "2"
        );

        assert.equal(
            district.name,
            "Ward 2"
        );
    }
);


test(
    "featureToMunicipalDistrict uses district as the name fallback",
    () => {

        const feature = {

            type:
                "Feature" as const,

            properties: {

                district:
                    3
            },

            geometry: {

                type:
                    "Polygon" as const,

                coordinates: [[

                    [
                        -111.00,
                        32.22
                    ],

                    [
                        -110.99,
                        32.22
                    ],

                    [
                        -110.99,
                        32.23
                    ],

                    [
                        -111.00,
                        32.23
                    ],

                    [
                        -111.00,
                        32.22
                    ]

                ]]
            }
        };

        const district =
            featureToMunicipalDistrict(
                feature,
                TUCSON_ENTRY
            );

        assert.equal(
            district.district,
            "3"
        );

        assert.equal(
            district.name,
            "3"
        );
    }
);


test(
    "pointInMunicipalBoundary rejects invalid latitude",
    () => {

        const feature =
            createSquareFeature({

                district:
                    1,

                name:
                    "Ward 1"
            });

        assert.throws(

            () =>
                pointInMunicipalBoundary(
                    91,
                    -110.995,
                    feature
                ),

            /Invalid latitude: 91/
        );
    }
);


test(
    "pointInMunicipalBoundary rejects invalid longitude",
    () => {

        const feature =
            createSquareFeature({

                district:
                    1,

                name:
                    "Ward 1"
            });

        assert.throws(

            () =>
                pointInMunicipalBoundary(
                    32.225,
                    181,
                    feature
                ),

            /Invalid longitude: 181/
        );
    }
);


// =============================================================================
// Geometry fixture validation
// =============================================================================

test(
    "fixture contains two non-overlapping municipal districts",
    () => {

        const collection =
            createFeatureCollection();

        assert.equal(
            collection.features.length,
            2
        );

        const first =
            collection.features[0];

        const second =
            collection.features[1];

        assert.ok(
            first
        );

        assert.ok(
            second
        );

        const firstPoint =
            pointInMunicipalBoundary(
                32.225,
                -110.995,
                first
            );

        const secondPoint =
            pointInMunicipalBoundary(
                32.225,
                -110.985,
                second
            );

        assert.equal(
            firstPoint,
            true
        );

        assert.equal(
            secondPoint,
            true
        );
    }
);


// =============================================================================
// Optional file-based lookup preparation
// =============================================================================

test(
    "GeoJSON fixture can be serialized using the package geometry format",
    async () => {

        const temporaryDirectory =
            await fs.mkdtemp(
                path.join(
                    os.tmpdir(),
                    "us-municipal-districts-lookup-"
                )
            );

        try {

            const geometry =
                createFeatureCollection();

            const filePath =
                path.join(
                    temporaryDirectory,
                    "ward.geojson"
                );

            await fs.writeFile(
                filePath,
                JSON.stringify(
                    geometry,
                    null,
                    2
                ),
                "utf8"
            );

            const parsed =
                JSON.parse(
                    await fs.readFile(
                        filePath,
                        "utf8"
                    )
                );

            assert.equal(
                parsed.type,
                "FeatureCollection"
            );

            assert.equal(
                parsed.features.length,
                2
            );

        } finally {

            await fs.rm(
                temporaryDirectory,
                {
                    recursive:
                        true,

                    force:
                        true
                }
            );
        }
    }
);