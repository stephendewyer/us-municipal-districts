import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import type {
    MultiPolygon,
    Polygon
} from "geojson";

import {
    validateMunicipalityGeography,
    GEOGRAPHY_STRONG_COVERAGE,
    GEOGRAPHY_PROBABLE_COVERAGE,
    GEOGRAPHY_WEAK_COVERAGE
} from "../../generator/src/validateMunicipalityGeography.js";

import type {
    CensusPlace
} from "../../generator/src/types.js";


// =============================================================================
// Test constants
// =============================================================================

const TEST_PLACE_FIPS =
    "0123456";

const TEST_STATE_FIPS =
    "01";

const TEST_STATE =
    "Test State";

const TEST_CITY =
    "Test City";


// =============================================================================
// Test municipality
// =============================================================================

/*
 * The Census municipality used throughout these tests is a
 * simple 10 x 10 square.
 *
 * Coordinates are intentionally simple because the validator
 * only needs geometrically controlled test data.
 */
const MUNICIPALITY: Polygon = {
    type: "Polygon",
    coordinates: [
        [
            [0, 0],
            [10, 0],
            [10, 10],
            [0, 10],
            [0, 0]
        ]
    ]
};


// =============================================================================
// Test Census place
// =============================================================================

const PLACE:
    CensusPlace = {

    placeFips:
        TEST_PLACE_FIPS,

    city:
        TEST_CITY,

    state:
        "TS" as CensusPlace["state"],

    stateFips:
        TEST_STATE_FIPS,

    placeName:
        TEST_CITY,

    placeType:
        "incorporated-place"
};


// =============================================================================
// Test helpers
// =============================================================================

/*
 * Accepts a single GeoJSON linear ring and wraps it in the
 * additional array required by Polygon.coordinates.
 *
 * Input:
 *
 *     number[][]
 *
 * Output:
 *
 *     Polygon
 *
 * GeoJSON Polygon.coordinates has the shape:
 *
 *     number[][][]
 */
function polygon(
    coordinates:
        number[][]
): Polygon {

    return {

        type:
            "Polygon",

        coordinates: [
            coordinates
        ]
    };
}


/*
 * MultiPolygon.coordinates has the shape:
 *
 *     number[][][][]
 */
function multiPolygon(
    polygons:
        number[][][][]
): MultiPolygon {

    return {

        type:
            "MultiPolygon",

        coordinates:
            polygons
    };
}


function assertApproximately(
    actual: number,
    expected: number,
    tolerance = 0.0001
): void {

    assert.ok(
        Math.abs(
            actual - expected
        ) <= tolerance,

        [
            `Expected ${actual}`,
            `to be approximately ${expected}`,
            `(tolerance ${tolerance}).`
        ].join(" ")
    );
}


async function createGeometryDirectory():
    Promise<string> {

    const directory =
        await fs.mkdtemp(
            path.join(
                os.tmpdir(),
                "municipality-geography-test-"
            )
        );


    const stateGeometry = {

        state:
            TEST_STATE,

        stateFips:
            TEST_STATE_FIPS,

        vintage:
            2025,

        source:
            "Test Census geometry source",

        geometries: {

            [TEST_PLACE_FIPS]:
                MUNICIPALITY
        }
    };


    await fs.writeFile(

        path.join(
            directory,
            `${TEST_STATE_FIPS}.json`
        ),

        JSON.stringify(
            stateGeometry,
            null,
            2
        ),

        "utf8"
    );


    return directory;
}


async function removeGeometryDirectory(
    directory: string
): Promise<void> {

    await fs.rm(
        directory,
        {
            recursive: true,
            force: true
        }
    );
}


// =============================================================================
// Basic strong match
// =============================================================================

test(
    "returns a strong match when candidate exactly matches municipality",
    async () => {
        
        const directory =
            await createGeometryDirectory();


        try {

            const result =
                validateMunicipalityGeography(
                    [
                        MUNICIPALITY
                    ],
                    PLACE,
                    directory
                );

            console.log("GEOGRAPHY RESULT:", result);
            assert.equal(
                result.status,
                "strong-match"
            );


            assert.equal(
                result.likelyMunicipalityMatch,
                true
            );


            assertApproximately(
                result.coverageOfMunicipality,
                1
            );


            assertApproximately(
                result.candidateInsideMunicipality,
                1
            );


            assertApproximately(
                result.municipalityArea,
                result.candidateArea,
                1
            );


            assertApproximately(
                result.intersectionArea,
                result.municipalityArea,
                1
            );


            assert.equal(
                result.candidateFeatureCount,
                1
            );


            assert.equal(
                result.validCandidateFeatureCount,
                1
            );


            assert.equal(
                result.score,
                100
            );


            assert.ok(
                result.reasons.some(
                    reason =>
                        reason.includes(
                            "strong geographic match"
                        )
                )
            );

        } finally {

            await removeGeometryDirectory(
                directory
            );
        }
    }
);


// =============================================================================
// Probable match
// =============================================================================

test(
    "returns a probable match when candidate covers at least 60 percent of municipality",
    async () => {

        const directory =
            await createGeometryDirectory();


        try {

            /*
             * 8 x 8 = 64 square units.
             *
             * Municipality = 10 x 10 = 100 square units.
             *
             * Coverage = 64%.
             *
             * Candidate is entirely inside municipality.
             */
            const candidate: Polygon = {
                type: "Polygon",
                coordinates: [
                    [
                        [0, 0],
                        [8, 0],
                        [8, 8],
                        [0, 8],
                        [0, 0]
                    ]
                ]
            };


            const result =
                validateMunicipalityGeography(
                    [
                        candidate
                    ],
                    PLACE,
                    directory
                );


            assert.equal(
                result.status,
                "probable-match"
            );


            assert.equal(
                result.likelyMunicipalityMatch,
                true
            );


            assertApproximately(
                result.coverageOfMunicipality,
                0.64,
                0.01
            );


            assertApproximately(
                result.candidateInsideMunicipality,
                1,
                0.01
            );


            assert.ok(
                result.score >= 60
            );


            assert.ok(
                result.reasons.some(
                    reason =>
                        reason.includes(
                            "probable geographic match"
                        )
                )
            );

        } finally {

            await removeGeometryDirectory(
                directory
            );
        }
    }
);


// =============================================================================
// Weak match
// =============================================================================

test(
    "returns weak match when candidate covers only 20 to 60 percent of municipality",
    async () => {

        const directory =
            await createGeometryDirectory();


        try {

            /*
             * 5 x 5 = 25 square units.
             *
             * Municipality = 100 square units.
             *
             * Coverage = 25%.
             *
             * Candidate is completely inside municipality.
             *
             * The diagnostic score is:
             *
             *   25 points for weak coverage
             *   30 points for >= 90% containment
             *   = 55
             *
             * This is intentionally important:
             *
             * A score of 55 must NOT make this a likely
             * municipality match.
             */
            const candidate =
                polygon(
                    [
                        [0, 0],
                        [5, 0],
                        [5, 5],
                        [0, 5],
                        [0, 0]
                    ]
                );


            const result =
                validateMunicipalityGeography(
                    [
                        candidate
                    ],
                    PLACE,
                    directory
                );


            assert.equal(
                result.status,
                "weak-match"
            );


            assert.equal(
                result.likelyMunicipalityMatch,
                false
            );


            assertApproximately(
                result.coverageOfMunicipality,
                0.25,
                0.01
            );


            assertApproximately(
                result.candidateInsideMunicipality,
                1,
                0.01
            );


            assert.equal(
                result.score,
                55
            );


            assert.ok(
                result.reasons.some(
                    reason =>
                        reason.includes(
                            "weak geographic match"
                        )
                )
            );


            assert.ok(
                result.reasons.some(
                    reason =>
                        reason.includes(
                            "insufficient for eligibility"
                        )
                )
            );

        } finally {

            await removeGeometryDirectory(
                directory
            );
        }
    }
);


// =============================================================================
// No match
// =============================================================================

test(
    "returns no-match when candidate does not overlap municipality",
    async () => {

        const directory =
            await createGeometryDirectory();


        try {

            const candidate =
                polygon(
                    [
                        [20, 20],
                        [25, 20],
                        [25, 25],
                        [20, 25],
                        [20, 20]
                    ]
                );


            const result =
                validateMunicipalityGeography(
                    [
                        candidate
                    ],
                    PLACE,
                    directory
                );


            assert.equal(
                result.status,
                "no-match"
            );


            assert.equal(
                result.likelyMunicipalityMatch,
                false
            );


            assertApproximately(
                result.coverageOfMunicipality,
                0
            );


            assertApproximately(
                result.candidateInsideMunicipality,
                0
            );


            assertApproximately(
                result.intersectionArea,
                0
            );


            assert.equal(
                result.score,
                0
            );

        } finally {

            await removeGeometryDirectory(
                directory
            );
        }
    }
);


// =============================================================================
// Mostly outside municipality
// =============================================================================

test(
    "returns no-match when candidate overlaps only a small portion of municipality",
    async () => {

        const directory =
            await createGeometryDirectory();


        try {

            /*
             * Candidate is 10 x 10, but only its lower-left
             * 2 x 2 corner overlaps the municipality.
             *
             * Municipality coverage = 4%.
             * Candidate containment = 4%.
             */
            const candidate =
                polygon(
                    [
                        [8, 8],
                        [18, 8],
                        [18, 18],
                        [8, 18],
                        [8, 8]
                    ]
                );


            const result =
                validateMunicipalityGeography(
                    [
                        candidate
                    ],
                    PLACE,
                    directory
                );


            assert.equal(
                result.status,
                "no-match"
            );


            assert.equal(
                result.likelyMunicipalityMatch,
                false
            );


            assertApproximately(
                result.coverageOfMunicipality,
                0.04,
                0.01
            );


            assertApproximately(
                result.candidateInsideMunicipality,
                0.04,
                0.01
            );


            assert.ok(
                result.score < 25
            );

        } finally {

            await removeGeometryDirectory(
                directory
            );
        }
    }
);


// =============================================================================
// Multiple candidate polygons
// =============================================================================

test(
    "unions multiple candidate polygons before calculating coverage",
    async () => {

        const directory =
            await createGeometryDirectory();


        try {

            /*
             * Two 5 x 10 rectangles together cover the
             * entire 10 x 10 municipality.
             */
            const left =
                polygon(
                    [
                        [0, 0],
                        [5, 0],
                        [5, 10],
                        [0, 10],
                        [0, 0]
                    ]
                );


            const right =
                polygon(
                    [
                        [5, 0],
                        [10, 0],
                        [10, 10],
                        [5, 10],
                        [5, 0]
                    ]
                );


            const result =
                validateMunicipalityGeography(
                    [
                        left,
                        right
                    ],
                    PLACE,
                    directory
                );


            assert.equal(
                result.status,
                "strong-match"
            );


            assert.equal(
                result.likelyMunicipalityMatch,
                true
            );


            assertApproximately(
                result.coverageOfMunicipality,
                1,
                0.01
            );


            assertApproximately(
                result.candidateInsideMunicipality,
                1,
                0.01
            );


            assertApproximately(
                result.candidateArea,
                result.municipalityArea,
                1
            );


            assert.equal(
                result.candidateFeatureCount,
                2
            );


            assert.equal(
                result.validCandidateFeatureCount,
                2
            );


            assert.equal(
                result.score,
                100
            );

        } finally {

            await removeGeometryDirectory(
                directory
            );
        }
    }
);


// =============================================================================
// MultiPolygon candidate
// =============================================================================

test(
    "accepts a MultiPolygon candidate",
    async () => {

        const directory =
            await createGeometryDirectory();


        try {

            const candidate =
                multiPolygon(
                    [
                        [
                            [
                                [0, 0],
                                [5, 0],
                                [5, 10],
                                [0, 10],
                                [0, 0]
                            ]
                        ],
                        [
                            [
                                [5, 0],
                                [10, 0],
                                [10, 10],
                                [5, 10],
                                [5, 0]
                            ]
                        ]
                    ]
                );


            const result =
                validateMunicipalityGeography(
                    [
                        candidate
                    ],
                    PLACE,
                    directory
                );


            assert.equal(
                result.status,
                "strong-match"
            );


            assert.equal(
                result.likelyMunicipalityMatch,
                true
            );


            assertApproximately(
                result.coverageOfMunicipality,
                1,
                0.01
            );


            assertApproximately(
                result.candidateInsideMunicipality,
                1,
                0.01
            );


            assert.equal(
                result.candidateFeatureCount,
                1
            );


            assert.equal(
                result.validCandidateFeatureCount,
                1
            );

        } finally {

            await removeGeometryDirectory(
                directory
            );
        }
    }
);


// =============================================================================
// Zero-area candidate
// =============================================================================

test(
    "ignores zero-area candidate geometries when valid candidates are present",
    async () => {

        const directory =
            await createGeometryDirectory();


        try {

            /*
             * This polygon is degenerate because all of its
             * points lie on a straight line.
             */
            const zeroAreaCandidate =
                polygon(
                    [
                        [0, 0],
                        [5, 0],
                        [10, 0],
                        [0, 0]
                    ]
                );


            const result =
                validateMunicipalityGeography(
                    [
                        zeroAreaCandidate,
                        MUNICIPALITY
                    ],
                    PLACE,
                    directory
                );


            assert.equal(
                result.status,
                "strong-match"
            );


            assert.equal(
                result.likelyMunicipalityMatch,
                true
            );


            assert.equal(
                result.candidateFeatureCount,
                2
            );


            assert.equal(
                result.validCandidateFeatureCount,
                1
            );


            assertApproximately(
                result.coverageOfMunicipality,
                1,
                0.01
            );

        } finally {

            await removeGeometryDirectory(
                directory
            );
        }
    }
);


// =============================================================================
// All zero-area candidates
// =============================================================================

test(
    "returns invalid when all candidate geometries have zero area",
    async () => {

        const directory =
            await createGeometryDirectory();


        try {

            const zeroAreaCandidate =
                polygon(
                    [
                        [0, 0],
                        [5, 0],
                        [10, 0],
                        [0, 0]
                    ]
                );


            const result =
                validateMunicipalityGeography(
                    [
                        zeroAreaCandidate
                    ],
                    PLACE,
                    directory
                );


            assert.equal(
                result.status,
                "invalid"
            );


            assert.equal(
                result.likelyMunicipalityMatch,
                false
            );


            assert.equal(
                result.score,
                0
            );


            assert.equal(
                result.candidateFeatureCount,
                1
            );


            assert.equal(
                result.validCandidateFeatureCount,
                0
            );


            assert.ok(
                result.reasons.some(
                    reason =>
                        reason.includes(
                            "valid positive area"
                        )
                )
            );

        } finally {

            await removeGeometryDirectory(
                directory
            );
        }
    }
);


// =============================================================================
// Empty candidates
// =============================================================================

test(
    "returns invalid when no candidate geometries are supplied",
    async () => {

        const directory =
            await createGeometryDirectory();


        try {

            const result =
                validateMunicipalityGeography(
                    [],
                    PLACE,
                    directory
                );


            assert.equal(
                result.status,
                "invalid"
            );


            assert.equal(
                result.likelyMunicipalityMatch,
                false
            );


            assert.equal(
                result.score,
                0
            );


            assert.equal(
                result.candidateFeatureCount,
                0
            );


            assert.equal(
                result.validCandidateFeatureCount,
                0
            );


            assert.equal(
                result.municipalityArea,
                0
            );


            assert.equal(
                result.candidateArea,
                0
            );


            assert.equal(
                result.intersectionArea,
                0
            );

        } finally {

            await removeGeometryDirectory(
                directory
            );
        }
    }
);


// =============================================================================
// Missing Census geometry
// =============================================================================

test(
    "returns invalid when Census municipality geometry cannot be loaded",
    async () => {

        const directory =
            await fs.mkdtemp(
                path.join(
                    os.tmpdir(),
                    "municipality-geography-missing-"
                )
            );


        try {

            const result =
                validateMunicipalityGeography(
                    [
                        MUNICIPALITY
                    ],
                    PLACE,
                    directory
                );


            assert.equal(
                result.status,
                "invalid"
            );


            assert.equal(
                result.likelyMunicipalityMatch,
                false
            );


            assert.equal(
                result.score,
                0
            );


            assert.ok(
                result.reasons.some(
                    reason =>
                        reason.includes(
                            "Failed to load Census municipality geometry"
                        )
                )
            );

        } finally {

            await removeGeometryDirectory(
                directory
            );
        }
    }
);


// =============================================================================
// Threshold constants
// =============================================================================

test(
    "uses the expected geographic coverage thresholds",
    () => {

        assert.equal(
            GEOGRAPHY_STRONG_COVERAGE,
            0.90
        );


        assert.equal(
            GEOGRAPHY_PROBABLE_COVERAGE,
            0.60
        );


        assert.equal(
            GEOGRAPHY_WEAK_COVERAGE,
            0.20
        );
    }
);


// =============================================================================
// Boundary behavior: exactly 90 percent
// =============================================================================

test(
    "treats exactly 90 percent municipality coverage as strong when containment is sufficient",
    async () => {

        const directory =
            await createGeometryDirectory();


        try {

            /*
             * 9 x 10 = 90 square units.
             */
            const candidate =
                polygon(
                    [
                        [0, 0],
                        [9, 0],
                        [9, 10],
                        [0, 10],
                        [0, 0]
                    ]
                );


            const result =
                validateMunicipalityGeography(
                    [
                        candidate
                    ],
                    PLACE,
                    directory
                );


            assertApproximately(
                result.coverageOfMunicipality,
                GEOGRAPHY_STRONG_COVERAGE,
                0.01
            );


            assert.equal(
                result.status,
                "strong-match"
            );


            assert.equal(
                result.likelyMunicipalityMatch,
                true
            );

        } finally {

            await removeGeometryDirectory(
                directory
            );
        }
    }
);


// =============================================================================
// Boundary behavior: exactly 60 percent
// =============================================================================

test(
    "treats exactly 60 percent municipality coverage as probable when containment is sufficient",
    async () => {

        const directory =
            await createGeometryDirectory();


        try {

            /*
             * 6 x 10 = 60 square units.
             */
            const candidate =
                polygon(
                    [
                        [0, 0],
                        [6, 0],
                        [6, 10],
                        [0, 10],
                        [0, 0]
                    ]
                );


            const result =
                validateMunicipalityGeography(
                    [
                        candidate
                    ],
                    PLACE,
                    directory
                );


            assertApproximately(
                result.coverageOfMunicipality,
                GEOGRAPHY_PROBABLE_COVERAGE,
                0.01
            );


            assert.equal(
                result.status,
                "probable-match"
            );


            assert.equal(
                result.likelyMunicipalityMatch,
                true
            );

        } finally {

            await removeGeometryDirectory(
                directory
            );
        }
    }
);


// =============================================================================
// Boundary behavior: exactly 20 percent
// =============================================================================

test(
    "treats exactly 20 percent municipality coverage as weak",
    async () => {

        const directory =
            await createGeometryDirectory();


        try {

            /*
             * 2 x 10 = 20 square units.
             */
            const candidate =
                polygon(
                    [
                        [0, 0],
                        [2, 0],
                        [2, 10],
                        [0, 10],
                        [0, 0]
                    ]
                );


            const result =
                validateMunicipalityGeography(
                    [
                        candidate
                    ],
                    PLACE,
                    directory
                );


            assertApproximately(
                result.coverageOfMunicipality,
                GEOGRAPHY_WEAK_COVERAGE,
                0.01
            );


            assert.equal(
                result.status,
                "weak-match"
            );


            assert.equal(
                result.likelyMunicipalityMatch,
                false
            );

        } finally {

            await removeGeometryDirectory(
                directory
            );
        }
    }
);


// =============================================================================
// Candidate extending outside municipality
// =============================================================================

test(
    "does not classify a large mostly-outside candidate as a probable match",
    async () => {

        const directory =
            await createGeometryDirectory();


        try {

            /*
             * Candidate:
             *
             * x = -2..10
             * y = 0..10
             *
             * Candidate area = 120.
             * Intersection = 100.
             *
             * Municipality coverage = 100%.
             * Candidate containment = 83.3%.
             *
             * This should still qualify as strong because the
             * municipality is completely covered and most of the
             * candidate is inside the municipality.
             */
            const candidate =
                polygon(
                    [
                        [-2, 0],
                        [10, 0],
                        [10, 10],
                        [-2, 10],
                        [-2, 0]
                    ]
                );


            const result =
                validateMunicipalityGeography(
                    [
                        candidate
                    ],
                    PLACE,
                    directory
                );


            assert.equal(
                result.status,
                "strong-match"
            );


            assert.equal(
                result.likelyMunicipalityMatch,
                true
            );


            assertApproximately(
                result.coverageOfMunicipality,
                1,
                0.01
            );


            assertApproximately(
                result.candidateInsideMunicipality,
                100 / 120,
                0.01
            );

        } finally {

            await removeGeometryDirectory(
                directory
            );
        }
    }
);


// =============================================================================
// Candidate with substantial outside area
// =============================================================================

test(
    "requires sufficient candidate containment for strong and probable matches",
    async () => {

        const directory =
            await createGeometryDirectory();


        try {

            /*
             * Candidate:
             *
             * x = -10..10
             * y = 0..10
             *
             * Candidate area = 200.
             * Intersection = 100.
             *
             * Municipality coverage = 100%.
             * Candidate containment = 50%.
             *
             * This does NOT satisfy the strong-match containment
             * requirement of 60%.
             *
             * It does satisfy the probable-match containment
             * requirement of 40%, so this should be probable.
             */
            const candidate =
                polygon(
                    [
                        [-10, 0],
                        [10, 0],
                        [10, 10],
                        [-10, 10],
                        [-10, 0]
                    ]
                );


            const result =
                validateMunicipalityGeography(
                    [
                        candidate
                    ],
                    PLACE,
                    directory
                );


            assert.equal(
                result.status,
                "probable-match"
            );


            assert.equal(
                result.likelyMunicipalityMatch,
                true
            );


            assertApproximately(
                result.coverageOfMunicipality,
                1,
                0.01
            );


            assertApproximately(
                result.candidateInsideMunicipality,
                0.50,
                0.01
            );

        } finally {

            await removeGeometryDirectory(
                directory
            );
        }
    }
);


// =============================================================================
// Reasons
// =============================================================================

test(
    "includes useful geographic diagnostics in reasons",
    async () => {

        const directory =
            await createGeometryDirectory();


        try {

            const result =
                validateMunicipalityGeography(
                    [
                        MUNICIPALITY
                    ],
                    PLACE,
                    directory
                );


            assert.ok(
                result.reasons.length > 0
            );


            assert.ok(
                result.reasons.some(
                    reason =>
                        reason.includes(
                            "candidate geometries"
                        )
                )
            );


            assert.ok(
                result.reasons.some(
                    reason =>
                        reason.includes(
                            "municipality area"
                        )
                )
            );


            assert.ok(
                result.reasons.some(
                    reason =>
                        reason.includes(
                            "candidate area"
                        )
                )
            );


            assert.ok(
                result.reasons.some(
                    reason =>
                        reason.includes(
                            "intersection area"
                        )
                )
            );


            assert.ok(
                result.reasons.some(
                    reason =>
                        reason.includes(
                            "municipality coverage"
                        )
                )
            );


            assert.ok(
                result.reasons.some(
                    reason =>
                        reason.includes(
                            "candidate inside municipality"
                        )
                )
            );

        } finally {

            await removeGeometryDirectory(
                directory
            );
        }
    }
);