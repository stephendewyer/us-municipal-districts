import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
    lookupMunicipalDistrict
} from "../../src/lookup.js";


// =============================================================================
// Test paths
// =============================================================================

const __filename =
    fileURLToPath(import.meta.url);

const __dirname =
    path.dirname(__filename);


const geometryPath =
    path.resolve(
        __dirname,
        "../../geometry/test/0000000/ward.geojson"
    );


const geometryDirectory =
    path.dirname(
        geometryPath
    );


// =============================================================================
// Test geometry
// =============================================================================

function ensureTestGeometry():
    void {

    fs.mkdirSync(
        geometryDirectory,
        {
            recursive:
                true
        }
    );


    const geometry = {
        type:
            "FeatureCollection",

        features: [
            {
                type:
                    "Feature",

                properties: {
                    placeFips:
                        "0000000",

                    city:
                        "Testville",

                    state:
                        "TS",

                    boundaryType:
                        "ward",

                    district:
                        "1",

                    name:
                        "Ward 1"
                },

                geometry: {
                    type:
                        "Polygon",

                    coordinates: [
                        [
                            [-1, -1],
                            [1, -1],
                            [1, 1],
                            [-1, 1],
                            [-1, -1]
                        ]
                    ]
                }
            }
        ]
    };


    fs.writeFileSync(
        geometryPath,
        JSON.stringify(
            geometry,
            null,
            2
        ) + "\n",
        "utf8"
    );
}


// =============================================================================
// Tests
// =============================================================================

test(
    "lookupMunicipalDistrict validates latitude",
    () => {

        assert.throws(
            () =>
                lookupMunicipalDistrict({
                    latitude:
                        91,

                    longitude:
                        0
                }),

            /Invalid latitude: 91/
        );


        assert.throws(
            () =>
                lookupMunicipalDistrict({
                    latitude:
                        -91,

                    longitude:
                        0
                }),

            /Invalid latitude: -91/
        );
    }
);


test(
    "lookupMunicipalDistrict validates longitude",
    () => {

        assert.throws(
            () =>
                lookupMunicipalDistrict({
                    latitude:
                        0,

                    longitude:
                        181
                }),

            /Invalid longitude: 181/
        );


        assert.throws(
            () =>
                lookupMunicipalDistrict({
                    latitude:
                        0,

                    longitude:
                        -181
                }),

            /Invalid longitude: -181/
        );
    }
);


test(
    "lookupMunicipalDistrict returns no result for an unknown municipality",
    () => {

        const result =
            lookupMunicipalDistrict({
                latitude:
                    32.2226,

                longitude:
                    -110.9747,

                city:
                    "Definitely Not A City",

                state:
                    "AZ"
            });


        assert.equal(
            result.found,
            false
        );


        assert.equal(
            result.district,
            null
        );


        assert.deepEqual(
            result.coordinates,
            {
                latitude:
                    32.2226,

                longitude:
                    -110.9747
            }
        );
    }
);


test(
    "lookupMunicipalDistrict returns no result for an unknown state",
    () => {

        const result =
            lookupMunicipalDistrict({
                latitude:
                    32.2226,

                longitude:
                    -110.9747,

                city:
                    "Tucson",

                state:
                    "ZZ"
            });


        assert.equal(
            result.found,
            false
        );


        assert.equal(
            result.district,
            null
        );
    }
);


test(
    "lookupMunicipalDistrict returns no result for a point outside a municipal boundary",
    () => {

        /*
         * This assumes Tucson's generated ward geometry is
         * available. The coordinate is intentionally far from
         * Tucson's municipal boundaries.
         */

        const result =
            lookupMunicipalDistrict({
                latitude:
                    40.7128,

                longitude:
                    -74.0060,

                city:
                    "Tucson",

                state:
                    "AZ",

                boundaryType:
                    "ward"
            });


        assert.equal(
            result.found,
            false
        );


        assert.equal(
            result.district,
            null
        );
    }
);


test(
    "lookupMunicipalDistrict finds a Tucson ward from generated geometry",
    () => {

        /*
         * This test uses the generated Tucson geometry.
         *
         * The coordinate should be a known point inside one
         * of the generated Tucson ward boundaries.
         */

        const result =
            lookupMunicipalDistrict({
                latitude:
                    32.2226,

                longitude:
                    -110.9747,

                city:
                    "Tucson",

                state:
                    "AZ",

                boundaryType:
                    "ward"
            });


        assert.equal(
            result.found,
            true
        );


        assert.notEqual(
            result.district,
            null
        );


        assert.equal(
            result.district?.city,
            "Tucson"
        );


        assert.equal(
            result.district?.state,
            "AZ"
        );


        assert.equal(
            result.district?.placeFips,
            "0477000"
        );


        assert.equal(
            result.district?.boundaryType,
            "ward"
        );


        assert.equal(
            typeof result.district?.district,
            "string"
        );


        assert.equal(
            typeof result.district?.name,
            "string"
        );


        assert.equal(
            result.coordinates.latitude,
            32.2226
        );


        assert.equal(
            result.coordinates.longitude,
            -110.9747
        );
    }
);


test(
    "lookupMunicipalDistrict can use placeFips to identify a municipality",
    () => {

        const result =
            lookupMunicipalDistrict({
                latitude:
                    32.2226,

                longitude:
                    -110.9747,

                placeFips:
                    "0477000",

                boundaryType:
                    "ward"
            });


        /*
         * The test only succeeds if the generated registry
         * contains the Tucson place FIPS and the generated
         * geometry contains the coordinate.
         */

        assert.equal(
            result.found,
            true
        );


        assert.notEqual(
            result.district,
            null
        );


        assert.equal(
            result.district?.placeFips,
            "0477000"
        );


        assert.equal(
            result.district?.city,
            "Tucson"
        );


        assert.equal(
            result.district?.state,
            "AZ"
        );


        assert.equal(
            result.district?.boundaryType,
            "ward"
        );
    }
);


// =============================================================================
// Synthetic geometry test
// =============================================================================

test(
    "test geometry fixture is created correctly",
    () => {

        ensureTestGeometry();


        assert.equal(
            fs.existsSync(
                geometryPath
            ),
            true
        );


        const geometry =
            JSON.parse(
                fs.readFileSync(
                    geometryPath,
                    "utf8"
                )
            );


        assert.equal(
            geometry.type,
            "FeatureCollection"
        );


        assert.equal(
            geometry.features.length,
            1
        );


        assert.equal(
            geometry.features[0].properties.city,
            "Testville"
        );


        assert.equal(
            geometry.features[0].properties.state,
            "TS"
        );


        assert.equal(
            geometry.features[0].properties.district,
            "1"
        );
    }
);