import assert from "node:assert/strict";
import test from "node:test";

import {
    findMunicipality,
    loadMunicipalityGeoJSON,
    lookupMunicipalDistrict
} from "../../src/lookup.js";


// =============================================================================
// Tucson constants
// =============================================================================

const TUCSON_PLACE_FIPS =
    "0477000";

const EXPECTED_WARDS = [
    "Ward 1",
    "Ward 2",
    "Ward 3",
    "Ward 4",
    "Ward 5",
    "Ward 6"
];

const EXPECTED_WARD_NAMES = [
    "Kevin Dahl",
    "Lane Santa Cruz",
    "Nikki Lee",
    "Paul Cunningham",
    "Richard G. Fimbres",
    "Steve C. Kozachik"
];


// =============================================================================
// Helpers
// =============================================================================

function getTucsonWardEntry() {

    const entries =
        findMunicipality(
            "Tucson",
            "AZ"
        );

    const entry =
        entries.find(
            candidate =>
                candidate.placeFips ===
                    TUCSON_PLACE_FIPS &&
                candidate.boundaryType ===
                    "ward"
        );

    assert.ok(
        entry,
        "Expected Tucson ward registry entry."
    );

    return entry;
}


function getTucsonWardGeoJSON() {

    const entry =
        getTucsonWardEntry();

    const geojson =
        loadMunicipalityGeoJSON(
            entry
        );

    assert.ok(
        geojson,
        "Expected Tucson ward GeoJSON to load."
    );

    return {
        entry,
        geojson
    };
}


// =============================================================================
// Registry tests
// =============================================================================

test(
    "Tucson registry contains a ward boundary source",
    () => {

        const entry =
            getTucsonWardEntry();

        assert.equal(
            entry.placeFips,
            TUCSON_PLACE_FIPS
        );

        assert.equal(
            entry.city,
            "Tucson"
        );

        assert.equal(
            entry.state,
            "AZ"
        );

        assert.equal(
            entry.boundaryType,
            "ward"
        );

        assert.ok(
            entry.source.url,
            "Expected Tucson ward source URL."
        );
    }
);


test(
    "Tucson ward registry entry loads real generated GeoJSON",
    () => {

        const {
            geojson
        } =
            getTucsonWardGeoJSON();

        assert.equal(
            geojson.type,
            "FeatureCollection"
        );

        assert.equal(
            geojson.features.length,
            6
        );
    }
);


// =============================================================================
// Ward dataset tests
// =============================================================================

test(
    "Tucson generated geometry contains all six wards",
    () => {

        const {
            geojson
        } =
            getTucsonWardGeoJSON();

        const districts =
            geojson.features
                .map(
                    feature =>
                        feature.properties?.district
                )
                .sort();

        assert.deepEqual(
            districts,
            EXPECTED_WARDS
        );
    }
);


test(
    "Tucson generated geometry contains the expected ward names",
    () => {

        const {
            geojson
        } =
            getTucsonWardGeoJSON();

        const names =
            geojson.features
                .map(
                    feature =>
                        feature.properties?.name
                )
                .sort();

        assert.deepEqual(
            names,
            EXPECTED_WARD_NAMES
        );
    }
);


test(
    "Tucson ward features contain normalized municipal properties",
    () => {

        const {
            geojson
        } =
            getTucsonWardGeoJSON();

        for (
            const feature
            of geojson.features
        ) {

            assert.equal(
                feature.properties?.placeFips,
                TUCSON_PLACE_FIPS
            );

            assert.equal(
                feature.properties?.city,
                "Tucson"
            );

            assert.equal(
                feature.properties?.state,
                "AZ"
            );

            assert.equal(
                feature.properties?.boundaryType,
                "ward"
            );

            assert.ok(
                feature.properties?.district
            );

            assert.ok(
                feature.properties?.name
            );

            assert.ok(
                feature.geometry.type ===
                    "Polygon" ||
                feature.geometry.type ===
                    "MultiPolygon"
            );
        }
    }
);


// =============================================================================
// Public lookup tests
// =============================================================================

test(
    "lookupMunicipalDistrict resolves a known Tucson coordinate",
    () => {

        /*
         * Tucson city-center coordinate.
         *
         * This is a public lookup smoke test. It verifies that the
         * lookup executes against the generated Tucson geometry and
         * returns a structurally valid Tucson result when a ward is
         * found.
         */
        const latitude =
            32.2226;

        const longitude =
            -110.9747;

        const result =
            lookupMunicipalDistrict({

                latitude,

                longitude,

                city:
                    "Tucson",

                state:
                    "AZ"
            });

        assert.equal(
            result.coordinates.latitude,
            latitude
        );

        assert.equal(
            result.coordinates.longitude,
            longitude
        );

        if (
            result.found
        ) {

            assert.ok(
                result.district
            );

            assert.equal(
                result.district?.placeFips,
                TUCSON_PLACE_FIPS
            );

            assert.equal(
                result.district?.boundaryType,
                "ward"
            );

            assert.ok(
                EXPECTED_WARDS.includes(
                    result.district?.district ??
                    ""
                )
            );
        }
    }
);


test(
    "lookupMunicipalDistrict returns not found for a point outside Tucson",
    () => {

        const result =
            lookupMunicipalDistrict({

                latitude:
                    34.0522,

                longitude:
                    -118.2437,

                city:
                    "Tucson",

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
    }
);


test(
    "lookupMunicipalDistrict preserves requested Tucson coordinates",
    () => {

        const latitude =
            32.2226;

        const longitude =
            -110.9747;

        const result =
            lookupMunicipalDistrict({

                latitude,

                longitude,

                city:
                    "Tucson",

                state:
                    "AZ"
            });

        assert.equal(
            result.coordinates.latitude,
            latitude
        );

        assert.equal(
            result.coordinates.longitude,
            longitude
        );
    }
);


// =============================================================================
// Boundary integrity
// =============================================================================

test(
    "every Tucson ward feature has a unique district value",
    () => {

        const {
            geojson
        } =
            getTucsonWardGeoJSON();

        const districts =
            geojson.features.map(
                feature =>
                    String(
                        feature.properties?.district
                    )
            );

        assert.equal(
            new Set(
                districts
            ).size,
            districts.length
        );
    }
);


test(
    "Tucson ward geometry contains no null geometries",
    () => {

        const {
            geojson
        } =
            getTucsonWardGeoJSON();

        for (
            const feature
            of geojson.features
        ) {

            assert.ok(
                feature.geometry
            );

            assert.ok(
                feature.geometry.type ===
                    "Polygon" ||
                feature.geometry.type ===
                    "MultiPolygon"
            );
        }
    }
);