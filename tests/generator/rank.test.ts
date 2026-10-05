import {
    test
} from "node:test";

import assert from "node:assert/strict";

import {
    validateTemporal
} from "../../generator/src/temporalValidation.js";

import type {
    ArcGISInspection,
    ArcGISCandidateValidation,
    CandidateClassification,
    DiscoveryCandidate,
    InspectedCandidate
} from "../../generator/src/types.js";

import {
    scoreCandidate,
    rankCandidates,
    compareCandidateScores
} from "../../generator/src/rank.js";


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


function createInspection(
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

        districtFields: [
            "WARD"
        ],

        districtField:
            "WARD",

        nameFields: [],

        fieldSamples: []
    };
}


function createClassification(
    temporalStatus:
        CandidateClassification["temporalStatus"] =
            "undated"
): CandidateClassification {

    return {
        isBoundaryLayer:
            true,

        isPoliticalBoundary:
            true,

        isMunicipalPoliticalBoundary:
            true,

        publisherLevel:
            "municipal",

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

        temporalStatus,

        sourceRole:
            "unknown",

        rejected:
            false,

        rejectionReasons:
            [],

        requiresReview:
            false,

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
        isLikelyPoliticalBoundary:
            true,

        confidence:
            90,

        districtField:
            "WARD",

        sampleCount:
            10,

        featureCount:
            10,

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

    const candidate:
        InspectedCandidate = {

        candidate:
            createDiscoveryCandidate(
                url
            ),

        inspection:
            createInspection(
                url,
                title
            ),

        /*
         * Deliberately leave this as "undated" by default.
         *
         * Temporal ranking should use the authoritative inspection
         * evidence through validateTemporal(), rather than relying
         * on potentially stale classification metadata.
         */
        classification:
            createClassification(),

        validation:
            createValidation()
    };


    if (
        geographyStatus !==
        undefined
    ) {

        const score =
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

        candidate.municipalityGeographyValidation = {

            status:
                geographyStatus,

            score,

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
                score,

            coverageOfMunicipality:
                score / 100,

            candidateInsideMunicipality:
                score / 100,

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
                createCandidate()
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


test(
    "strong geographic match outranks an otherwise equivalent candidate",
    () => {

        const withoutGeography =
            createCandidate(
                undefined,
                "https://example.com/a/FeatureServer/0"
            );

        const withStrongGeography =
            createCandidate(
                "strong-match",
                "https://example.com/b/FeatureServer/0"
            );

        const ranked =
            rankCandidates([
                withoutGeography,
                withStrongGeography
            ]);

        assert.equal(
            ranked.length,
            2
        );

        assert.equal(
            ranked[0]
                .candidate
                .municipalityGeographyValidation
                ?.status,
            "strong-match"
        );

        assert.equal(
            ranked[1]
                .candidate
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
// Temporal scoring
// =============================================================================

test(
    "undated temporal evidence adds 0 points",
    () => {

        const result =
            scoreCandidate(
                createCandidate(
                    undefined,
                    "https://example.com/a/FeatureServer/0",
                    "Tucson Ward Boundaries"
                )
            );

        const temporal =
            validateTemporal(
                result.candidate.inspection
            );

        assert.equal(
            temporal.status,
            "undated"
        );

        assert.equal(
            temporal.score,
            0
        );

        assert.ok(
            result.reasons.includes(
                "+0 temporal status: undated"
            )
        );
    }
);


test(
    "current temporal evidence adds 20 points",
    () => {

        const result =
            scoreCandidate(
                createCandidate(
                    undefined,
                    "https://example.com/a/FeatureServer/0",
                    "Current Tucson Ward Boundaries"
                )
            );

        const temporal =
            validateTemporal(
                result.candidate.inspection
            );

        assert.equal(
            temporal.status,
            "current"
        );

        assert.equal(
            temporal.score,
            20
        );

        assert.ok(
            result.reasons.includes(
                "+20 temporal status: current"
            )
        );
    }
);


test(
    "a single past boundary year is dated",
    () => {

        const result =
            scoreCandidate(
                createCandidate(
                    undefined,
                    "https://example.com/a/FeatureServer/0",
                    "Tucson Ward Boundaries 2022"
                )
            );

        const temporal =
            validateTemporal(
                result.candidate.inspection
            );

        assert.equal(
            temporal.status,
            "dated"
        );

        assert.equal(
            temporal.year,
            2022
        );

        assert.equal(
            temporal.score,
            5
        );

        assert.ok(
            result.reasons.includes(
                "+5 temporal status: dated"
            )
        );

        assert.ok(
            result.reasons.includes(
                "temporal vintage year: 2022"
            )
        );
    }
);


test(
    "a completed boundary range is dated rather than historical",
    () => {

        const result =
            scoreCandidate(
                createCandidate(
                    undefined,
                    "https://example.com/a/FeatureServer/0",
                    "Tucson Ward Boundaries 2015-2023"
                )
            );

        const temporal =
            validateTemporal(
                result.candidate.inspection
            );

        assert.equal(
            temporal.status,
            "dated"
        );

        assert.equal(
            temporal.startYear,
            2015
        );

        assert.equal(
            temporal.endYear,
            2023
        );

        assert.equal(
            temporal.score,
            5
        );

        assert.ok(
            result.reasons.includes(
                "+5 temporal status: dated"
            )
        );

        assert.ok(
            result.reasons.includes(
                "temporal vintage year: 2023"
            )
        );
    }
);


test(
    "explicitly historical boundary language is historical",
    () => {

        const result =
            scoreCandidate(
                createCandidate(
                    undefined,
                    "https://example.com/a/FeatureServer/0",
                    "Historical Tucson Ward Boundaries 2015-2023"
                )
            );

        const temporal =
            validateTemporal(
                result.candidate.inspection
            );

        assert.equal(
            temporal.status,
            "historical"
        );

        assert.equal(
            temporal.startYear,
            2015
        );

        assert.equal(
            temporal.endYear,
            2023
        );

        assert.equal(
            temporal.score,
            -60
        );

        assert.ok(
            result.reasons.includes(
                "-60 temporal status: historical"
            )
        );

        assert.ok(
            result.reasons.includes(
                "temporal vintage year: 2023"
            )
        );
    }
);


test(
    "future temporal evidence subtracts 10 points",
    () => {

        const futureYear =
            new Date().getFullYear() + 1;

        const result =
            scoreCandidate(
                createCandidate(
                    undefined,
                    "https://example.com/a/FeatureServer/0",
                    `Tucson Ward Boundaries ${futureYear}`
                )
            );

        const temporal =
            validateTemporal(
                result.candidate.inspection
            );

        assert.equal(
            temporal.status,
            "future"
        );

        assert.equal(
            temporal.year,
            futureYear
        );

        assert.equal(
            temporal.score,
            -10
        );

        assert.ok(
            result.reasons.includes(
                "-10 temporal status: future"
            )
        );

        assert.ok(
            result.reasons.includes(
                `temporal vintage year: ${futureYear}`
            )
        );
    }
);


// =============================================================================
// Temporal ranking
// =============================================================================

test(
    "current candidate outranks dated candidate",
    () => {

        const dated =
            createCandidate(
                undefined,
                "https://example.com/a/FeatureServer/0",
                "Tucson Ward Boundaries 2022"
            );

        const current =
            createCandidate(
                undefined,
                "https://example.com/b/FeatureServer/0",
                "Current Tucson Ward Boundaries"
            );

        const ranked =
            rankCandidates([
                dated,
                current
            ]);

        assert.equal(
            validateTemporal(
                ranked[0].candidate.inspection
            ).status,
            "current"
        );

        assert.equal(
            validateTemporal(
                ranked[1].candidate.inspection
            ).status,
            "dated"
        );
    }
);


test(
    "dated candidate outranks undated candidate",
    () => {

        const undated =
            createCandidate(
                undefined,
                "https://example.com/a/FeatureServer/0",
                "Tucson Ward Boundaries"
            );

        const dated =
            createCandidate(
                undefined,
                "https://example.com/b/FeatureServer/0",
                "Tucson Ward Boundaries 2022"
            );

        const ranked =
            rankCandidates([
                undated,
                dated
            ]);

        assert.equal(
            validateTemporal(
                ranked[0].candidate.inspection
            ).status,
            "dated"
        );

        assert.equal(
            validateTemporal(
                ranked[1].candidate.inspection
            ).status,
            "undated"
        );
    }
);


test(
    "undated candidate outranks historical candidate",
    () => {

        const historical =
            createCandidate(
                undefined,
                "https://example.com/a/FeatureServer/0",
                "Historical Tucson Ward Boundaries 2015-2023"
            );

        const undated =
            createCandidate(
                undefined,
                "https://example.com/b/FeatureServer/0",
                "Tucson Ward Boundaries"
            );

        const ranked =
            rankCandidates([
                historical,
                undated
            ]);

        assert.equal(
            validateTemporal(
                ranked[0].candidate.inspection
            ).status,
            "undated"
        );

        assert.equal(
            validateTemporal(
                ranked[1].candidate.inspection
            ).status,
            "historical"
        );
    }
);


test(
    "historical candidate outranks future candidate",
    () => {

        const futureYear =
            new Date().getFullYear() + 1;

        const historical =
            createCandidate(
                undefined,
                "https://example.com/a/FeatureServer/0",
                "Historical Tucson Ward Boundaries 2015-2023"
            );

        const future =
            createCandidate(
                undefined,
                "https://example.com/b/FeatureServer/0",
                `Tucson Ward Boundaries ${futureYear}`
            );

        const ranked =
            rankCandidates([
                future,
                historical
            ]);

        assert.equal(
            validateTemporal(
                ranked[0].candidate.inspection
            ).status,
            "historical"
        );

        assert.equal(
            validateTemporal(
                ranked[1].candidate.inspection
            ).status,
            "future"
        );
    }
);


// =============================================================================
// Temporal vintage tie-breaking
// =============================================================================

test(
    "newer dated boundary vintage outranks older dated boundary vintage",
    () => {

        const older =
            scoreCandidate(
                createCandidate(
                    undefined,
                    "https://example.com/a/FeatureServer/0",
                    "Tucson Ward Boundaries 2015"
                )
            );

        const newer =
            scoreCandidate(
                createCandidate(
                    undefined,
                    "https://example.com/b/FeatureServer/0",
                    "Tucson Ward Boundaries 2022"
                )
            );

        assert.equal(
            validateTemporal(
                older.candidate.inspection
            ).status,
            "dated"
        );

        assert.equal(
            validateTemporal(
                newer.candidate.inspection
            ).status,
            "dated"
        );

        const ranked =
            [
                older,
                newer
            ].sort(
                compareCandidateScores
            );

        assert.equal(
            ranked[0]
                .candidate
                .inspection
                .title,
            "Tucson Ward Boundaries 2022"
        );

        assert.equal(
            ranked[1]
                .candidate
                .inspection
                .title,
            "Tucson Ward Boundaries 2015"
        );
    }
);


test(
    "newer completed boundary range outranks older completed boundary range",
    () => {

        const older =
            scoreCandidate(
                createCandidate(
                    undefined,
                    "https://example.com/a/FeatureServer/0",
                    "Tucson Ward Boundaries 2010-2018"
                )
            );

        const newer =
            scoreCandidate(
                createCandidate(
                    undefined,
                    "https://example.com/b/FeatureServer/0",
                    "Tucson Ward Boundaries 2015-2023"
                )
            );

        assert.equal(
            validateTemporal(
                older.candidate.inspection
            ).status,
            "dated"
        );

        assert.equal(
            validateTemporal(
                newer.candidate.inspection
            ).status,
            "dated"
        );

        const ranked =
            [
                older,
                newer
            ].sort(
                compareCandidateScores
            );

        assert.equal(
            ranked[0]
                .candidate
                .inspection
                .title,
            "Tucson Ward Boundaries 2015-2023"
        );

        assert.equal(
            ranked[1]
                .candidate
                .inspection
                .title,
            "Tucson Ward Boundaries 2010-2018"
        );
    }
);


// =============================================================================
// Explicit historical semantics
// =============================================================================

test(
    "historical language overrides a merely old boundary year",
    () => {

        const result =
            scoreCandidate(
                createCandidate(
                    undefined,
                    "https://example.com/a/FeatureServer/0",
                    "Archived historical Tucson Ward Boundaries 2015"
                )
            );

        const temporal =
            validateTemporal(
                result.candidate.inspection
            );

        assert.equal(
            temporal.status,
            "historical"
        );

        assert.equal(
            temporal.year,
            2015
        );

        assert.ok(
            result.reasons.includes(
                "-60 temporal status: historical"
            )
        );
    }
);


// =============================================================================
// Current/open-ended boundary ranges
// =============================================================================

test(
    "a current-year open-ended boundary range is current",
    () => {

        const currentYear =
            new Date().getFullYear();

        const result =
            scoreCandidate(
                createCandidate(
                    undefined,
                    "https://example.com/a/FeatureServer/0",
                    `Tucson Ward Boundaries ${currentYear}-`
                )
            );

        const temporal =
            validateTemporal(
                result.candidate.inspection
            );

        assert.equal(
            temporal.status,
            "current"
        );

        assert.equal(
            temporal.year,
            currentYear
        );

        assert.ok(
            result.reasons.includes(
                "+20 temporal status: current"
            )
        );

        assert.ok(
            result.reasons.includes(
                `temporal vintage year: ${currentYear}`
            )
        );
    }
);


test(
    "a past open-ended range explicitly ending in present is current",
    () => {

        const currentYear =
            new Date().getFullYear();

        const startYear =
            currentYear - 2;

        const result =
            scoreCandidate(
                createCandidate(
                    undefined,
                    "https://example.com/a/FeatureServer/0",
                    `Tucson Ward Boundaries ${startYear}-present`
                )
            );

        const temporal =
            validateTemporal(
                result.candidate.inspection
            );

        assert.equal(
            temporal.status,
            "current"
        );

        assert.equal(
            temporal.startYear,
            startYear
        );

        assert.ok(
            result.reasons.includes(
                "+20 temporal status: current"
            )
        );

        assert.ok(
            result.reasons.includes(
                `temporal vintage year: ${startYear}`
            )
        );
    }
);


// =============================================================================
// Temporal ranking must use inspection evidence
// =============================================================================

test(
    "temporal ranking uses inspection evidence rather than classification temporal status",
    () => {

        const candidate =
            createCandidate(
                undefined,
                "https://example.com/a/FeatureServer/0",
                "Current Tucson Ward Boundaries"
            );

        /*
         * The fixture deliberately leaves classification.temporalStatus
         * as "undated". This verifies that ranking does not depend on
         * stale classification metadata.
         */
        assert.equal(
            candidate.classification.temporalStatus,
            "undated"
        );

        const temporal =
            validateTemporal(
                candidate.inspection
            );

        assert.equal(
            temporal.status,
            "current"
        );

        const result =
            scoreCandidate(
                candidate
            );

        assert.ok(
            result.reasons.includes(
                "+20 temporal status: current"
            )
        );
    }
);


// =============================================================================
// Temporal tie-breaking with equal scores
// =============================================================================

test(
    "compareCandidateScores prefers current temporal status when total scores tie",
    () => {

        const dated =
            scoreCandidate(
                createCandidate(
                    undefined,
                    "https://example.com/a/FeatureServer/0",
                    "Tucson Ward Boundaries 2022"
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

        /*
         * Construct equivalent scores manually so that this test
         * isolates the temporal tie-breaker rather than the temporal
         * score itself.
         */
        const datedTie = {
            ...dated,
            score: 100
        };

        const currentTie = {
            ...current,
            score: 100
        };

        assert.ok(
            compareCandidateScores(
                currentTie,
                datedTie
            ) < 0
        );

        assert.ok(
            compareCandidateScores(
                datedTie,
                currentTie
            ) > 0
        );
    }
);


// =============================================================================
// Deterministic tie-breaking
// =============================================================================

test(
    "URL provides deterministic final tie-breaker",
    () => {

        const a =
            scoreCandidate(
                createCandidate(
                    undefined,
                    "https://example.com/a/FeatureServer/0",
                    "Tucson Ward Boundaries"
                )
            );

        const b =
            scoreCandidate(
                createCandidate(
                    undefined,
                    "https://example.com/b/FeatureServer/0",
                    "Tucson Ward Boundaries"
                )
            );

        /*
         * Equalize scores so that only the final URL tie-breaker
         * determines the ordering.
         */
        const aTie = {
            ...a,
            score: 100
        };

        const bTie = {
            ...b,
            score: 100
        };

        const ranked =
            [
                bTie,
                aTie
            ].sort(
                compareCandidateScores
            );

        assert.equal(
            ranked[0]
                .candidate
                .inspection
                .url,
            "https://example.com/a/FeatureServer/0"
        );

        assert.equal(
            ranked[1]
                .candidate
                .inspection
                .url,
            "https://example.com/b/FeatureServer/0"
        );
    }
);