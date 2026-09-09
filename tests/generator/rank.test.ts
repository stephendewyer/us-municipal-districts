import {
    test
} from "node:test";

import assert from "node:assert/strict";

import type {
    ArcGISInspection,
    ArcGISCandidateValidation,
    CandidateClassification,
    DiscoveryCandidate,
    InspectedCandidate
} from "../../generator/src/types.js";

import {
    scoreCandidate,
    rankCandidates
} from "../../generator/src/rank.js";


// =============================================================================
// Test fixtures
// =============================================================================

function createDiscoveryCandidate(
    url = "https://example.com/FeatureServer/0"
): DiscoveryCandidate {
    return {
        placeFips: "0477000",
        city: "Tucson",
        state: "AZ",
        url,
        title: "Tucson Ward Boundaries",
        score: 50,
        requiresReview: false,
        reasons: []
    };
}


function createInspection(
    url = "https://example.com/FeatureServer/0",
    title = "Tucson Ward Boundaries"
): ArcGISInspection {
    return {
        url,
        isArcGIS: true,
        serviceType: "FeatureServer",
        isLayer: true,

        geometryType:
            "esriGeometryPolygon",

        title,

        districtFields: [
            "WARD"
        ],

        districtField:
            "WARD",

        nameFields: [],

        fieldSamples: []
    };
}


function createClassification(): CandidateClassification {
    return {
        isBoundaryLayer: true,
        isPoliticalBoundary: true,

        isThematicDataset: false,
        isCensusDataset: false,
        isParcelDataset: false,
        isHousingDataset: false,

        officialMunicipalSource: false,

        districtType:
            "ward",

        rejected: false,

        rejectionReasons: [],

        requiresReview: false,

        matches: {
            thematic: [],
            census: [],
            parcel: [],
            housing: [],

            political: [
                "ward"
            ],

            boundary: [
                "boundary"
            ],

            official: []
        }
    };
}


function createValidation(): ArcGISCandidateValidation {
    return {
        isLikelyPoliticalBoundary: true,

        confidence: 90,

        districtField:
            "WARD",

        sampleCount: 10,

        featureCount: 10,

        distinctDistrictValues: [
            "1",
            "2",
            "3",
            "4"
        ],

        districtValuePattern:
            "ward-number",

        geometryType:
            "esriGeometryPolygon",

        evidence: [
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

    const candidate: InspectedCandidate = {
        candidate:
            createDiscoveryCandidate(
                url
            ),

        inspection:
            createInspection(
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

            intersectionArea:
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

            coverageOfMunicipality:
                geographyStatus ===
                "strong-match"
                    ? 1
                    : geographyStatus ===
                      "probable-match"
                        ? 0.75
                        : geographyStatus ===
                          "weak-match"
                            ? 0.40
                            : 0,

            candidateInsideMunicipality:
                geographyStatus ===
                "strong-match"
                    ? 1
                    : geographyStatus ===
                      "probable-match"
                        ? 0.75
                        : geographyStatus ===
                          "weak-match"
                            ? 0.40
                            : 0,

            candidateFeatureCount:
                4,

            validCandidateFeatureCount:
                4,

            reasons: [
                `Test geographic status: ${geographyStatus}`
            ]
        };
    }


    return candidate;
}


// =============================================================================
// Geographic ranking
// =============================================================================

test(
    "strong geographic match adds 30 points",
    () => {

        const withoutGeography =
            scoreCandidate(
                createCandidate()
            );

        const withGeography =
            scoreCandidate(
                createCandidate(
                    "strong-match"
                )
            );

        assert.equal(
            withGeography.score -
                withoutGeography.score,
            30
        );

        assert.ok(
            withGeography.reasons.includes(
                "+30 strong municipality geography match"
            )
        );
    }
);


test(
    "probable geographic match adds 20 points",
    () => {

        const withoutGeography =
            scoreCandidate(
                createCandidate()
            );

        const withGeography =
            scoreCandidate(
                createCandidate(
                    "probable-match"
                )
            );

        assert.equal(
            withGeography.score -
                withoutGeography.score,
            20
        );

        assert.ok(
            withGeography.reasons.includes(
                "+20 probable municipality geography match"
            )
        );
    }
);


test(
    "weak geographic match adds 5 points",
    () => {

        const withoutGeography =
            scoreCandidate(
                createCandidate()
            );

        const withGeography =
            scoreCandidate(
                createCandidate(
                    "weak-match"
                )
            );

        assert.equal(
            withGeography.score -
                withoutGeography.score,
            5
        );

        assert.ok(
            withGeography.reasons.includes(
                "+5 weak municipality geography match"
            )
        );
    }
);


test(
    "geographic no-match subtracts 15 points",
    () => {

        const withoutGeography =
            scoreCandidate(
                createCandidate()
            );

        const withGeography =
            scoreCandidate(
                createCandidate(
                    "no-match"
                )
            );

        assert.equal(
            withGeography.score -
                withoutGeography.score,
            -15
        );

        assert.ok(
            withGeography.reasons.includes(
                "-15 candidate does not match municipality geography"
            )
        );
    }
);


test(
    "invalid geographic validation adds no points",
    () => {

        const withoutGeography =
            scoreCandidate(
                createCandidate()
            );

        const withGeography =
            scoreCandidate(
                createCandidate(
                    "invalid"
                )
            );

        assert.equal(
            withGeography.score -
                withoutGeography.score,
            0
        );

        assert.ok(
            withGeography.reasons.includes(
                "0 invalid municipality geography validation"
            )
        );
    }
);


test(
    "missing geographic validation adds no points",
    () => {

        const withoutGeography =
            scoreCandidate(
                createCandidate()
            );

        const withGeography =
            scoreCandidate(
                createCandidate(
                    undefined
                )
            );

        assert.equal(
            withGeography.score,
            withoutGeography.score
        );

        assert.equal(
            withGeography.reasons.some(
                reason =>
                    reason.includes(
                        "municipality geography"
                    )
            ),
            false
        );
    }
);


// =============================================================================
// Geographic ranking order
// =============================================================================

test(
    "strong geographic match outranks an otherwise equivalent candidate",
    () => {

        const candidateWithoutGeography =
            createCandidate(
                undefined,
                "https://example.com/a/FeatureServer/0"
            );

        const candidateWithStrongGeography =
            createCandidate(
                "strong-match",
                "https://example.com/b/FeatureServer/0"
            );

        const ranked =
            rankCandidates([
                candidateWithoutGeography,
                candidateWithStrongGeography
            ]);

        assert.equal(
            ranked.length,
            2
        );

        assert.equal(
            ranked[0].candidate
                .municipalityGeographyValidation
                ?.status,
            "strong-match"
        );

        assert.equal(
            ranked[1].candidate
                .municipalityGeographyValidation,
            undefined
        );

        assert.ok(
            ranked[0].score >
            ranked[1].score
        );
    }
);


// =============================================================================
// Temporal ranking
// =============================================================================

test(
    "current temporal evidence adds 20 points",
    () => {

        const undated =
            scoreCandidate(
                createCandidate(
                    undefined,
                    "https://example.com/a/FeatureServer/0",
                    "Tucson Ward Boundaries"
                )
            );

        const current =
            scoreCandidate(
                createCandidate(
                    undefined,
                    "https://example.com/b/FeatureServer/0",
                    "Current Tucson Ward Boundaries"
                )
            );

        assert.equal(
            current.score -
                undated.score,
            20
        );

        assert.ok(
            current.reasons.includes(
                "+20 temporal status: current"
            )
        );
    }
);


test(
    "historical temporal evidence subtracts 60 points",
    () => {

        const undated =
            scoreCandidate(
                createCandidate(
                    undefined,
                    "https://example.com/a/FeatureServer/0",
                    "Tucson Ward Boundaries"
                )
            );

        const historical =
            scoreCandidate(
                createCandidate(
                    undefined,
                    "https://example.com/b/FeatureServer/0",
                    "Tucson Ward Boundaries (2015)"
                )
            );

        assert.equal(
            historical.score -
                undated.score,
            -60
        );

        assert.ok(
            historical.reasons.includes(
                "-60 temporal status: historical"
            )
        );
    }
);


test(
    "current candidate outranks an otherwise equivalent historical candidate",
    () => {

        const historical =
            createCandidate(
                undefined,
                "https://example.com/a/FeatureServer/0",
                "Tucson Ward Boundaries (2015)"
            );

        const current =
            createCandidate(
                undefined,
                "https://example.com/b/FeatureServer/0",
                "Current Tucson Ward Boundaries"
            );

        const ranked =
            rankCandidates([
                historical,
                current
            ]);

        assert.equal(
            ranked.length,
            2
        );

        assert.equal(
            ranked[0]
                .candidate
                .inspection
                .title,
            "Current Tucson Ward Boundaries"
        );

        assert.equal(
            ranked[1]
                .candidate
                .inspection
                .title,
            "Tucson Ward Boundaries (2015)"
        );

        assert.ok(
            ranked[0].score >
            ranked[1].score
        );
    }
);