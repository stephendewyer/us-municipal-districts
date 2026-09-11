import { test } from "node:test";
import assert from "node:assert/strict";

import {
    compareCandidates
} from "../../generator/src/equivalence.js";

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
// Chicago fixture
// =============================================================================

const CHICAGO_PLACE: CensusPlace = {
    placeFips: "1714000",
    city: "Chicago",
    state: "IL",
    placeType: "incorporated-place"
};


/**
 * Real Chicago layer URL from the captured discovery run.
 *
 * This was the historical layer that was incorrectly selected as canonical.
 */
const CHICAGO_2015_URL =
    "https://gis.cookcountyil.gov/traditional/rest/services/clerkTaxDistricts/MapServer/17";


/**
 * Real Chicago layer URL from the captured discovery run.
 *
 * This is the second Chicago ward layer discovered during the same run.
 */
const CHICAGO_CURRENT_URL =
    "https://services5.arcgis.com/vpj2CFUi9GMpbJDh/arcgis/rest/services/Wards_and_Districts/FeatureServer/133";


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
): DiscoveryCandidate {

    return {
        itemId:
            options.itemId,

        placeFips:
            CHICAGO_PLACE.placeFips,

        city:
            CHICAGO_PLACE.city,

        state:
            CHICAGO_PLACE.state,

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
            "Chicago regression fixture"
        ],

        source:
            "arcgis"
    };
}


function createClassification(
    options: {
        officialMunicipalSource?: boolean;
        requiresReview?: boolean;
        temporalStatus?: CandidateClassification["temporalStatus"];
    } = {}
): CandidateClassification {

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
            options.officialMunicipalSource ??
            false,

        districtType:
            "ward",

        temporalStatus:
            options.temporalStatus ??
            "undated",

        sourceRole:
            "unknown",

        rejected:
            false,

        rejectionReasons: [],

        requiresReview:
            options.requiresReview ??
            false,

        matches: {

            thematic: [],

            census: [],

            parcel: [],

            housing: [],

            political: [
                "ward",
                "city council"
            ],

            boundary: [
                "boundary"
            ],

            official:
                options.officialMunicipalSource
                    ? [
                        "municipal government"
                    ]
                    : []
        }
    };
}


function createValidation(
    options: {
        confidence?: number;
        districtField?: string;
        nameField?: string;
        distinctDistrictValues?: string[];
    } = {}
): ArcGISCandidateValidation {

    return {

        isLikelyPoliticalBoundary:
            true,

        confidence:
            options.confidence ??
            90,

        districtField:
            options.districtField ??
            "WARD",

        sampleCount:
            10,

        distinctDistrictValues:
            options.distinctDistrictValues ??
            [
                "1",
                "2",
                "3",
                "4",
                "5",
                "6",
                "7"
            ],

        districtValuePattern:
            "ward-number",

        geometryType:
            "esriGeometryPolygon",

        evidence: [
            "Chicago ward regression fixture"
        ]
    };
}


function createInspection(
    options: {
        url: string;
        title: string;
        serviceName: string;
        layerName: string;
        serviceType: "FeatureServer" | "MapServer";
        districtField: string;
        nameField: string;
        fields: string[];
        description?: string;
        serviceDescription?: string;
        tags?: string[];
        typeKeywords?: string[];
        itemId: string;
    }
): ArcGISInspection {

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
            17,

        title:
            options.title,

        serviceName:
            options.serviceName,

        layerName:
            options.layerName,

        description:
            options.description,

        serviceDescription:
            options.serviceDescription,

        geometryType:
            "esriGeometryPolygon",

        fields:
            options.fields.map(
                name => ({
                    name
                })
            ),

        districtFields: [
            options.districtField
        ],

        districtField:
            options.districtField,

        nameFields: [
            options.nameField
        ],

        nameField:
            options.nameField,

        fieldSamples: [],

        supportsQuery:
            true,

        supportsGeoJSON:
            true,

        supportsPagination:
            true,

        itemId:
            options.itemId,

        typeKeywords:
            options.typeKeywords,

        tags:
            options.tags
    };
}


function createInspectedCandidate(
    options: {
        url: string;
        title: string;
        serviceName: string;
        layerName: string;
        serviceType: "FeatureServer" | "MapServer";
        districtField: string;
        nameField: string;
        fields: string[];
        classification: CandidateClassification;
        validation: ArcGISCandidateValidation;
        description?: string;
        serviceDescription?: string;
        tags?: string[];
        typeKeywords?: string[];
        itemId: string;
    }
): InspectedCandidate {

    const candidate =
        createDiscoveryCandidate({
            url:
                options.url,

            title:
                options.title,

            itemId:
                options.itemId,

            requiresReview:
                options.classification.requiresReview
        });

    const inspection =
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

            districtField:
                options.districtField,

            nameField:
                options.nameField,

            fields:
                options.fields,

            description:
                options.description,

            serviceDescription:
                options.serviceDescription,

            tags:
                options.tags,

            typeKeywords:
                options.typeKeywords,

            itemId:
                options.itemId
        });

    return {
        candidate,

        inspection,

        classification:
            options.classification,

        validation:
            options.validation
    };
}


// =============================================================================
// Candidate fixtures
// =============================================================================

function createHistoricalChicagoCandidate():
    InspectedCandidate {

    return createInspectedCandidate({

        url:
            CHICAGO_2015_URL,

        title:
            "Chicago Wards (2015)",

        serviceName:
            "clerkTaxDistricts",

        layerName:
            "Chicago Wards (2015)",

        serviceType:
            "MapServer",

        districtField:
            "WARD",

        nameField:
            "WARD",

        fields: [
            "WARD"
        ],

        classification:
            createClassification({
                officialMunicipalSource:
                    true,

                temporalStatus:
                    "historical"
            }),

        validation:
            createValidation({
                confidence:
                    95,

                districtField:
                    "WARD",

                nameField:
                    "WARD"
            }),

        description:
            "Chicago ward boundaries from the 2015 election cycle.",

        itemId:
            "chicago-wards-2015"
    });
}


function createCurrentChicagoCandidate():
    InspectedCandidate {

    return createInspectedCandidate({

        url:
            CHICAGO_CURRENT_URL,

        title:
            "Chicago Wards",

        serviceName:
            "Wards_and_Districts",

        layerName:
            "Chicago Wards",

        serviceType:
            "FeatureServer",

        districtField:
            "District",

        nameField:
            "Name",

        fields: [
            "District",
            "Name"
        ],

        classification:
            createClassification({
                officialMunicipalSource:
                    false,

                requiresReview:
                    true,

                temporalStatus:
                    "current"
            }),

        validation:
            createValidation({
                confidence:
                    85,

                districtField:
                    "District",

                nameField:
                    "Name"
            }),

        serviceDescription:
            "Current Chicago ward boundaries maintained for the municipality.",

        tags: [
            "political boundaries"
        ],

        itemId:
            "chicago-wards-current"
    });
}


// =============================================================================
// Tests
// =============================================================================

test(
    "Chicago historical and current ward layers are grouped into one equivalence group",
    () => {

        const historical =
            createHistoricalChicagoCandidate();

        const current =
            createCurrentChicagoCandidate();

        const result =
            buildDiscoveryResult(
                CHICAGO_PLACE,
                [
                    historical,
                    current
                ]
            );

        const comparison =
            compareCandidates(
                historical,
                current
            );

        assert.equal(
            comparison.equivalent,
            true
        );

        assert.ok(
            comparison.confidence >= 0.60
        );

        assert.equal(
            result.validCandidates.length,
            2
        );

        assert.equal(
            result.equivalentGroups.length,
            1
        );

        assert.equal(
            result.equivalentGroups[0]?.candidates.length,
            2
        );
    }
);


test(
    "Chicago current ward layer is selected as canonical over the 2015 layer",
    () => {

        const historical =
            createHistoricalChicagoCandidate();

        const current =
            createCurrentChicagoCandidate();

        const result =
            buildDiscoveryResult(
                CHICAGO_PLACE,
                [
                    historical,
                    current
                ]
            );

        assert.ok(
            result.canonical
        );

        assert.equal(
            result.canonical?.url,
            CHICAGO_CURRENT_URL
        );

        assert.notEqual(
            result.canonical?.url,
            CHICAGO_2015_URL
        );
    }
);


test(
    "Chicago canonical selection retains the historical source as an alternative",
    () => {

        const historical =
            createHistoricalChicagoCandidate();

        const current =
            createCurrentChicagoCandidate();

        const result =
            buildDiscoveryResult(
                CHICAGO_PLACE,
                [
                    historical,
                    current
                ]
            );

        assert.ok(
            result.canonical
        );

        const alternatives =
            result.canonical?.alternatives ??
            [];

        assert.ok(
            alternatives.some(
                alternative =>
                    alternative.url ===
                    CHICAGO_2015_URL
            )
        );
    }
);


test(
    "Chicago temporal ranking evidence favors the current layer",
    () => {

        const historical =
            createHistoricalChicagoCandidate();

        const current =
            createCurrentChicagoCandidate();

        const result =
            buildDiscoveryResult(
                CHICAGO_PLACE,
                [
                    historical,
                    current
                ]
            );

        const currentRanked =
            result.rankedCandidates.find(
                ranked =>
                    ranked.candidate.candidate.url ===
                    CHICAGO_CURRENT_URL
            );

        const historicalRanked =
            result.rankedCandidates.find(
                ranked =>
                    ranked.candidate.candidate.url ===
                    CHICAGO_2015_URL
            );

        assert.ok(
            currentRanked
        );

        assert.ok(
            historicalRanked
        );

        assert.ok(
            currentRanked.score >
            historicalRanked.score
        );

        assert.ok(
            currentRanked.reasons.some(
                reason =>
                    reason.includes(
                        "temporal status: current"
                    )
            )
        );

        assert.ok(
            historicalRanked.reasons.some(
                reason =>
                    reason.includes(
                        "temporal status: historical"
                    )
            )
        );
    }
);


test(
    "Chicago equivalence grouping is unchanged by candidate discovery order",
    () => {

        const historical =
            createHistoricalChicagoCandidate();

        const current =
            createCurrentChicagoCandidate();

        const firstResult =
            buildDiscoveryResult(
                CHICAGO_PLACE,
                [
                    historical,
                    current
                ]
            );

        const secondResult =
            buildDiscoveryResult(
                CHICAGO_PLACE,
                [
                    current,
                    historical
                ]
            );

        assert.equal(
            firstResult.equivalentGroups.length,
            1
        );

        assert.equal(
            secondResult.equivalentGroups.length,
            1
        );

        assert.equal(
            firstResult.equivalentGroups[0]?.candidates.length,
            2
        );

        assert.equal(
            secondResult.equivalentGroups[0]?.candidates.length,
            2
        );

        assert.equal(
            firstResult.equivalentGroups[0]?.id,
            secondResult.equivalentGroups[0]?.id
        );

        assert.equal(
            firstResult.canonical?.url,
            CHICAGO_CURRENT_URL
        );

        assert.equal(
            secondResult.canonical?.url,
            CHICAGO_CURRENT_URL
        );
    }
);
