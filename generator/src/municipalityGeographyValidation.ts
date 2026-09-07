import {
    area,
    feature,
    featureCollection,
    intersect,
    union
} from "@turf/turf";

import type {
    Feature,
    MultiPolygon,
    Polygon
} from "geojson";

import {
    loadCensusPlaceGeometry
} from "./censusPlaceGeometry.js";

import type {
    CensusPlace
} from "./types.js";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type MunicipalityGeographyValidationStatus =
    | "strong-match"
    | "probable-match"
    | "weak-match"
    | "no-match"
    | "invalid";

export interface MunicipalityGeographyValidation {
    status:
        MunicipalityGeographyValidationStatus;

    score:
        number;

    likelyMunicipalityMatch:
        boolean;

    municipalityArea:
        number;

    candidateArea:
        number;

    intersectionArea:
        number;

    coverageOfMunicipality:
        number;

    candidateInsideMunicipality:
        number;

    candidateFeatureCount:
        number;

    validCandidateFeatureCount:
        number;

    reasons:
        string[];
}

// -----------------------------------------------------------------------------
// Thresholds
// -----------------------------------------------------------------------------

export const GEOGRAPHY_STRONG_COVERAGE = 0.90;

export const GEOGRAPHY_PROBABLE_COVERAGE = 0.60;

export const GEOGRAPHY_WEAK_COVERAGE = 0.20;

export const GEOGRAPHY_VALIDATION_THRESHOLD = 60;

// -----------------------------------------------------------------------------
// Main validation function
// -----------------------------------------------------------------------------

export function validateMunicipalityGeography(
    candidateGeometries:
        Array<Polygon | MultiPolygon>,

    place:
        CensusPlace,

    geometryDirectory?:
        string
): MunicipalityGeographyValidation {

    const reasons: string[] = [];

    // -------------------------------------------------------------------------
    // 1. Candidate validation
    // -------------------------------------------------------------------------

    if (
        candidateGeometries.length === 0
    ) {
        return invalidResult(
            0,
            [
                "no candidate geometries were provided"
            ]
        );
    }

    // -------------------------------------------------------------------------
    // 2. Load Census municipality geometry
    // -------------------------------------------------------------------------

    let municipalityGeometry:
        Polygon | MultiPolygon;

    try {

        municipalityGeometry =
            loadCensusPlaceGeometry(
                place.placeFips,
                geometryDirectory
            );

    } catch (error) {

        return invalidResult(
            candidateGeometries.length,
            [
                "failed to load Census municipality geometry",

                error instanceof Error
                    ? error.message
                    : String(error)
            ]
        );
    }

    // -------------------------------------------------------------------------
    // 3. Convert geometries to Turf features
    // -------------------------------------------------------------------------

    const municipalityFeature:
        Feature<Polygon | MultiPolygon> =
        feature(
            municipalityGeometry
        );

    const candidateFeatures:
        Feature<Polygon | MultiPolygon>[] =
        candidateGeometries.map(
            geometry =>
                feature(
                    geometry
                )
        );

    // -------------------------------------------------------------------------
    // 4. Remove zero-area candidate geometries
    // -------------------------------------------------------------------------

    const validCandidateFeatures =
        candidateFeatures.filter(
            candidate =>
                area(candidate) > 0
        );

    if (
        validCandidateFeatures.length === 0
    ) {
        return invalidResult(
            candidateGeometries.length,
            [
                "candidate geometries have zero measurable area"
            ]
        );
    }

    // -------------------------------------------------------------------------
    // 5. Calculate municipality area
    // -------------------------------------------------------------------------

    let municipalityArea: number;

    try {

        municipalityArea =
            area(
                municipalityFeature
            );

    } catch (error) {

        return invalidResult(
            candidateGeometries.length,
            [
                "failed to calculate Census municipality area",

                error instanceof Error
                    ? error.message
                    : String(error)
            ]
        );
    }

    // -------------------------------------------------------------------------
    // 6. Union candidate geometries
    // -------------------------------------------------------------------------

    let candidateUnion:
        Feature<Polygon | MultiPolygon>;

    try {

        candidateUnion =
            unionCandidateFeatures(
                validCandidateFeatures
            );

    } catch (error) {

        return invalidResult(
            candidateGeometries.length,
            [
                "Turf union failed",

                error instanceof Error
                    ? error.message
                    : String(error)
            ]
        );
    }

    // -------------------------------------------------------------------------
    // 7. Calculate candidate area
    // -------------------------------------------------------------------------

    let candidateArea: number;

    try {

        candidateArea =
            area(
                candidateUnion
            );

    } catch (error) {

        return invalidResult(
            candidateGeometries.length,
            [
                "failed to calculate candidate geometry area",

                error instanceof Error
                    ? error.message
                    : String(error)
            ]
        );
    }

    // -------------------------------------------------------------------------
    // 8. Validate calculated areas
    // -------------------------------------------------------------------------

    if (
        municipalityArea <= 0
    ) {
        return invalidResult(
            candidateGeometries.length,
            [
                `Census municipality geometry has zero area: ${municipalityArea}`
            ]
        );
    }

    if (
        candidateArea <= 0
    ) {
        return invalidResult(
            candidateGeometries.length,
            [
                `candidate geometry has zero area: ${candidateArea}`
            ]
        );
    }

    // -------------------------------------------------------------------------
    // 9. Calculate intersection
    // -------------------------------------------------------------------------

    let intersection:
        Feature<
            Polygon | MultiPolygon
        > | null;

    try {

        intersection =
            intersect(
                featureCollection([
                    municipalityFeature,
                    candidateUnion
                ])
            ) as Feature<
                Polygon | MultiPolygon
            > | null;

    } catch (error) {

        return invalidResult(
            candidateGeometries.length,
            [
                "Turf intersection failed",

                error instanceof Error
                    ? error.message
                    : String(error)
            ]
        );
    }

    // -------------------------------------------------------------------------
    // 10. Calculate intersection area
    // -------------------------------------------------------------------------

    let intersectionArea: number;

    try {

        intersectionArea =
            intersection
                ? area(
                    intersection
                )
                : 0;

    } catch (error) {

        return invalidResult(
            candidateGeometries.length,
            [
                "failed to calculate intersection area",

                error instanceof Error
                    ? error.message
                    : String(error)
            ]
        );
    }

    // -------------------------------------------------------------------------
    // 11. Calculate coverage ratios
    // -------------------------------------------------------------------------

    const coverageOfMunicipality =
        intersectionArea /
        municipalityArea;

    const candidateInsideMunicipality =
        intersectionArea /
        candidateArea;

    // -------------------------------------------------------------------------
    // 12. Score municipality coverage
    // -------------------------------------------------------------------------

    let score = 0;

    if (
        coverageOfMunicipality >=
        GEOGRAPHY_STRONG_COVERAGE
    ) {

        score += 70;

        reasons.push(
            `+70: candidate geometry covers ` +
            `${formatPercent(coverageOfMunicipality)} ` +
            `of the Census municipality`
        );

    } else if (
        coverageOfMunicipality >=
        GEOGRAPHY_PROBABLE_COVERAGE
    ) {

        score += 50;

        reasons.push(
            `+50: candidate geometry covers ` +
            `${formatPercent(coverageOfMunicipality)} ` +
            `of the Census municipality`
        );

    } else if (
        coverageOfMunicipality >=
        GEOGRAPHY_WEAK_COVERAGE
    ) {

        score += 25;

        reasons.push(
            `+25: candidate geometry covers ` +
            `${formatPercent(coverageOfMunicipality)} ` +
            `of the Census municipality`
        );

    } else {

        reasons.push(
            `+0: candidate geometry covers only ` +
            `${formatPercent(coverageOfMunicipality)} ` +
            `of the Census municipality`
        );
    }

    // -------------------------------------------------------------------------
    // 13. Score candidate containment
    // -------------------------------------------------------------------------

    if (
        candidateInsideMunicipality >=
        0.90
    ) {

        score += 30;

        reasons.push(
            `+30: ` +
            `${formatPercent(candidateInsideMunicipality)} ` +
            `of candidate geometry lies inside the Census municipality`
        );

    } else if (
        candidateInsideMunicipality >=
        0.60
    ) {

        score += 20;

        reasons.push(
            `+20: ` +
            `${formatPercent(candidateInsideMunicipality)} ` +
            `of candidate geometry lies inside the Census municipality`
        );

    } else if (
        candidateInsideMunicipality >=
        0.20
    ) {

        score += 10;

        reasons.push(
            `+10: ` +
            `${formatPercent(candidateInsideMunicipality)} ` +
            `of candidate geometry lies inside the Census municipality`
        );

    } else {

        reasons.push(
            `+0: only ` +
            `${formatPercent(candidateInsideMunicipality)} ` +
            `of candidate geometry lies inside the Census municipality`
        );
    }

    // -------------------------------------------------------------------------
    // 14. Clamp score
    // -------------------------------------------------------------------------

    score =
        Math.max(
            0,
            Math.min(
                100,
                score
            )
        );

    // -------------------------------------------------------------------------
    // 15. Determine geographic status
    // -------------------------------------------------------------------------

    let status:
        MunicipalityGeographyValidationStatus;

    if (
        coverageOfMunicipality >=
        GEOGRAPHY_STRONG_COVERAGE &&
        candidateInsideMunicipality >=
        0.60
    ) {

        status =
            "strong-match";

    } else if (
        coverageOfMunicipality >=
        GEOGRAPHY_PROBABLE_COVERAGE &&
        candidateInsideMunicipality >=
        0.40
    ) {

        status =
            "probable-match";

    } else if (
        coverageOfMunicipality >=
        GEOGRAPHY_WEAK_COVERAGE
    ) {

        status =
            "weak-match";

    } else {

        status =
            "no-match";
    }

    // -------------------------------------------------------------------------
    // 16. Determine whether municipality validation passes
    // -------------------------------------------------------------------------

    const likelyMunicipalityMatch =
        score >=
        GEOGRAPHY_VALIDATION_THRESHOLD &&
        status !== "no-match";

    // -------------------------------------------------------------------------
    // 17. Add final diagnostic information
    // -------------------------------------------------------------------------

    reasons.push(
        `municipality geography score: ${score}`
    );

    reasons.push(
        `municipality geography status: ${status}`
    );

    reasons.push(
        likelyMunicipalityMatch
            ? "candidate passes municipality geography validation"
            : "candidate fails municipality geography validation"
    );

    // -------------------------------------------------------------------------
    // 18. Return result
    // -------------------------------------------------------------------------

    return {
        status,

        score,

        likelyMunicipalityMatch,

        municipalityArea,

        candidateArea,

        intersectionArea,

        coverageOfMunicipality,

        candidateInsideMunicipality,

        candidateFeatureCount:
            candidateGeometries.length,

        validCandidateFeatureCount:
            validCandidateFeatures.length,

        reasons
    };
}

// -----------------------------------------------------------------------------
// Invalid result helper
// -----------------------------------------------------------------------------

function invalidResult(
    candidateFeatureCount:
        number,

    reasons:
        string[]
): MunicipalityGeographyValidation {

    return {
        status:
            "invalid",

        score:
            0,

        likelyMunicipalityMatch:
            false,

        municipalityArea:
            0,

        candidateArea:
            0,

        intersectionArea:
            0,

        coverageOfMunicipality:
            0,

        candidateInsideMunicipality:
            0,

        candidateFeatureCount,

        validCandidateFeatureCount:
            0,

        reasons: [
            ...reasons,
            "municipality geography validation failed"
        ]
    };
}

// -----------------------------------------------------------------------------
// Candidate geometry union
// -----------------------------------------------------------------------------

function unionCandidateFeatures(
    features:
        Feature<Polygon | MultiPolygon>[]
): Feature<Polygon | MultiPolygon> {

    if (
        features.length === 0
    ) {
        throw new Error(
            "Cannot union an empty candidate geometry collection."
        );
    }

    // Turf union requires at least two geometries.
    // When there is only one valid candidate, use it directly.
    if (
        features.length === 1
    ) {
        return features[0];
    }

    const result =
        union(
            featureCollection(
                features
            )
        );

    if (
        !result
    ) {
        throw new Error(
            "Turf union returned no geometry."
        );
    }

    return result;
}

// -----------------------------------------------------------------------------
// Formatting
// -----------------------------------------------------------------------------

function formatPercent(
    value:
        number
): string {

    return `${(
        value * 100
    ).toFixed(1)}%`;
}

