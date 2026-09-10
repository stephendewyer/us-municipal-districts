import type {
    CandidateScore,
    InspectedCandidate
} from "./types.js";

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

function isPolygon(
    candidate: InspectedCandidate
): boolean {
    return (
        candidate.inspection.geometryType ===
            "esriGeometryPolygon" ||
        candidate.inspection.geometryType ===
            "polygon"
    );
}

function hasValidatedPoliticalBoundary(
    candidate: InspectedCandidate
): boolean {
    const validation = candidate.validation;

    return Boolean(
        validation &&
        validation.isLikelyPoliticalBoundary &&
        validation.confidence >= 60 &&
        validation.districtField &&
        validation.distinctDistrictValues.length >= 2 &&
        (
            validation.geometryType ===
                "esriGeometryPolygon" ||
            validation.geometryType ===
                "polygon"
        )
    );
}

function hasStrongNegativeEvidence(
    candidate: InspectedCandidate
): boolean {

    const classification =
        candidate.classification;

    const political =
        classification.matches.political ?? [];

    /*
     * Once a candidate has been positively identified as a
     * political boundary, census/parcel/housing evidence should
     * not automatically reject it.
     *
     * Those terms may describe:
     *
     * - attributes contained in the dataset
     * - related demographic information
     * - source documentation
     * - metadata inherited from another layer
     *
     * They are only strong negative evidence when the candidate
     * lacks convincing political identity.
     */
    const hasPoliticalIdentity =
        classification.isPoliticalBoundary ||
        political.length > 0;

    if (
        !hasPoliticalIdentity &&
        (
            classification.isCensusDataset ||
            classification.isParcelDataset ||
            classification.isHousingDataset
        )
    ) {
        return true;
    }

    const thematic =
        classification.matches.thematic ?? [];

    /*
     * A thematic dataset is strong negative evidence only when
     * there is no political identity to counter it.
     */
    if (
        !hasPoliticalIdentity &&
        thematic.length > 0
    ) {
        return true;
    }

    return false;
}

// -----------------------------------------------------------------------------
// Geographic validation scoring
// -----------------------------------------------------------------------------

/**
 * Returns the ranking contribution from municipality geography validation.
 *
 * Geographic validation is intentionally a ranking signal rather than a
 * hard eligibility gate. A candidate can still be useful when geographic
 * validation is unavailable, but a candidate that has been demonstrated to
 * overlap the municipality boundary should rank substantially higher.
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

    switch (geography.status) {
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

export function scoreCandidate(
    candidate: InspectedCandidate
): CandidateScore {
    const reasons: string[] = [];

    const classification =
        candidate.classification;

    const inspection =
        candidate.inspection;

    const validation =
        candidate.validation;

    // -------------------------------------------------------------------------
    // Hard rejection gates
    // -------------------------------------------------------------------------

    if (classification.rejected) {
        return {
            candidate,
            score: Number.NEGATIVE_INFINITY,
            reasons: [
                "candidate rejected by classification"
            ]
        };
    }

    if (!isPolygon(candidate)) {
        return {
            candidate,
            score: Number.NEGATIVE_INFINITY,
            reasons: [
                "candidate is not polygon geometry"
            ]
        };
    }

    if (!classification.isPoliticalBoundary) {
        return {
            candidate,
            score: Number.NEGATIVE_INFINITY,
            reasons: [
                "candidate is not classified as a political boundary"
            ]
        };
    }

    if (!hasValidatedPoliticalBoundary(candidate)) {
        return {
            candidate,
            score: Number.NEGATIVE_INFINITY,
            reasons: [
                "candidate failed validated political-boundary gate"
            ]
        };
    }

    if (hasStrongNegativeEvidence(candidate)) {
        return {
            candidate,
            score: Number.NEGATIVE_INFINITY,
            reasons: [
                "candidate contains strong non-political/thematic evidence"
            ]
        };
    }

    // -------------------------------------------------------------------------
    // Base score
    // -------------------------------------------------------------------------

    let score = 0;

    score += 40;
    reasons.push(
        "+40 validated political boundary"
    );

    if (
        classification.officialMunicipalSource
    ) {
        score += 35;

        reasons.push(
            "+35 official municipal source"
        );
    }

    if (classification.districtType) {
        score += 15;

        reasons.push(
            `+15 district type: ${classification.districtType}`
        );
    }

    const districtField =
        getDistrictField(candidate);

    if (districtField) {
        score += 15;

        reasons.push(
            `+15 district field: ${districtField}`
        );
    }

    score += 10;

    reasons.push(
        "+10 polygon geometry"
    );

    // -------------------------------------------------------------------------
    // Attribute validation
    // -------------------------------------------------------------------------

    if (validation) {
        score += 25;

        reasons.push(
            "+25 validated political boundary"
        );

        if (validation.confidence >= 90) {
            score += 20;

            reasons.push(
                "+20 validation confidence >= 0.90"
            );
        } else if (
            validation.confidence >= 80
        ) {
            score += 15;

            reasons.push(
                "+15 validation confidence >= 0.80"
            );
        } else if (
            validation.confidence >= 70
        ) {
            score += 8;

            reasons.push(
                "+8 validation confidence >= 0.70"
            );
        }

        if (
            validation.distinctDistrictValues
                .length >= 5
        ) {
            score += 10;

            reasons.push(
                "+10 at least 5 distinct district values"
            );
        } else if (
            validation.distinctDistrictValues
                .length >= 3
        ) {
            score += 7;

            reasons.push(
                "+7 at least 3 distinct district values"
            );
        } else if (
            validation.distinctDistrictValues
                .length >= 2
        ) {
            score += 4;

            reasons.push(
                "+4 at least 2 distinct district values"
            );
        }

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

        if (validation.sampleCount > 0) {
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
        getGeographyScore(candidate);

    score += geographyScore.score;

    if (geographyScore.reason) {
        reasons.push(
            geographyScore.reason
        );
    }

    // -------------------------------------------------------------------------
    // District name field
    // -------------------------------------------------------------------------

    if (inspection.nameField) {
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

    // =============================================================================
    // Temporal evidence
    // =============================================================================

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
        }${
            temporal.score
        } temporal status: ${
            temporal.status
        }`
    );

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

    return {
        candidate,
        score,
        reasons
    };
}

// -----------------------------------------------------------------------------
// Candidate comparison
// -----------------------------------------------------------------------------

export function compareCandidateScores(
    a: CandidateScore,
    b: CandidateScore
): number {
    // Primary ordering: total score, descending.
    if (b.score !== a.score) {
        return b.score - a.score;
    }

    // Prefer candidates that passed the validated
    // political-boundary gate.
    const aValidated =
        hasValidatedPoliticalBoundary(
            a.candidate
        );

    const bValidated =
        hasValidatedPoliticalBoundary(
            b.candidate
        );

    if (aValidated !== bValidated) {
        return aValidated ? -1 : 1;
    }

    // Prefer higher attribute-validation confidence.
    const aConfidence =
        a.candidate.validation?.confidence ?? 0;

    const bConfidence =
        b.candidate.validation?.confidence ?? 0;

    if (
        aConfidence !== bConfidence
    ) {
        return bConfidence - aConfidence;
    }

    // Prefer candidates that do not require review.
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
        return aRequiresReview ? 1 : -1;
    }

    // Prefer official municipal sources.
    const aOfficial =
        a.candidate.classification
            .officialMunicipalSource;

    const bOfficial =
        b.candidate.classification
            .officialMunicipalSource;

    if (aOfficial !== bOfficial) {
        return aOfficial ? -1 : 1;
    }

    // Prefer FeatureServer over MapServer when
    // otherwise equivalent.
    const aService =
        a.candidate.inspection.serviceType;

    const bService =
        b.candidate.inspection.serviceType;

    if (aService !== bService) {
        return (
            aService === "FeatureServer"
                ? -1
                : 1
        );
    }

    // Prefer a candidate with a known district field.
    const aField =
        getDistrictField(a.candidate);

    const bField =
        getDistrictField(b.candidate);

    if (
        Boolean(aField) !==
        Boolean(bField)
    ) {
        return aField ? -1 : 1;
    }

    // Final deterministic tie-breaker.
    return a.candidate.inspection.url
        .localeCompare(
            b.candidate.inspection.url
        );
}

// -----------------------------------------------------------------------------
// Ranking
// -----------------------------------------------------------------------------

export function rankCandidates(
    candidates: InspectedCandidate[]
): CandidateScore[] {
    return candidates
        .map(scoreCandidate)
        .sort(compareCandidateScores);
}