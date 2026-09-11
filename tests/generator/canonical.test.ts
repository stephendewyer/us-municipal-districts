import {
    test
} from "node:test";

import assert from "node:assert/strict";

import type {
    ArcGISInspection,
    ArcGISCandidateValidation,
    CandidateClassification,
    DiscoveryCandidate,
    EquivalentLayerGroup,
    InspectedCandidate
} from "../../generator/src/types.js";

import {
    selectCanonicalSource,
    selectMunicipalityCanonicalSource
} from "../../generator/src/canonical.js";


// =============================================================================
// Test fixtures
// =============================================================================

function createDiscoveryCandidate(
    url =
        "https://example.com/FeatureServer/0"
): DiscoveryCandidate {

    return {

        placeFips:
            "0477000",

        city:
            "Tucson",

        state:
            "AZ",

        url,

        title:
            "Tucson Ward Boundaries",

        score:
            50,

        requiresReview:
            false,

        reasons:
            []
    };
}


function createArcGISInspection(
    url =
        "https://example.com/FeatureServer/0",

    title =
        "Tucson Ward Boundaries"
): ArcGISInspection {

    return {

        url,

        isArcGIS:
            true,

        serviceType:
            "FeatureServer",

        isLayer:
            true,

        geometryType:
            "esriGeometryPolygon",

        title,

        districtFields:
            ["WARD"],

        districtField:
            "WARD",

        nameFields:
            [],

        fieldSamples:
            []
    };
}


function createClassification(): CandidateClassification {

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
            false,

        districtType:
            "ward",

        temporalStatus: "undated",

        sourceRole: "unknown",

        rejected:
            false,

        rejectionReasons:
            [],

        requiresReview:
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

            political:
                ["ward"],

            boundary:
                ["boundary"],

            official:
                []
        }
    };
}


function createValidation(
    confidence = 90
): ArcGISCandidateValidation {

    return {

        isLikelyPoliticalBoundary:
            true,

        confidence,

        districtField:
            "WARD",

        sampleCount:
            10,

        featureCount:
            10,

        distinctDistrictValues:
            [
                "1",
                "2",
                "3",
                "4"
            ],

        districtValuePattern:
            "ward-number",

        geometryType:
            "esriGeometryPolygon",

        evidence:
            [
                "Test validation fixture"
            ]
    };
}


function createCandidate(
    geographyStatus?:
        | "strong-match"
        | "probable-match"
        | "weak-match"
        | "no-match"
        | "invalid",

    url =
        "https://example.com/FeatureServer/0",

    title =
        "Tucson Ward Boundaries"
): InspectedCandidate {

    const candidate:
        InspectedCandidate = {

        candidate:
            createDiscoveryCandidate(
                url
            ),

        inspection:
            createArcGISInspection(
                url,
                title
            ),

        classification:
            createClassification(),

        validation:
            createValidation()
    };


    if (
        geographyStatus !==
        undefined
    ) {

        const intersectionArea =
            geographyStatus ===
                "strong-match"
                ? 100
                : geographyStatus ===
                    "probable-match"
                    ? 75
                    : geographyStatus ===
                        "weak-match"
                        ? 40
                        : 0;


        const coverage =
            geographyStatus ===
                "strong-match"
                ? 1
                : geographyStatus ===
                    "probable-match"
                    ? 0.75
                    : geographyStatus ===
                        "weak-match"
                        ? 0.40
                        : 0;


        candidate.municipalityGeographyValidation = {

            status:
                geographyStatus,

            score:
                geographyStatus ===
                    "strong-match"
                    ? 100
                    : geographyStatus ===
                        "probable-match"
                        ? 75
                        : geographyStatus ===
                            "weak-match"
                            ? 40
                            : 0,

            likelyMunicipalityMatch:
                geographyStatus ===
                    "strong-match" ||
                geographyStatus ===
                    "probable-match",

            municipalityArea:
                100,

            candidateArea:
                100,

            intersectionArea,

            coverageOfMunicipality:
                coverage,

            candidateInsideMunicipality:
                coverage,

            candidateFeatureCount:
                4,

            validCandidateFeatureCount:
                4,

            reasons:
                [
                    `Test geographic status: ${geographyStatus}`
                ]
        };
    }


    return candidate;
}


function createGroup(
    candidates: InspectedCandidate[],
    id =
        "test-group"
): EquivalentLayerGroup {

    return {

        id,

        candidates,

        confidence:
            1,

        reasons:
            [
                "Test equivalent-layer group"
            ]
    };
}

function createPhoenixCandidate(
    url: string,
    title: string
): InspectedCandidate {

    const candidate =
        createCandidate(
            undefined,
            url,
            title
        );

    candidate.candidate.city =
        "Phoenix";

    candidate.candidate.state =
        "AZ";

    candidate.candidate.placeFips =
        "0455000";

    candidate.candidate.title =
        title;

    candidate.classification.districtType =
        "council-district";

    candidate.classification.officialMunicipalSource =
        true;

    candidate.inspection.districtFields =
        [
            "DISTRICT"
        ];

    candidate.inspection.districtField =
        "DISTRICT";

    candidate.validation =
        createValidation();

    candidate.validation.districtField =
        "DISTRICT";

    candidate.validation.distinctDistrictValues =
        [
            "1",
            "2",
            "3",
            "4",
            "5",
            "6",
            "7",
            "8"
        ];

    candidate.validation.confidence =
        100;

    return candidate;
}


// =============================================================================
// Canonical selection tests
// =============================================================================

test(
    "selectCanonicalSource prefers a strong geographic match over a probable match",
    () => {

        const probable =
            createCandidate(
                "probable-match",
                "https://example.com/probable/FeatureServer/0"
            );

        const strong =
            createCandidate(
                "strong-match",
                "https://example.com/strong/FeatureServer/0"
            );


        const result =
            selectCanonicalSource(
                createGroup([
                    probable,
                    strong
                ])
            );


        assert.ok(
            result
        );

        assert.equal(
            result.url,
            strong.inspection.url
        );

        assert.match(
            result.selectionReasons.join(" "),
            /\+30 strong municipality geography match/
        );
    }
);


test(
    "selectCanonicalSource allows a strong geographic match to overcome a modest review penalty",
    () => {

        const reviewCandidate =
            createCandidate(
                undefined,
                "https://example.com/review/FeatureServer/0"
            );

        reviewCandidate.candidate.requiresReview =
            true;


        const strongGeographyCandidate =
            createCandidate(
                "strong-match",
                "https://example.com/geographic/FeatureServer/0"
            );


        /*
         * The review candidate receives -10 from rank.ts.
         *
         * The geographically matched candidate receives +30.
         *
         * This verifies that the geographic score can materially affect
         * canonical selection without incorrectly assuming that
         * DiscoveryCandidate.score is part of the ranking calculation.
         */

        const result =
            selectCanonicalSource(
                createGroup([
                    reviewCandidate,
                    strongGeographyCandidate
                ])
            );


        assert.ok(
            result
        );

        assert.equal(
            result.url,
            strongGeographyCandidate.inspection.url
        );

        assert.ok(
            result.score >
            0
        );

        assert.match(
            result.selectionReasons.join(" "),
            /\+30 strong municipality geography match/
        );
    }
);


test(
    "selectCanonicalSource demotes a candidate with a geographic no-match",
    () => {

        const noMatch =
            createCandidate(
                "no-match",
                "https://example.com/no-match/FeatureServer/0"
            );

        const strong =
            createCandidate(
                "strong-match",
                "https://example.com/strong/FeatureServer/0"
            );


        const result =
            selectCanonicalSource(
                createGroup([
                    noMatch,
                    strong
                ])
            );


        assert.ok(
            result
        );

        assert.equal(
            result.url,
            strong.inspection.url
        );

        assert.notEqual(
            result.url,
            noMatch.inspection.url
        );
    }
);


test(
    "selectCanonicalSource uses geographic ranking when selecting the canonical source",
    () => {

        const weak =
            createCandidate(
                "weak-match",
                "https://example.com/weak/FeatureServer/0"
            );

        const strong =
            createCandidate(
                "strong-match",
                "https://example.com/strong/FeatureServer/0"
            );


        const result =
            selectCanonicalSource(
                createGroup([
                    weak,
                    strong
                ])
            );


        assert.ok(
            result
        );

        assert.equal(
            result.url,
            strong.inspection.url
        );

        assert.equal(
            result.officialMunicipalSource,
            false
        );

        assert.equal(
            result.serviceType,
            "FeatureServer"
        );

        assert.equal(
            result.districtField,
            "WARD"
        );
    }
);


test(
    "selectCanonicalSource propagates geographic ranking reasons into selectionReasons",
    () => {

        const candidate =
            createCandidate(
                "strong-match"
            );


        const result =
            selectCanonicalSource(
                createGroup([
                    candidate
                ])
            );


        assert.ok(
            result
        );


        assert.ok(
            result.selectionReasons.some(
                reason =>
                    reason ===
                    "+30 strong municipality geography match"
            )
        );


        assert.ok(
            result.selectionReasons.some(
                reason =>
                    reason ===
                    "+15 district type: ward"
            )
        );


        assert.ok(
            result.selectionReasons.some(
                reason =>
                    reason ===
                    "+15 district field: WARD"
            )
        );


        assert.ok(
            result.selectionReasons.some(
                reason =>
                    reason ===
                    "+20 validation confidence >= 0.90"
            )
        );
    }
);


// =============================================================================
// Temporal canonical selection
// =============================================================================

test(
    "selectCanonicalSource prefers a current candidate over a historical candidate",
    () => {

        const historical =
            createCandidate(
                undefined,
                "https://example.com/historical/FeatureServer/0",
                "Tucson Ward Boundaries (2015)"
            );

        const current =
            createCandidate(
                undefined,
                "https://example.com/current/FeatureServer/0",
                "Current Tucson Ward Boundaries"
            );


        const result =
            selectCanonicalSource(
                createGroup([
                    historical,
                    current
                ])
            );


        assert.ok(
            result
        );

        assert.equal(
            result.url,
            current.inspection.url
        );

        assert.equal(
            result.title,
            "Current Tucson Ward Boundaries"
        );

        assert.ok(
            result.score >
            0
        );

        assert.ok(
            result.selectionReasons.some(
                reason =>
                    reason ===
                    "+20 temporal status: current"
            )
        );
    }
);


test(
    "selectCanonicalSource demotes a historical candidate in canonical selection",
    () => {

        const historical =
            createCandidate(
                undefined,
                "https://example.com/historical/FeatureServer/0",
                "Tucson Ward Boundaries (2015)"
            );


        const result =
            selectCanonicalSource(
                createGroup([
                    historical
                ])
            );


        assert.ok(
            result
        );

        assert.equal(
            result.url,
            historical.inspection.url
        );

        assert.ok(
            result.selectionReasons.some(
                reason =>
                    reason ===
                    "-60 temporal status: historical"
            )
        );
    }
);


test(
    "selectCanonicalSource prefers an undated candidate over a historical candidate",
    () => {

        const historical =
            createCandidate(
                undefined,
                "https://example.com/historical/FeatureServer/0",
                "Tucson Ward Boundaries (2015)"
            );

        const undated =
            createCandidate(
                undefined,
                "https://example.com/undated/FeatureServer/0",
                "Tucson Ward Boundaries"
            );


        const result =
            selectCanonicalSource(
                createGroup([
                    historical,
                    undated
                ])
            );


        assert.ok(
            result
        );

        assert.equal(
            result.url,
            undated.inspection.url
        );

        assert.equal(
            result.title,
            "Tucson Ward Boundaries"
        );

        assert.ok(
            result.score >
            Number.NEGATIVE_INFINITY
        );
    }
);


test(
    "selectCanonicalSource preserves the historical candidate as an alternative",
    () => {

        const historical =
            createCandidate(
                undefined,
                "https://example.com/historical/FeatureServer/0",
                "Tucson Ward Boundaries (2015)"
            );

        const current =
            createCandidate(
                undefined,
                "https://example.com/current/FeatureServer/0",
                "Current Tucson Ward Boundaries"
            );


        const result =
            selectCanonicalSource(
                createGroup([
                    historical,
                    current
                ])
            );


        assert.ok(
            result
        );

        assert.equal(
            result.url,
            current.inspection.url
        );

        assert.equal(
            result.alternatives.length,
            1
        );

        assert.equal(
            result.alternatives[0]?.url,
            historical.inspection.url
        );

        assert.equal(
            result.alternatives[0]?.title,
            "Tucson Ward Boundaries (2015)"
        );
    }
);

// =============================================================================
// Phoenix municipality-wide canonical selection regression
// =============================================================================

test(
    "Phoenix prefers the boundary-native Council Districts source over the derived Eviction Filings source",
    () => {

        const councilDistricts =
            createPhoenixCandidate(
                "https://maps.phoenix.gov/pub/rest/services/Public/Council_Districts/MapServer/0",
                "Council Districts and Members"
            );

        const evictionFilings =
            createPhoenixCandidate(
                "https://maps.phoenix.gov/pub/rest/services/Public/Eviction_Filings_HSD/MapServer/1",
                "Eviction Filings by Council Districts"
            );


        /*
         * These candidates intentionally belong to separate equivalence
         * groups.
         *
         * This reproduces the real Phoenix situation where:
         *
         *     Council Districts
         *         ↓
         *     equivalence group 1
         *
         *     Eviction Filings by Council Districts
         *         ↓
         *     equivalence group 2
         *
         * The municipality-wide selector must still choose the
         * boundary-native source.
         */

        const councilGroup =
            createGroup(
                [
                    councilDistricts
                ],
                "phoenix-council-districts"
            );

        const evictionGroup =
            createGroup(
                [
                    evictionFilings
                ],
                "phoenix-eviction-filings"
            );


        const result =
            selectMunicipalityCanonicalSource(
                [
                    councilGroup,
                    evictionGroup
                ]
            );


        assert.ok(
            result
        );


        assert.equal(
            result.url,
            "https://maps.phoenix.gov/pub/rest/services/Public/Council_Districts/MapServer/0"
        );


        assert.equal(
            result.title,
            "Council Districts and Members"
        );


        assert.equal(
            result.city,
            "Phoenix"
        );


        assert.equal(
            result.state,
            "AZ"
        );


        assert.equal(
            result.placeFips,
            "0455000"
        );


        assert.equal(
            result.districtType,
            "council-district"
        );


        assert.equal(
            result.districtField,
            "DISTRICT"
        );


        assert.equal(
            result.officialMunicipalSource,
            true
        );
    }
);