import assert from "node:assert/strict";
import test from "node:test";

import {
    pointOnFeature
} from "@turf/turf";

import {
    findMunicipality,
    loadMunicipalityGeoJSON,
    lookupMunicipalDistrict
} from "../../src/lookup.js";


// =============================================================================
// Chicago fixture
// =============================================================================

const CHICAGO_PLACE_FIPS =
    "1714000";


// =============================================================================
// Tests
// =============================================================================

test(
    "Chicago registry contains a ward boundary source",
    () => {

        const entries =
            findMunicipality(
                "Chicago",
                "IL"
            );

        assert.ok(
            entries.length > 0,
            "Expected Chicago to have at least one registry entry."
        );

        const wardEntry =
            entries.find(
                entry =>
                    entry.placeFips ===
                        CHICAGO_PLACE_FIPS &&
                    entry.boundaryType ===
                        "ward"
            );

        assert.ok(
            wardEntry,
            "Expected Chicago ward registry entry."
        );

        assert.equal(
            wardEntry?.placeFips,
            CHICAGO_PLACE_FIPS
        );

        assert.equal(
            wardEntry?.boundaryType,
            "ward"
        );
    }
);


test(
    "Chicago ward registry entry loads real generated GeoJSON",
    () => {

        const entries =
            findMunicipality(
                "Chicago",
                "IL"
            );

        const wardEntry =
            entries.find(
                entry =>
                    entry.placeFips ===
                        CHICAGO_PLACE_FIPS &&
                    entry.boundaryType ===
                        "ward"
            );

        assert.ok(
            wardEntry,
            "Expected Chicago ward registry entry."
        );

        const geojson =
            loadMunicipalityGeoJSON(
                wardEntry!
            );

        assert.ok(
            geojson,
            "Expected Chicago ward GeoJSON to load."
        );

        assert.equal(
            geojson?.type,
            "FeatureCollection"
        );

        assert.ok(
            (
                geojson?.features.length ??
                0
            ) > 0,
            "Expected Chicago ward GeoJSON to contain features."
        );
    }
);


test(
    "lookupMunicipalDistrict resolves a point inside a real Chicago ward",
    () => {

        const entries =
            findMunicipality(
                "Chicago",
                "IL"
            );

        const wardEntry =
            entries.find(
                entry =>
                    entry.placeFips ===
                        CHICAGO_PLACE_FIPS &&
                    entry.boundaryType ===
                        "ward"
            );

        assert.ok(
            wardEntry,
            "Expected Chicago ward registry entry."
        );

        const geojson =
            loadMunicipalityGeoJSON(
                wardEntry!
            );

        assert.ok(
            geojson,
            "Expected Chicago ward GeoJSON."
        );

        const feature =
            geojson!.features[0];

        assert.ok(
            feature,
            "Expected at least one Chicago ward feature."
        );

        const interiorPoint =
            pointOnFeature(
                feature
            );

        const [
            longitude,
            latitude
        ] =
            interiorPoint.geometry.coordinates;

        const result =
            lookupMunicipalDistrict({

                latitude,

                longitude,

                city:
                    "Chicago",

                state:
                    "IL"
            });

        assert.equal(
            result.found,
            true
        );

        assert.ok(
            result.district,
            "Expected a municipal district result."
        );

        assert.equal(
            result.district?.placeFips,
            CHICAGO_PLACE_FIPS
        );

        assert.equal(
            result.district?.boundaryType,
            "ward"
        );

        assert.ok(
            result.district?.district,
            "Expected a ward district identifier."
        );
    }
);


test(
    "lookupMunicipalDistrict returns not found for a point outside Chicago ward boundaries",
    () => {

        const result =
            lookupMunicipalDistrict({

                latitude:
                    42.3601,

                longitude:
                    -71.0589,

                city:
                    "Chicago",

                state:
                    "IL"
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
    "lookupMunicipalDistrict preserves the requested coordinates",
    () => {

        const latitude =
            41.8781;

        const longitude =
            -87.6298;

        const result =
            lookupMunicipalDistrict({

                latitude,

                longitude,

                city:
                    "Chicago",

                state:
                    "IL"
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
// Known-location accuracy tests
// =============================================================================

test(
    "121 N LaSalle St resolves to Chicago Ward 42",
    () => {

        const result =
            lookupMunicipalDistrict({

                latitude:
                    41.883786,

                longitude:
                    -87.632073,

                city:
                    "Chicago",

                state:
                    "IL"
            });

        assert.equal(
            result.found,
            true
        );

        assert.ok(
            result.district
        );

        assert.equal(
            result.district?.placeFips,
            "1714000"
        );

        assert.equal(
            result.district?.boundaryType,
            "ward"
        );

        assert.equal(
            result.district?.district,
            "42"
        );
    }
);


test(
    "1282 W Washington Blvd resolves to Chicago Ward 27",
    () => {

        const result =
            lookupMunicipalDistrict({

                latitude:
                    41.883202,

                longitude:
                    -87.659714,

                city:
                    "Chicago",

                state:
                    "IL"
            });

        assert.equal(
            result.found,
            true
        );

        assert.ok(
            result.district
        );

        assert.equal(
            result.district?.placeFips,
            "1714000"
        );

        assert.equal(
            result.district?.boundaryType,
            "ward"
        );

        assert.equal(
            result.district?.district,
            "27"
        );
    }
);


test(
    "5814 S Wood St resolves to Chicago Ward 15",
    () => {

        const result =
            lookupMunicipalDistrict({

                latitude:
                    41.788013,

                longitude:
                    -87.669495,

                city:
                    "Chicago",

                state:
                    "IL"
            });

        assert.equal(
            result.found,
            true
        );

        assert.ok(
            result.district
        );

        assert.equal(
            result.district?.placeFips,
            "1714000"
        );

        assert.equal(
            result.district?.boundaryType,
            "ward"
        );

        assert.equal(
            result.district?.district,
            "15"
        );
    }
);