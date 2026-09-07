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


// =============================================================================
// Types
// =============================================================================

export type MunicipalityGeographyValidationStatus =
    | "strong-match"
    | "probable-match"
    | "weak-match"
    | "no-match"
    | "invalid";


export interface MunicipalityGeographyValidation {

    /**
     * Overall geographic comparison result.
     */
    status:
        MunicipalityGeographyValidationStatus;

    /**
     * Diagnostic geographic score from 0 to 100.
     *
     * This score is useful for ranking and logging, but
     * should not by itself determine whether a candidate
     * is accepted as a municipality match.
     */
    score: number;

    /**
     * Whether the candidate geometry is sufficiently
     * consistent with the Census municipality boundary
     * to be considered a likely municipality match.
     *
     * Only strong-match and probable-match results return true.
     */
    likelyMunicipalityMatch: boolean;

    /**
     * Area of the Census municipality geometry.
     *
     * Turf area is returned in square meters.
     */
    municipalityArea: number;

    /**
     * Area of the union of all valid candidate geometries.
     *
     * Turf area is returned in square meters.
     */
    candidateArea: number;

    /**
     * Area where the candidate geometry and municipality
     * geometry overlap.
     *
     * Turf area is returned in square meters.
     */
    intersectionArea: number;

    /**
     * Percentage of the municipality covered by the
     * candidate geometry.
     *
     * Range: 0 to 1.
     */
    coverageOfMunicipality: number;

    /**
     * Percentage of the candidate geometry that falls
     * inside the municipality.
     *
     * Range: 0 to 1.
     */
    candidateInsideMunicipality: number;

    /**
     * Number of candidate geometries supplied to the validator.
     */
    candidateFeatureCount: number;

    /**
     * Number of candidate geometries that had usable,
     * positive-area geometry.
     */
    validCandidateFeatureCount: number;

    /**
     * Human-readable explanation of the result.
     */
    reasons: string[];
}


// =============================================================================
// Thresholds
// =============================================================================

/**
 * Candidate coverage of the Census municipality required
 * for a strong geographic match.
 */
export const GEOGRAPHY_STRONG_COVERAGE =
    0.90;


/**
 * Candidate coverage of the Census municipality required
 * for a probable geographic match.
 */
export const GEOGRAPHY_PROBABLE_COVERAGE =
    0.60;


/**
 * Candidate coverage of the Census municipality required
 * for a weak geographic match.
 */
export const GEOGRAPHY_WEAK_COVERAGE =
    0.20;


// =============================================================================
// Public API
// =============================================================================

/**
 * Compare one or more candidate ArcGIS geometries against
 * the Census boundary for a municipality.
 *
 * The candidate geometries should already have been converted
 * into GeoJSON Polygon or MultiPolygon geometries.
 *
 * This function intentionally performs no network requests.
 * Census municipality geometry is loaded from the locally
 * generated Census geometry files.
 *
 * @param candidateGeometries
 * Polygon or MultiPolygon geometries from the candidate
 * ArcGIS layer.
 *
 * @param place
 * Census municipality being validated.
 *
 * @param geometryDirectory
 * Optional directory containing the generated Census
 * place geometry state files.
 */
export function validateMunicipalityGeography(
    candidateGeometries:
        Array<Polygon | MultiPolygon>,
    place: CensusPlace,
    geometryDirectory?: string
): MunicipalityGeographyValidation {

    const candidateFeatureCount =
        candidateGeometries.length;


    // -------------------------------------------------------------------------
    // Candidate presence
    // -------------------------------------------------------------------------

    if (
        candidateFeatureCount === 0
    ) {
        return invalidResult(
            candidateFeatureCount,
            0,
            [
                "No candidate geometries were supplied."
            ]
        );
    }


    // -------------------------------------------------------------------------
    // Load Census municipality geometry
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
            candidateFeatureCount,
            0,
            [
                [
                    "Failed to load Census municipality geometry",
                    `for ${place.city}, ${place.state}`,
                    `(${place.placeFips}).`
                ].join(" "),

                error instanceof Error
                    ? error.message
                    : String(error)
            ]
        );
    }


    // -------------------------------------------------------------------------
    // Municipality feature
    // -------------------------------------------------------------------------

    const municipalityFeature =
        feature(
            municipalityGeometry
        );


    let municipalityArea: number;

    try {

        municipalityArea =
            area(
                municipalityFeature
            );

    } catch (error) {

        return invalidResult(
            candidateFeatureCount,
            0,
            [
                "Failed to calculate Census municipality area.",

                error instanceof Error
                    ? error.message
                    : String(error)
            ]
        );
    }


    if (
        !Number.isFinite(
            municipalityArea
        ) ||
        municipalityArea <= 0
    ) {

        return invalidResult(
            candidateFeatureCount,
            0,
            [
                "Census municipality geometry has zero or invalid area."
            ]
        );
    }


    // -------------------------------------------------------------------------
    // Convert candidate geometries to Turf features
    // -------------------------------------------------------------------------

    const candidateFeatures:
        Feature<Polygon | MultiPolygon>[] =
        candidateGeometries.map(
            geometry =>
                feature(
                    geometry
                )
        );


    // -------------------------------------------------------------------------
    // Filter invalid / zero-area candidate geometries
    // -------------------------------------------------------------------------

    const validCandidateFeatures =
        candidateFeatures.filter(
            candidate => {

                try {

                    const candidateArea =
                        area(
                            candidate
                        );

                    return (
                        Number.isFinite(
                            candidateArea
                        ) &&
                        candidateArea > 0
                    );

                } catch {

                    return false;
                }
            }
        );


    const validCandidateFeatureCount =
        validCandidateFeatures.length;


    if (
        validCandidateFeatureCount === 0
    ) {

        return invalidResult(
            candidateFeatureCount,
            validCandidateFeatureCount,
            [
                "None of the candidate geometries has a valid positive area."
            ]
        );
    }


    // -------------------------------------------------------------------------
    // Union candidate geometries
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
            candidateFeatureCount,
            validCandidateFeatureCount,
            [
                "Failed to union candidate geometries.",

                error instanceof Error
                    ? error.message
                    : String(error)
            ]
        );
    }


    // -------------------------------------------------------------------------
    // Candidate area
    // -------------------------------------------------------------------------

    let candidateArea: number;

    try {

        candidateArea =
            area(
                candidateUnion
            );

    } catch (error) {

        return invalidResult(
            candidateFeatureCount,
            validCandidateFeatureCount,
            [
                "Failed to calculate candidate geometry area.",

                error instanceof Error
                    ? error.message
                    : String(error)
            ]
        );
    }


    if (
        !Number.isFinite(
            candidateArea
        ) ||
        candidateArea <= 0
    ) {

        return invalidResult(
            candidateFeatureCount,
            validCandidateFeatureCount,
            [
                "Candidate geometry has zero or invalid area."
            ]
        );
    }


    // -------------------------------------------------------------------------
    // Intersection
    // -------------------------------------------------------------------------

    let intersection:
        Feature<Polygon | MultiPolygon> | null = null;


    try {

        intersection =
            intersect(
                featureCollection(
                    [
                        municipalityFeature,
                        candidateUnion
                    ]
                )
            ) as
                Feature<Polygon | MultiPolygon> |
                null;

    } catch (error) {

        return invalidResult(
            candidateFeatureCount,
            validCandidateFeatureCount,
            [
                "Failed to calculate municipality/candidate intersection.",

                error instanceof Error
                    ? error.message
                    : String(error)
            ]
        );
    }


    // -------------------------------------------------------------------------
    // Intersection area
    // -------------------------------------------------------------------------

    let intersectionArea = 0;

    if (
        intersection
    ) {

        try {

            intersectionArea =
                area(
                    intersection
                );

        } catch (error) {

            return invalidResult(
                candidateFeatureCount,
                validCandidateFeatureCount,
                [
                    "Failed to calculate intersection area.",

                    error instanceof Error
                        ? error.message
                        : String(error)
                ]
            );
        }


        if (
            !Number.isFinite(
                intersectionArea
            ) ||
            intersectionArea < 0
        ) {

            intersectionArea = 0;
        }
    }


    // -------------------------------------------------------------------------
    // Coverage calculations
    // -------------------------------------------------------------------------

    const coverageOfMunicipality =
        clampRatio(
            intersectionArea /
            municipalityArea
        );


    const candidateInsideMunicipality =
        clampRatio(
            intersectionArea /
            candidateArea
        );


    // -------------------------------------------------------------------------
    // Classification
    // -------------------------------------------------------------------------

    const status =
        classifyGeography(
            coverageOfMunicipality,
            candidateInsideMunicipality
        );


    // -------------------------------------------------------------------------
    // Score
    // -------------------------------------------------------------------------

    const score =
        calculateGeographyScore(
            coverageOfMunicipality,
            candidateInsideMunicipality
        );


    // -------------------------------------------------------------------------
    // Eligibility
    // -------------------------------------------------------------------------

    /*
     * Geographic eligibility intentionally does not use the
     * numeric score alone.
     *
     * A weak overlap can produce a non-trivial score because
     * candidate containment also contributes points. That is
     * useful for diagnostics/ranking, but a weak geographic
     * overlap should not be enough to identify a candidate as
     * the municipality's actual boundary.
     */
    const likelyMunicipalityMatch =
        status === "strong-match" ||
        status === "probable-match";


    // -------------------------------------------------------------------------
    // Reasons
    // -------------------------------------------------------------------------

    const reasons =
        buildReasons(
            status,
            coverageOfMunicipality,
            candidateInsideMunicipality,
            municipalityArea,
            candidateArea,
            intersectionArea,
            candidateFeatureCount,
            validCandidateFeatureCount
        );


    // -------------------------------------------------------------------------
    // Return
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

        candidateFeatureCount,

        validCandidateFeatureCount,

        reasons
    };
}


// =============================================================================
// Candidate union
// =============================================================================

/**
 * Union all valid candidate features.
 *
 * Turf's union() requires at least two features. If there is
 * only one valid candidate, return it directly.
 */
function unionCandidateFeatures(
    candidateFeatures:
        Feature<Polygon | MultiPolygon>[]
):
    Feature<Polygon | MultiPolygon> {

    if (
        candidateFeatures.length === 0
    ) {

        throw new Error(
            "Cannot union an empty candidate feature collection."
        );
    }


    if (
        candidateFeatures.length === 1
    ) {

        return candidateFeatures[0];
    }


    const result =
        union(
            featureCollection(
                candidateFeatures
            )
        );


    if (
        !result
    ) {

        throw new Error(
            "Turf union returned no geometry."
        );
    }


    return result as
        Feature<Polygon | MultiPolygon>;
}


// =============================================================================
// Classification
// =============================================================================

function classifyGeography(
    coverageOfMunicipality: number,
    candidateInsideMunicipality: number
):
    MunicipalityGeographyValidationStatus {

    /*
     * Strong:
     *
     * The candidate covers at least 90% of the Census
     * municipality and at least 60% of the candidate itself
     * falls inside the municipality.
     */
    if (
        coverageOfMunicipality >=
            GEOGRAPHY_STRONG_COVERAGE &&
        candidateInsideMunicipality >=
            0.60
    ) {

        return "strong-match";
    }


    /*
     * Probable:
     *
     * The candidate covers at least 60% of the municipality
     * and at least 40% of the candidate falls inside it.
     */
    if (
        coverageOfMunicipality >=
            GEOGRAPHY_PROBABLE_COVERAGE &&
        candidateInsideMunicipality >=
            0.40
    ) {

        return "probable-match";
    }


    /*
     * Weak:
     *
     * Some meaningful portion of the municipality overlaps
     * the candidate, but the evidence is not strong enough
     * to identify the candidate as the municipality boundary.
     */
    if (
        coverageOfMunicipality >=
        GEOGRAPHY_WEAK_COVERAGE
    ) {

        return "weak-match";
    }


    return "no-match";
}


// =============================================================================
// Score
// =============================================================================

/**
 * Calculate a diagnostic geographic score from 0 to 100.
 *
 * The score is intentionally separate from the match status.
 * The status is what determines geographic eligibility.
 */
function calculateGeographyScore(
    coverageOfMunicipality: number,
    candidateInsideMunicipality: number
): number {

    let score = 0;


    // -------------------------------------------------------------------------
    // Municipality coverage
    // -------------------------------------------------------------------------

    if (
        coverageOfMunicipality >=
        GEOGRAPHY_STRONG_COVERAGE
    ) {

        score += 70;

    } else if (
        coverageOfMunicipality >=
        GEOGRAPHY_PROBABLE_COVERAGE
    ) {

        score += 50;

    } else if (
        coverageOfMunicipality >=
        GEOGRAPHY_WEAK_COVERAGE
    ) {

        score += 25;
    }


    // -------------------------------------------------------------------------
    // Candidate containment
    // -------------------------------------------------------------------------

    if (
        candidateInsideMunicipality >=
        0.90
    ) {

        score += 30;

    } else if (
        candidateInsideMunicipality >=
        0.60
    ) {

        score += 20;

    } else if (
        candidateInsideMunicipality >=
        0.20
    ) {

        score += 10;
    }


    return Math.min(
        Math.max(
            score,
            0
        ),
        100
    );
}


// =============================================================================
// Reasons
// =============================================================================

function buildReasons(
    status:
        MunicipalityGeographyValidationStatus,
    coverageOfMunicipality: number,
    candidateInsideMunicipality: number,
    municipalityArea: number,
    candidateArea: number,
    intersectionArea: number,
    candidateFeatureCount: number,
    validCandidateFeatureCount: number
): string[] {

    const reasons: string[] = [];


    // -------------------------------------------------------------------------
    // Feature counts
    // -------------------------------------------------------------------------

    reasons.push(
        [
            `candidate geometries:`,
            `${candidateFeatureCount}`
        ].join(" ")
    );


    if (
        validCandidateFeatureCount !==
        candidateFeatureCount
    ) {

        reasons.push(
            [
                `valid candidate geometries:`,
                `${validCandidateFeatureCount}`,
                `of ${candidateFeatureCount}`
            ].join(" ")
        );

    } else {

        reasons.push(
            [
                `valid candidate geometries:`,
                `${validCandidateFeatureCount}`
            ].join(" ")
        );
    }


    // -------------------------------------------------------------------------
    // Areas
    // -------------------------------------------------------------------------

    reasons.push(
        [
            "municipality area:",
            `${formatArea(municipalityArea)} m²`
        ].join(" ")
    );


    reasons.push(
        [
            "candidate area:",
            `${formatArea(candidateArea)} m²`
        ].join(" ")
    );


    reasons.push(
        [
            "intersection area:",
            `${formatArea(intersectionArea)} m²`
        ].join(" ")
    );


    // -------------------------------------------------------------------------
    // Coverage
    // -------------------------------------------------------------------------

    reasons.push(
        [
            "municipality coverage:",
            formatPercentage(
                coverageOfMunicipality
            )
        ].join(" ")
    );


    reasons.push(
        [
            "candidate inside municipality:",
            formatPercentage(
                candidateInsideMunicipality
            )
        ].join(" ")
    );


    // -------------------------------------------------------------------------
    // Classification
    // -------------------------------------------------------------------------

    switch (
        status
    ) {

        case "strong-match":

            reasons.push(
                [
                    "strong geographic match:",
                    "candidate covers at least 90% of the municipality",
                    "and has substantial containment"
                ].join(" ")
            );

            break;


        case "probable-match":

            reasons.push(
                [
                    "probable geographic match:",
                    "candidate covers at least 60% of the municipality",
                    "with meaningful containment"
                ].join(" ")
            );

            break;


        case "weak-match":

            reasons.push(
                [
                    "weak geographic match:",
                    "candidate overlaps at least 20% of the municipality",
                    "but geographic evidence is insufficient for eligibility"
                ].join(" ")
            );

            break;


        case "no-match":

            reasons.push(
                "candidate does not sufficiently overlap the Census municipality."
            );

            break;


        case "invalid":

            reasons.push(
                "geographic validation could not be completed."
            );

            break;
    }


    return reasons;
}


// =============================================================================
// Invalid result
// =============================================================================

function invalidResult(
    candidateFeatureCount: number,
    validCandidateFeatureCount: number,
    reasons: string[]
):
    MunicipalityGeographyValidation {

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

        validCandidateFeatureCount,

        reasons
    };
}


// =============================================================================
// Numeric helpers
// =============================================================================

function clampRatio(
    value: number
): number {

    if (
        !Number.isFinite(
            value
        )
    ) {

        return 0;
    }


    return Math.min(
        Math.max(
            value,
            0
        ),
        1
    );
}


function formatPercentage(
    ratio: number
): string {

    return `${(
        ratio * 100
    ).toFixed(1)}%`;
}


function formatArea(
    value: number
): string {

    return value.toFixed(2);
}