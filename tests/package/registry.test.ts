import assert from "node:assert/strict";
import test from "node:test";

import type {
    MunicipalDistrictRegistry,
} from "../../src/registry.js";


test(
    "registry accepts a municipal council district entry",
    () => {

        const registry:
            MunicipalDistrictRegistry = {

            version:
                "0.1.0",

            generatedAt:
                "2026-08-13T00:00:00.000Z",

            entries: [
                {
                    placeFips:
                        "0455000",

                    city:
                        "Phoenix",

                    state:
                        "AZ",

                    boundaryType:
                        "city-council-district",

                    source: {
                        sourceType:
                            "arcgis",

                        url:
                            "https://maps.phoenix.gov/pub/rest/services/Public/Council_Districts/MapServer/0",

                        serviceType:
                            "MapServer",

                        title:
                            "Phoenix Council Districts",

                        official:
                            true,

                        verified:
                            true,

                        fieldMapping: {
                            district:
                                "DISTRICT",

                            name:
                                "REP_NAME"
                        }
                    },

                    generatedFile:
                        "geometry/0455000/city-council-district.geojson",

                    metadata: {
                        generatedAt:
                            "2026-08-13T00:00:00.000Z",

                        generatorVersion:
                            "0.1.0",

                        alternatives:
                            [],

                        requiresReview:
                            false
                    }
                }
            ]
        };


        assert.equal(
            registry.entries.length,
            1
        );


        assert.equal(
            registry.entries[0]
                .boundaryType,
            "city-council-district"
        );


        assert.equal(
            registry.entries[0]
                .source
                .fieldMapping
                .district,
            "DISTRICT"
        );


        assert.equal(
            registry.entries[0]
                .source
                .serviceType,
            "MapServer"
        );


        assert.equal(
            registry.entries[0]
                .source
                .official,
            true
        );
    }
);