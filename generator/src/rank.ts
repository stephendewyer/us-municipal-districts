import type {
    CandidateScore,
    InspectedCandidate
} from "./types.js";

import {
    evaluateCandidateEligibility
} from "./candidateEligibility.js";

import {
    validateTemporal
} from "./temporalValidation.js";


// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function getDistrictField(
    candidate: InspectedCandidate
): string | undefined {

    return (
        candidate.inspection.districtField ??
        candidate.validation?.districtField
    );
}

function getTemporalEvidence(
    candidate: InspectedCandidate
) {
    return validateTemporal(
        candidate.inspection
    );
}


function getTemporalYear(
    candidate: InspectedCandidate
): number {

    const temporal =
        getTemporalEvidence(
            candidate
        );

    if (
        temporal.endYear !== undefined
    ) {
        return temporal.endYear;
    }

    if (
        temporal.year !== undefined
    ) {
        return temporal.year;
    }

    if (
        temporal.startYear !== undefined
    ) {
        return temporal.startYear;
    }

    return 0;
}


function getTemporalPriority(
    candidate: InspectedCandidate
): number {

    const temporal =
        getTemporalEvidence(
            candidate
        );

    switch (
        temporal.status
    ) {

        case "current":
            return 4;

        case "dated":
            return 3;

        case "undated":
            return 2;

        case "historical":
            return 1;

        case "future":
            return 0;

        default:
            return 0;
    }
}

/**
 * Return the most useful year associated with a temporal result.
 *
 * Temporal evidence can represent:
 *
 *     year
 *     startYear/endYear
 *
 * For ranking boundary vintages, the END of a closed range is the most
 * important year because it represents the latest boundary vintage covered
 * by that dataset.
 *
 * Examples:
 *
 *     2015              -> 2015
 *     2015-2023         -> 2023
 *     2023-present      -> 2023
 */
function getTemporalVintageYear(
    candidate: InspectedCandidate
): number | undefined {

    const temporal =
        validateTemporal(
            candidate.inspection
        );

    if (
        temporal.endYear !== undefined
    ) {
        return temporal.endYear;
    }

    if (
        temporal.year !== undefined
    ) {
        return temporal.year;
    }

    if (
        temporal.startYear !== undefined
    ) {
        return temporal.startYear;
    }

    return undefined;
}

// -----------------------------------------------------------------------------
// Geographic validation scoring
// -----------------------------------------------------------------------------

/**
 * Returns the ranking contribution from municipality geography validation.
 *
 * Geography is a quality signal, not an eligibility decision.
 *
 * Eligibility decisions belong in candidateEligibility.ts.
 */
function getGeographyScore(
    candidate: InspectedCandidate
): {
    score: number;
    reason?: string;
} {

    const geography =
        candidate.municipalityGeographyValidation;

    if (!geography) {

        return {
            score: 0
        };
    }

    switch (
        geography.status
    ) {

        case "strong-match":

            return {
                score: 30,
                reason:
                    "+30 strong municipality geography match"
            };

        case "probable-match":

            return {
                score: 20,
                reason:
                    "+20 probable municipality geography match"
            };

        case "weak-match":

            return {
                score: 5,
                reason:
                    "+5 weak municipality geography match"
            };

        case "no-match":

            return {
                score: -15,
                reason:
                    "-15 candidate does not match municipality geography"
            };

        case "invalid":

            return {
                score: 0,
                reason:
                    "0 invalid municipality geography validation"
            };

        default:

            return {
                score: 0
            };
    }
}


// -----------------------------------------------------------------------------
// Candidate scoring
// -----------------------------------------------------------------------------

/**
 * Scores an eligible candidate.
 *
 * IMPORTANT:
 *
 * Eligibility is NOT determined here.
 *
 * candidateEligibility.ts is responsible for determining whether a
 * candidate is eligible.
 *
 * rank.ts is responsible for determining how strong an eligible candidate is.
 */
export function scoreCandidate(
    candidate: InspectedCandidate
): CandidateScore {

    const eligibility =
        evaluateCandidateEligibility(
            candidate
        );

    if (
        !eligibility.eligible
    ) {

        throw new Error(
            `Cannot score ineligible candidate: ${
                candidate.inspection.title
            }`
        );
    }

    const reasons: string[] = [];

    const classification =
        candidate.classification;

    const inspection =
        candidate.inspection;

    const validation =
        candidate.validation;


    // -------------------------------------------------------------------------
    // Base score
    // -------------------------------------------------------------------------

    let score = 0;

    score += 40;

    reasons.push(
        "+40 validated political boundary"
    );


    // -------------------------------------------------------------------------
    // Official municipal source
    // -------------------------------------------------------------------------

    if (
        classification.officialMunicipalSource
    ) {

        score += 35;

        reasons.push(
            "+35 official municipal source"
        );
    }


    // -------------------------------------------------------------------------
    // District type
    // -------------------------------------------------------------------------

    if (
        classification.districtType
    ) {

        score += 15;

        reasons.push(
            `+15 district type: ${classification.districtType}`
        );
    }


    // -------------------------------------------------------------------------
    // District field
    // -------------------------------------------------------------------------

    const districtField =
        getDistrictField(
            candidate
        );

    if (
        districtField
    ) {

        score += 15;

        reasons.push(
            `+15 district field: ${districtField}`
        );
    }


    // -------------------------------------------------------------------------
    // Polygon geometry
    // -------------------------------------------------------------------------

    /*
     * Polygon geometry is an eligibility requirement.
     *
     * Because this function only scores eligible candidates, the polygon
     * requirement has already been established by candidateEligibility.ts.
     *
     * This score therefore represents the quality contribution associated
     * with satisfying that requirement.
     */

    score += 10;

    reasons.push(
        "+10 polygon geometry"
    );


    // -------------------------------------------------------------------------
    // Attribute validation
    // -------------------------------------------------------------------------

    if (
        validation
    ) {

        score += 25;

        reasons.push(
            "+25 candidate validation available"
        );


        // ---------------------------------------------------------------------
        // Validation confidence
        // ---------------------------------------------------------------------

        if (
            validation.confidence >= 90
        ) {

            score += 20;

            reasons.push(
                "+20 validation confidence >= 90"
            );

        } else if (
            validation.confidence >= 80
        ) {

            score += 15;

            reasons.push(
                "+15 validation confidence >= 80"
            );

        } else if (
            validation.confidence >= 70
        ) {

            score += 8;

            reasons.push(
                "+8 validation confidence >= 70"
            );
        }


        // ---------------------------------------------------------------------
        // Distinct district values
        // ---------------------------------------------------------------------

        if (
            validation.distinctDistrictValues.length >= 5
        ) {

            score += 10;

            reasons.push(
                "+10 at least 5 distinct district values"
            );

        } else if (
            validation.distinctDistrictValues.length >= 3
        ) {

            score += 7;

            reasons.push(
                "+7 at least 3 distinct district values"
            );

        } else if (
            validation.distinctDistrictValues.length >= 2
        ) {

            score += 4;

            reasons.push(
                "+4 at least 2 distinct district values"
            );
        }


        // ---------------------------------------------------------------------
        // District value pattern
        // ---------------------------------------------------------------------

        switch (
            validation.districtValuePattern
        ) {

            case "ward-number":

                score += 12;

                reasons.push(
                    "+12 ward-number value pattern"
                );

                break;


            case "district-number":

                score += 12;

                reasons.push(
                    "+12 district-number value pattern"
                );

                break;


            case "numeric":

                score += 5;

                reasons.push(
                    "+5 numeric district values"
                );

                break;


            case "named":

                score += 4;

                reasons.push(
                    "+4 named district values"
                );

                break;
        }


        // ---------------------------------------------------------------------
        // Validation sample
        // ---------------------------------------------------------------------

        if (
            validation.sampleCount > 0
        ) {

            score += 3;

            reasons.push(
                "+3 validation sample available"
            );
        }
    }


    // -------------------------------------------------------------------------
    // Municipality geography validation
    // -------------------------------------------------------------------------

    const geographyScore =
        getGeographyScore(
            candidate
        );

    score +=
        geographyScore.score;

    if (
        geographyScore.reason
    ) {

        reasons.push(
            geographyScore.reason
        );
    }


    // -------------------------------------------------------------------------
    // District name field
    // -------------------------------------------------------------------------

    if (
        inspection.nameField
    ) {

        score += 5;

        reasons.push(
            `+5 district name field: ${inspection.nameField}`
        );

    } else if (
        inspection.nameFields.length > 0
    ) {

        score += 2;

        reasons.push(
            "+2 district name field detected"
        );
    }


    // -------------------------------------------------------------------------
    // Temporal evidence
    // -------------------------------------------------------------------------

    const temporal =
        validateTemporal(
            inspection
        );

    score +=
        temporal.score;

    reasons.push(
        `${
            temporal.score >= 0
                ? "+"
                : ""
        }${temporal.score} temporal status: ${
            temporal.status
        }`
    );


    const temporalVintageYear =
        getTemporalVintageYear(
            candidate
        );

    if (
        temporalVintageYear !== undefined
    ) {

        reasons.push(
            `temporal vintage year: ${temporalVintageYear}`
        );
    }


    for (
        const reason of
        temporal.reasons
    ) {

        reasons.push(
            `temporal evidence: ${reason}`
        );
    }


    // -------------------------------------------------------------------------
    // Review penalty
    // -------------------------------------------------------------------------

    if (
        candidate.candidate.requiresReview ||
        classification.requiresReview
    ) {

        score -= 10;

        reasons.push(
            "-10 requires review"
        );
    }


    // -------------------------------------------------------------------------
    // Result
    // -------------------------------------------------------------------------

    return {
        candidate,
        score,
        reasons
    };
}


// -----------------------------------------------------------------------------
// Candidate comparison
// -----------------------------------------------------------------------------

/**
 * Deterministically compares two already-scored candidates.
 *
 * Ordering:
 *
 *     1. Total score
 *     2. Temporal status
 *     3. Temporal vintage year
 *     4. Validation confidence
 *     5. Review status
 *     6. Official municipal source
 *     7. Municipal FeatureServer
 *     8. Known district field
 *     9. URL
 *
 * The explicit temporal comparison is important because temporal score alone
 * should not determine which boundary vintage is canonical.
 *
 * For example:
 *
 *     Chicago Wards 2015-2023
 *     Chicago Wards 2023
 *
 * should not be treated as equivalent merely because both are valid.
 */
export function compareCandidateScores(
    a: CandidateScore,
    b: CandidateScore
): number {

    // -------------------------------------------------------------------------
    // 1. Primary ordering: temporal priority
    // -------------------------------------------------------------------------

    const aTemporalPriority =
        getTemporalPriority(
            a.candidate
        );

    const bTemporalPriority =
        getTemporalPriority(
            b.candidate
        );

    if (
        aTemporalPriority !==
        bTemporalPriority
    ) {

        return (
            bTemporalPriority -
            aTemporalPriority
        );
    }


    // -------------------------------------------------------------------------
    // 2. Temporal vintage
    // -------------------------------------------------------------------------

    const aTemporalYear =
        getTemporalYear(
            a.candidate
        );

    const bTemporalYear =
        getTemporalYear(
            b.candidate
        );

    if (
        aTemporalYear !==
        bTemporalYear
    ) {

        return (
            bTemporalYear -
            aTemporalYear
        );
    }


    // -------------------------------------------------------------------------
    // 3. Secondary ordering: total candidate score
    // -------------------------------------------------------------------------

    if (
        b.score !==
        a.score
    ) {

        return (
            b.score -
            a.score
        );
    }


    // -------------------------------------------------------------------------
    // 4. Validation confidence
    // -------------------------------------------------------------------------

    const aConfidence =
        a.candidate.validation?.confidence ??
        0;

    const bConfidence =
        b.candidate.validation?.confidence ??
        0;

    if (
        aConfidence !==
        bConfidence
    ) {

        return (
            bConfidence -
            aConfidence
        );
    }


    // -------------------------------------------------------------------------
    // 5. Review status
    // -------------------------------------------------------------------------

    const aRequiresReview =
        a.candidate.candidate.requiresReview ||
        a.candidate.classification.requiresReview;

    const bRequiresReview =
        b.candidate.candidate.requiresReview ||
        b.candidate.classification.requiresReview;

    if (
        aRequiresReview !==
        bRequiresReview
    ) {

        return (
            aRequiresReview
                ? 1
                : -1
        );
    }


    // -------------------------------------------------------------------------
    // 6. Official municipal source
    // -------------------------------------------------------------------------

    const aOfficial =
        a.candidate.classification
            .officialMunicipalSource;

    const bOfficial =
        b.candidate.classification
            .officialMunicipalSource;

    if (
        aOfficial !==
        bOfficial
    ) {

        return (
            aOfficial
                ? -1
                : 1
        );
    }


    // -------------------------------------------------------------------------
    // 7. Municipal service priority
    // -------------------------------------------------------------------------

    /*
     * When meaningful signals are otherwise tied, prefer a candidate
     * published through the municipality's FeatureServer representation.
     */

    const aService =
        a.candidate.inspection.serviceType;

    const bService =
        b.candidate.inspection.serviceType;

    if (
        aService !==
        bService
    ) {

        return (
            aService ===
            "FeatureServer"
                ? -1
                : 1
        );
    }


    // -------------------------------------------------------------------------
    // 8. Known district field
    // -------------------------------------------------------------------------

    const aField =
        getDistrictField(
            a.candidate
        );

    const bField =
        getDistrictField(
            b.candidate
        );

    if (
        Boolean(aField) !==
        Boolean(bField)
    ) {

        return (
            aField
                ? -1
                : 1
        );
    }


    // -------------------------------------------------------------------------
    // 9. Deterministic URL tie-breaker
    // -------------------------------------------------------------------------

    return (
        a.candidate.inspection.url
            .localeCompare(
                b.candidate.inspection.url
            )
    );
}


// -----------------------------------------------------------------------------
// Ranking
// -----------------------------------------------------------------------------

/**
 * Evaluates eligibility, removes ineligible candidates, scores eligible
 * candidates, and orders them from highest to lowest quality.
 *
 * Eligibility and ranking are intentionally separate concepts.
 */
export function rankCandidates(
    candidates: InspectedCandidate[]
): CandidateScore[] {

    return candidates

        .map(
            candidate => ({
                candidate,

                eligibility:
                    evaluateCandidateEligibility(
                        candidate
                    )
            })
        )

        .filter(
            result =>
                result.eligibility.eligible
        )

        .map(
            result =>
                scoreCandidate(
                    result.candidate
                )
        )

        .sort(
            compareCandidateScores
        );
}