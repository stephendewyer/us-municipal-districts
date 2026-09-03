import assert from "node:assert/strict";
import test from "node:test";

import type {
    MunicipalDistrictRegistry,
    MunicipalDistrictRegistryEntry,
    MunicipalDistrictSource
} from "../../src/types.js";

import {
    findRegistryEntry,
    findRegistryEntries,
    loadRegistry
} from "../../src/registry.js";


// =============================================================================
// Test data
// =============================================================================

const phoenixEntry:
    MunicipalDistrictRegistryEntry = {

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
};


const tucsonEntry:
    MunicipalDistrictRegistryEntry = {

    placeFips:
        "0477000",

    city:
        "Tucson",

    state:
        "AZ",

    boundaryType:
        "ward",

    source: {
        sourceType:
            "arcgis",

        url:
            "https://example.com/tucson/FeatureServer/0",

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
    },

    generatedFile:
        "geometry/0477000/ward.geojson",

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
};


// =============================================================================
// Tests — type structure
// =============================================================================

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
                phoenixEntry
            ]
        };


        assert.equal(
            registry.version,
            "0.1.0"
        );


        assert.equal(
            registry.entries.length,
            1
        );


        assert.equal(
            registry.entries[0].city,
            "Phoenix"
        );


        assert.equal(
            registry.entries[0].state,
            "AZ"
        );


        assert.equal(
            registry.entries[0].placeFips,
            "0455000"
        );


        assert.equal(
            registry.entries[0].boundaryType,
            "city-council-district"
        );
    }
);


test(
    "registry accepts a municipal ward entry",
    () => {

        const registry:
            MunicipalDistrictRegistry = {

            version:
                "0.1.0",

            generatedAt:
                "2026-08-13T00:00:00.000Z",

            entries: [
                tucsonEntry
            ]
        };


        assert.equal(
            registry.entries.length,
            1
        );


        assert.equal(
            registry.entries[0].city,
            "Tucson"
        );


        assert.equal(
            registry.entries[0].state,
            "AZ"
        );


        assert.equal(
            registry.entries[0].placeFips,
            "0477000"
        );


        assert.equal(
            registry.entries[0].boundaryType,
            "ward"
        );
    }
);


// =============================================================================
// Tests — source
// =============================================================================

test(
    "registry source accepts an ArcGIS MapServer",
    () => {

        const source:
            MunicipalDistrictSource =
                phoenixEntry.source;


        assert.equal(
            source.sourceType,
            "arcgis"
        );


        assert.equal(
            source.serviceType,
            "MapServer"
        );


        assert.equal(
            source.url,
            "https://maps.phoenix.gov/pub/rest/services/Public/Council_Districts/MapServer/0"
        );


        assert.equal(
            source.title,
            "Phoenix Council Districts"
        );


        assert.equal(
            source.official,
            true
        );


        assert.equal(
            source.verified,
            true
        );
    }
);


test(
    "registry source accepts an ArcGIS FeatureServer",
    () => {

        const source:
            MunicipalDistrictSource =
                tucsonEntry.source;


        assert.equal(
            source.sourceType,
            "arcgis"
        );


        assert.equal(
            source.serviceType,
            "FeatureServer"
        );


        assert.equal(
            source.title,
            "Tucson Wards"
        );


        assert.equal(
            source.official,
            true
        );


        assert.equal(
            source.verified,
            true
        );
    }
);


// =============================================================================
// Tests — field mapping
// =============================================================================

test(
    "registry source contains district field mapping",
    () => {

        assert.equal(
            phoenixEntry
                .source
                .fieldMapping
                .district,
            "DISTRICT"
        );


        assert.equal(
            phoenixEntry
                .source
                .fieldMapping
                .name,
            "REP_NAME"
        );
    }
);


test(
    "registry source allows a district field without a name field",
    () => {

        const source:
            MunicipalDistrictSource = {

            sourceType:
                "arcgis",

            url:
                "https://example.com/FeatureServer/0",

            serviceType:
                "FeatureServer",

            official:
                false,

            verified:
                false,

            fieldMapping: {
                district:
                    "DISTRICT"
            }
        };


        assert.equal(
            source.fieldMapping.district,
            "DISTRICT"
        );


        assert.equal(
            source.fieldMapping.name,
            undefined
        );
    }
);


// =============================================================================
// Tests — metadata
// =============================================================================

test(
    "registry entry contains generation metadata",
    () => {

        assert.equal(
            phoenixEntry.metadata.generatedAt,
            "2026-08-13T00:00:00.000Z"
        );


        assert.equal(
            phoenixEntry.metadata.generatorVersion,
            "0.1.0"
        );


        assert.deepEqual(
            phoenixEntry.metadata.alternatives,
            []
        );


        assert.equal(
            phoenixEntry.metadata.requiresReview,
            false
        );
    }
);


test(
    "registry entry supports alternative sources",
    () => {

        const entry:
            MunicipalDistrictRegistryEntry = {

            ...phoenixEntry,

            metadata: {
                ...phoenixEntry.metadata,

                alternatives: [
                    {
                        url:
                            "https://example.com/alternate/FeatureServer/0",

                        itemId:
                            "abcdef123456",

                        title:
                            "Alternate Phoenix Districts",

                        serviceType:
                            "FeatureServer",

                        official:
                            false,

                        score:
                            125
                    }
                ]
            }
        };


        assert.equal(
            entry.metadata.alternatives.length,
            1
        );


        assert.equal(
            entry.metadata.alternatives[0].url,
            "https://example.com/alternate/FeatureServer/0"
        );


        assert.equal(
            entry.metadata.alternatives[0].serviceType,
            "FeatureServer"
        );


        assert.equal(
            entry.metadata.alternatives[0].official,
            false
        );


        assert.equal(
            entry.metadata.alternatives[0].score,
            125
        );
    }
);


// =============================================================================
// Tests — real registry loading
// =============================================================================

test(
    "loadRegistry loads the generated registry",
    () => {

        const registry =
            loadRegistry();


        assert.equal(
            typeof registry.version,
            "string"
        );


        assert.equal(
            typeof registry.generatedAt,
            "string"
        );


        assert.equal(
            Array.isArray(
                registry.entries
            ),
            true
        );
    }
);


test(
    "loadRegistry returns the same cached registry instance",
    () => {

        const first =
            loadRegistry();


        const second =
            loadRegistry();


        assert.equal(
            first,
            second
        );
    }
);


// =============================================================================
// Tests — registry search
// =============================================================================

test(
    "findRegistryEntries returns an array",
    () => {

        const entries =
            findRegistryEntries();


        assert.equal(
            Array.isArray(entries),
            true
        );
    }
);


test(
    "findRegistryEntries can filter by city",
    () => {

        const entries =
            findRegistryEntries({
                city:
                    "Tucson"
            });


        for (
            const entry
            of entries
        ) {

            assert.equal(
                entry.city,
                "Tucson"
            );
        }
    }
);


test(
    "findRegistryEntries matches city names case-insensitively",
    () => {

        const lowerCase =
            findRegistryEntries({
                city:
                    "tucson"
            });


        const upperCase =
            findRegistryEntries({
                city:
                    "TUCSON"
            });


        assert.equal(
            lowerCase.length,
            upperCase.length
        );
    }
);


test(
    "findRegistryEntries can filter by state abbreviation",
    () => {

        const entries =
            findRegistryEntries({
                state:
                    "AZ"
            });


        for (
            const entry
            of entries
        ) {

            assert.equal(
                entry.state,
                "AZ"
            );
        }
    }
);


test(
    "findRegistryEntries accepts a full state name",
    () => {

        const entries =
            findRegistryEntries({
                state:
                    "Arizona"
            });


        for (
            const entry
            of entries
        ) {

            assert.equal(
                entry.state,
                "AZ"
            );
        }
    }
);


test(
    "findRegistryEntries can filter by place FIPS",
    () => {

        const entries =
            findRegistryEntries({
                placeFips:
                    "0477000"
            });


        for (
            const entry
            of entries
        ) {

            assert.equal(
                entry.placeFips,
                "0477000"
            );
        }
    }
);


test(
    "findRegistryEntries can filter by boundary type",
    () => {

        const entries =
            findRegistryEntries({
                boundaryType:
                    "ward"
            });


        for (
            const entry
            of entries
        ) {

            assert.equal(
                entry.boundaryType,
                "ward"
            );
        }
    }
);


test(
    "findRegistryEntries combines multiple filters",
    () => {

        const entries =
            findRegistryEntries({
                city:
                    "Tucson",

                state:
                    "AZ",

                placeFips:
                    "0477000",

                boundaryType:
                    "ward"
            });


        for (
            const entry
            of entries
        ) {

            assert.equal(
                entry.city,
                "Tucson"
            );


            assert.equal(
                entry.state,
                "AZ"
            );


            assert.equal(
                entry.placeFips,
                "0477000"
            );


            assert.equal(
                entry.boundaryType,
                "ward"
            );
        }
    }
);


// =============================================================================
// Tests — find one entry
// =============================================================================

test(
    "findRegistryEntry returns the first matching entry",
    () => {

        const entry =
            findRegistryEntry({
                city:
                    "Tucson",

                state:
                    "AZ"
            });


        if (
            entry !== undefined
        ) {

            assert.equal(
                entry.city,
                "Tucson"
            );


            assert.equal(
                entry.state,
                "AZ"
            );
        }
    }
);


test(
    "findRegistryEntry returns undefined when no entry exists",
    () => {

        const entry =
            findRegistryEntry({
                city:
                    "Definitely Not A City",

                state:
                    "ZZ"
            });


        assert.equal(
            entry,
            undefined
        );
    }
);