import {
    test
} from "node:test";

import assert from "node:assert/strict";

import type {
    ArcGISInspection,
    ArcGISCandidateValidation,
    CandidateClassification,
    CensusPlace,
    DiscoveryCandidate,
    InspectedCandidate
} from "../../generator/src/types.js";

import {
    buildDiscoveryResult
} from "../../generator/src/pipeline.js";


// =============================================================================
// Phoenix fixture
// =============================================================================

const PHOENIX_PLACE:
    CensusPlace = {

    placeFips:
        "0455000",

    city:
        "Phoenix",

    state:
        "AZ",

    placeType:
        "incorporated-place"
};


// =============================================================================
// Real Phoenix source URLs from the captured discovery run
// =============================================================================

const PHOENIX_COUNCIL_DISTRICTS_URL =
    "https://maps.phoenix.gov/pub/rest/services/Public/Council_Districts/MapServer/0";

const PHOENIX_COUNCIL_DISTRICTS_HASH_URL =
    "https://maps.phoenix.gov/pub/rest/services/Public/Council_Districts/MapServer/1";

const PHOENIX_EVICTION_DISTRICTS_URL =
    "https://maps.phoenix.gov/pub/rest/services/Public/Eviction_Filings_HSD/MapServer/1";


// =============================================================================
// Fixture helpers
// =============================================================================

function createDiscoveryCandidate(
    options: {
        url: string;
        title: string;
        itemId: string;
        score?: number;
        requiresReview?: boolean;
    }
):
    DiscoveryCandidate {

    return {

        itemId:
            options.itemId,

        placeFips:
            PHOENIX_PLACE.placeFips,

        city:
            PHOENIX_PLACE.city,

        state:
            PHOENIX_PLACE.state,

        url:
            options.url,

        title:
            options.title,

        score:
            options.score ??
            0,

        requiresReview:
            options.requiresReview ??
            false,

        reasons: [
            "Phoenix regression fixture"
        ],

        source:
            "arcgis"
    };
}


function createClassification(
    options: {
        officialMunicipalSource?: boolean;
        requiresReview?: boolean;
    } = {}
):
    CandidateClassification {

    return {

        isBoundaryLayer:
            true,

        isPoliticalBoundary:
            true,

        isThematicDataset:
            false,

        isCensusDataset:
            false,

        isParcelDataset:
            false,

        isHousingDataset:
            false,

        officialMunicipalSource:
            options
                .officialMunicipalSource ??
            false,

        districtType:
            "council-district",

        temporalStatus: "undated",
        
        sourceRole: "unknown",

        rejected:
            false,

        rejectionReasons:
            [],

        requiresReview:
            options.requiresReview ??
            false,

        matches: {

            thematic:
                [],

            census:
                [],

            parcel:
                [],

            housing:
                [],

            political: [
                "council district"
            ],

            boundary: [
                "boundary"
            ],

            official:
                options
                    .officialMunicipalSource
                    ? [
                        "municipal government"
                    ]
                    : []
        }
    };
}


function createValidation():
    ArcGISCandidateValidation {

    return {

        isLikelyPoliticalBoundary:
            true,

        confidence:
            100,

        districtField:
            "DISTRICT",

        sampleCount:
            10,

        featureCount:
            10,

        distinctDistrictValues: [
            "1",
            "2",
            "3",
            "4",
            "5",
            "6",
            "7",
            "8"
        ],

        districtValuePattern:
            "district-number",

        geometryType:
            "esriGeometryPolygon",

        evidence: [
            "Phoenix council district regression fixture"
        ]
    };
}


function createInspection(
    options: {
        url: string;
        title: string;
        serviceName: string;
        layerName: string;
        serviceType:
            "FeatureServer" |
            "MapServer";
        itemId: string;
        layerId?: number;
    }
):
    ArcGISInspection {

    return {

        url:
            options.url,

        isArcGIS:
            true,

        serviceType:
            options.serviceType,

        isLayer:
            true,

        layerId:
            options.layerId ??
            0,

        title:
            options.title,

        serviceName:
            options.serviceName,

        layerName:
            options.layerName,

        geometryType:
            "esriGeometryPolygon",

        fields: [

            {
                name:
                    "DISTRICT"
            },

            {
                name:
                    "REP_NAME"
            }

        ],

        districtFields: [
            "DISTRICT"
        ],

        districtField:
            "DISTRICT",

        nameFields: [
            "REP_NAME"
        ],

        nameField:
            "REP_NAME",

        fieldSamples: [],

        supportsQuery:
            true,

        supportsGeoJSON:
            true,

        supportsPagination:
            true,

        itemId:
            options.itemId
    };
}


function createInspectedCandidate(
    options: {
        url: string;
        title: string;
        serviceName: string;
        layerName: string;
        serviceType:
            "FeatureServer" |
            "MapServer";
        itemId: string;
        layerId?: number;
        score?: number;
        classification:
            CandidateClassification;
    }
):
    InspectedCandidate {

    return {

        candidate:
            createDiscoveryCandidate({

                url:
                    options.url,

                title:
                    options.title,

                itemId:
                    options.itemId,

                score:
                    options.score
            }),

        inspection:
            createInspection({

                url:
                    options.url,

                title:
                    options.title,

                serviceName:
                    options.serviceName,

                layerName:
                    options.layerName,

                serviceType:
                    options.serviceType,

                itemId:
                    options.itemId,

                layerId:
                    options.layerId
            }),

        classification:
            options.classification,

        validation:
            createValidation()
    };
}


// =============================================================================
// Phoenix candidate fixtures
// =============================================================================

function createPhoenixCouncilCandidate():
    InspectedCandidate {

    return createInspectedCandidate({

        url:
            PHOENIX_COUNCIL_DISTRICTS_URL,

        title:
            "Council Districts and Members",

        serviceName:
            "Council_Districts",

        layerName:
            "Council Districts and Members",

        serviceType:
            "MapServer",

        itemId:
            "phoenix-council-districts",

        layerId:
            0,

        score:
            200,

        classification:
            createClassification({

                officialMunicipalSource:
                    true
            })
    });
}


function createPhoenixCouncilHashCandidate():
    InspectedCandidate {

    return createInspectedCandidate({

        url:
            PHOENIX_COUNCIL_DISTRICTS_HASH_URL,

        title:
            "Council Districts and Members Hash",

        serviceName:
            "Council_Districts",

        layerName:
            "Council Districts and Members Hash",

        serviceType:
            "MapServer",

        itemId:
            "phoenix-council-districts-hash",

        layerId:
            1,

        score:
            190,

        classification:
            createClassification({

                officialMunicipalSource:
                    true
            })
    });
}


function createPhoenixEvictionCandidate():
    InspectedCandidate {

    return createInspectedCandidate({

        url:
            PHOENIX_EVICTION_DISTRICTS_URL,

        title:
            "Eviction Filings by Council Districts",

        serviceName:
            "Eviction_Filings_HSD",

        layerName:
            "Eviction Filings by Council Districts",

        serviceType:
            "MapServer",

        itemId:
            "phoenix-eviction-districts",

        layerId:
            1,

        /*
         * Deliberately give the derived analytical dataset a higher
         * raw discovery score.
         *
         * The canonical selector should still prefer the
         * boundary-native Council Districts source.
         */
        score:
            250,

        classification:
            createClassification({

                officialMunicipalSource:
                    true
            })
    });
}


// =============================================================================
// Phoenix pipeline regression tests
// =============================================================================

test(
    "Phoenix pipeline accepts the real council-district boundary candidates",
    () => {

        const council =
            createPhoenixCouncilCandidate();

        const hash =
            createPhoenixCouncilHashCandidate();

        const eviction =
            createPhoenixEvictionCandidate();

        const result =
            buildDiscoveryResult(
                PHOENIX_PLACE,
                [
                    council,
                    hash,
                    eviction
                ]
            );


        assert.equal(
            result.validCandidates.length,
            3
        );


        assert.ok(
            result.validCandidates.some(
                candidate =>
                    candidate.inspection.url ===
                    PHOENIX_COUNCIL_DISTRICTS_URL
            )
        );


        assert.ok(
            result.validCandidates.some(
                candidate =>
                    candidate.inspection.url ===
                    PHOENIX_COUNCIL_DISTRICTS_HASH_URL
            )
        );


        assert.ok(
            result.validCandidates.some(
                candidate =>
                    candidate.inspection.url ===
                    PHOENIX_EVICTION_DISTRICTS_URL
            )
        );
    }
);


test(
    "Phoenix pipeline groups equivalent council-district sources",
    () => {

        const council =
            createPhoenixCouncilCandidate();

        const hash =
            createPhoenixCouncilHashCandidate();

        const eviction =
            createPhoenixEvictionCandidate();

        const result =
            buildDiscoveryResult(
                PHOENIX_PLACE,
                [
                    council,
                    hash,
                    eviction
                ]
            );


        assert.equal(
            result.validCandidates.length,
            3
        );


        const councilGroup =
            result.equivalentGroups.find(
                group =>
                    group.candidates.some(
                        candidate =>
                            candidate.inspection.url ===
                            PHOENIX_COUNCIL_DISTRICTS_URL
                    )
            );


        assert.ok(
            councilGroup
        );


        assert.ok(
            councilGroup?.candidates.some(
                candidate =>
                    candidate.inspection.url ===
                    PHOENIX_COUNCIL_DISTRICTS_HASH_URL
            )
        );
    }
);


test(
    "Phoenix pipeline selects Council Districts as the municipality-wide canonical source",
    () => {

        const council =
            createPhoenixCouncilCandidate();

        const hash =
            createPhoenixCouncilHashCandidate();

        const eviction =
            createPhoenixEvictionCandidate();

        const result =
            buildDiscoveryResult(
                PHOENIX_PLACE,
                [
                    council,
                    hash,
                    eviction
                ]
            );


        assert.ok(
            result.canonical
        );


        assert.equal(
            result.canonical?.url,
            PHOENIX_COUNCIL_DISTRICTS_URL
        );


        assert.equal(
            result.canonical?.title,
            "Council Districts and Members"
        );


        assert.equal(
            result.canonical?.city,
            "Phoenix"
        );


        assert.equal(
            result.canonical?.state,
            "AZ"
        );


        assert.equal(
            result.canonical?.placeFips,
            "0455000"
        );


        assert.equal(
            result.canonical?.districtType,
            "council-district"
        );


        assert.equal(
            result.canonical?.districtField,
            "DISTRICT"
        );


        assert.equal(
            result.canonical?.officialMunicipalSource,
            true
        );
    }
);


test(
    "Phoenix pipeline canonical selection does not simply choose the highest raw candidate score",
    () => {

        const council =
            createPhoenixCouncilCandidate();

        const eviction =
            createPhoenixEvictionCandidate();


        /*
         * The eviction dataset intentionally has a higher raw score:
         *
         *     Council Districts: 200
         *     Eviction Filings: 250
         *
         * The municipality-wide canonical selector must nevertheless
         * choose the boundary-native Council Districts source.
         */

        assert.ok(
            eviction.candidate.score >
            council.candidate.score
        );


        const result =
            buildDiscoveryResult(
                PHOENIX_PLACE,
                [
                    council,
                    eviction
                ]
            );


        assert.ok(
            result.canonical
        );


        assert.equal(
            result.canonical?.url,
            PHOENIX_COUNCIL_DISTRICTS_URL
        );
    }
);


test(
    "Phoenix pipeline canonical selection is independent of candidate discovery order",
    () => {

        const council =
            createPhoenixCouncilCandidate();

        const eviction =
            createPhoenixEvictionCandidate();


        const firstResult =
            buildDiscoveryResult(
                PHOENIX_PLACE,
                [
                    council,
                    eviction
                ]
            );


        const secondResult =
            buildDiscoveryResult(
                PHOENIX_PLACE,
                [
                    eviction,
                    council
                ]
            );


        assert.ok(
            firstResult.canonical
        );


        assert.ok(
            secondResult.canonical
        );


        assert.equal(
            firstResult.canonical?.url,
            PHOENIX_COUNCIL_DISTRICTS_URL
        );


        assert.equal(
            secondResult.canonical?.url,
            PHOENIX_COUNCIL_DISTRICTS_URL
        );
    }
);