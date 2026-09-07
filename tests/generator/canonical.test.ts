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
    selectCanonicalSource
} from "../../generator/src/canonical.js";


// =============================================================================
// Test fixtures
// =============================================================================

function createDiscoveryCandidate(
    url = "https://example.com/FeatureServer/0"
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
    url = "https://example.com/FeatureServer/0"
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

        title:
            "Tucson Ward Boundaries",

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
        "https://example.com/FeatureServer/0"
): InspectedCandidate {

    const candidate:
        InspectedCandidate = {

        candidate:
            createDiscoveryCandidate(
                url
            ),

        inspection:
            createArcGISInspection(
                url
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
    id = "test-group"
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
                    "district type: ward"
            )
        );


        assert.ok(
            result.selectionReasons.some(
                reason =>
                    reason ===
                    "district field: WARD"
            )
        );


        assert.ok(
            result.selectionReasons.some(
                reason =>
                    reason ===
                    "validation confidence: 90"
            )
        );
    }
);
