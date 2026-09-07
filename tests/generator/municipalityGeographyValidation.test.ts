import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import type {
    Polygon
} from "geojson";

import {
    validateMunicipalityGeography
} from "../../generator/src/municipalityGeographyValidation.js";

import type {
    CensusPlace
} from "../../generator/src/types.js";


// =============================================================================
// Helpers
// =============================================================================

function square(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number
): Polygon {

    return {

        type:
            "Polygon",

        coordinates: [[
            [minX, minY],
            [maxX, minY],
            [maxX, maxY],
            [minX, maxY],
            [minX, minY]
        ]]
    };
}


function createGeometryDirectory(
    municipality:
        Polygon
): string {

    const directory =
        fs.mkdtempSync(
            path.join(
                os.tmpdir(),
                "municipality-geography-test-"
            )
        );

    const geometries = {

        "0400001":
            municipality
    };

    fs.writeFileSync(
        path.join(
            directory,
            "04.json"
        ),

        JSON.stringify({
            state:
                "Arizona",

            stateFips:
                "04",

            vintage:
                "2025",

            source:
                "test",

            geometries
        }),

        "utf8"
    );

    return directory;
}


function testPlace(): CensusPlace {

    return {

        placeFips:
            "0400001",

        city:
            "Test City",

        state:
            "AZ"
    };
}


// =============================================================================
// Tests
// =============================================================================

test(
    "strongly matches a candidate covering the municipality",
    () => {

        const municipality =
            square(
                0,
                0,
                10,
                10
            );

        const directory =
            createGeometryDirectory(
                municipality
            );

        const result =
            validateMunicipalityGeography(
                [
                    municipality
                ],
                testPlace(),
                directory
            );

        assert.equal(
            result.status,
            "strong-match",
            result.reasons.join("\n")
        );

        assert.equal(
            result.likelyMunicipalityMatch,
            true
        );

        assert.ok(
            result.coverageOfMunicipality >
            0.99
        );

        assert.ok(
            result.candidateInsideMunicipality >
            0.99
        );

        assert.equal(
            result.candidateFeatureCount,
            1
        );
    }
);


test(
    "recognizes a probable geographic match",
    () => {

        const municipality =
            square(
                0,
                0,
                10,
                10
            );

        const candidate =
            square(
                0,
                0,
                8,
                10
            );

        const directory =
            createGeometryDirectory(
                municipality
            );

        const result =
            validateMunicipalityGeography(
                [
                    candidate
                ],
                testPlace(),
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

        assert.ok(
            result.coverageOfMunicipality >
            0.79
        );
    }
);


test(
    "recognizes a weak geographic match",
    () => {

        const municipality =
            square(
                0,
                0,
                10,
                10
            );

        const candidate =
            square(
                0,
                0,
                5,
                5
            );

        const directory =
            createGeometryDirectory(
                municipality
            );

        const result =
            validateMunicipalityGeography(
                [
                    candidate
                ],
                testPlace(),
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
    }
);


test(
    "rejects a geographically unrelated candidate",
    () => {

        const municipality =
            square(
                0,
                0,
                10,
                10
            );

        const candidate =
            square(
                20,
                20,
                30,
                30
            );

        const directory =
            createGeometryDirectory(
                municipality
            );

        const result =
            validateMunicipalityGeography(
                [
                    candidate
                ],
                testPlace(),
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

        assert.equal(
            result.intersectionArea,
            0
        );
    }
);


test(
    "unions overlapping candidate features before calculating coverage",
    () => {

        const municipality =
            square(
                0,
                0,
                10,
                10
            );

        const candidate1 =
            square(
                0,
                0,
                6,
                10
            );

        const candidate2 =
            square(
                4,
                0,
                10,
                10
            );

        const directory =
            createGeometryDirectory(
                municipality
            );

        const result =
            validateMunicipalityGeography(
                [
                    candidate1,
                    candidate2
                ],
                testPlace(),
                directory
            );

        assert.ok(
            result.coverageOfMunicipality >
            0.99
        );

        assert.ok(
            result.candidateInsideMunicipality >
            0.99
        );

        assert.equal(
            result.candidateFeatureCount,
            2
        );

        assert.equal(
            result.validCandidateFeatureCount,
            2
        );
    }
);


test(
    "returns invalid when no candidate geometries are supplied",
    () => {

        const municipality =
            square(
                0,
                0,
                10,
                10
            );

        const directory =
            createGeometryDirectory(
                municipality
            );

        const result =
            validateMunicipalityGeography(
                [],
                testPlace(),
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
    }
);


test(
    "returns invalid when Census geometry is unavailable",
    () => {

        const directory =
            fs.mkdtempSync(
                path.join(
                    os.tmpdir(),
                    "municipality-geography-missing-"
                )
            );

        const result =
            validateMunicipalityGeography(
                [
                    square(
                        0,
                        0,
                        10,
                        10
                    )
                ],
                testPlace(),
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
    }
);