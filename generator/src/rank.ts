import type {
    CandidateScore,
    InspectedCandidate
} from "./types.js";


// =============================================================================
// Helpers
// =============================================================================

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

    const validation =
        candidate.validation;

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

    if (
        classification.isCensusDataset ||
        classification.isParcelDataset ||
        classification.isHousingDataset
    ) {
        return true;
    }

    const thematic =
        classification.matches
            .thematic ?? [];

    const political =
        classification.matches
            .political ?? [];

    /*
     * Thematic layer with no explicit political identity.
     */
    if (
        thematic.length > 0 &&
        political.length === 0
    ) {
        return true;
    }

    return false;
}


// =============================================================================
// Score one candidate
// =============================================================================

/**
 * Calculate the canonical-selection score for one inspected candidate.
 *
 * Validation is intentionally weighted more heavily than raw field-name
 * detection.
 *
 * A field named WARD is not sufficient by itself.
 */
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


    // =========================================================================
    // Hard rejection
    // =========================================================================

    if (
        classification.rejected
    ) {

        reasons.push(
            "candidate rejected by classification"
        );

        return {

            candidate,

            score:
                Number.NEGATIVE_INFINITY,

            reasons
        };
    }


    if (
        !isPolygon(candidate)
    ) {

        reasons.push(
            "candidate is not polygon geometry"
        );

        return {

            candidate,

            score:
                Number.NEGATIVE_INFINITY,

            reasons
        };
    }


    if (
        !classification.isPoliticalBoundary
    ) {

        reasons.push(
            "candidate is not classified as a political boundary"
        );

        return {

            candidate,

            score:
                Number.NEGATIVE_INFINITY,

            reasons
        };
    }


    if (
        !hasValidatedPoliticalBoundary(candidate)
    ) {

        reasons.push(
            "candidate failed validated political-boundary gate"
        );

        return {

            candidate,

            score:
                Number.NEGATIVE_INFINITY,

            reasons
        };
    }


    if (
        hasStrongNegativeEvidence(candidate)
    ) {

        reasons.push(
            "candidate contains strong non-political/thematic evidence"
        );

        return {

            candidate,

            score:
                Number.NEGATIVE_INFINITY,

            reasons
        };
    }


    // =========================================================================
    // Base score
    // =========================================================================

    let score = 0;


    // =========================================================================
    // Political boundary
    // =========================================================================

    score += 40;

    reasons.push(
        "+40 validated political boundary"
    );


    // =========================================================================
    // Official municipal source
    // =========================================================================

    if (
        classification.officialMunicipalSource
    ) {

        score += 35;

        reasons.push(
            "+35 official municipal source"
        );
    }


    // =========================================================================
    // District type
    // =========================================================================

    if (
        classification.districtType
    ) {

        score += 15;

        reasons.push(
            `+15 district type: ${
                classification.districtType
            }`
        );
    }


    // =========================================================================
    // District field
    // =========================================================================

    const districtField =
        getDistrictField(
            candidate
        );

    if (
        districtField
    ) {

        score += 15;

        reasons.push(
            `+15 district field: ${
                districtField
            }`
        );
    }


    // =========================================================================
    // Polygon geometry
    // =========================================================================

    score += 10;

    reasons.push(
        "+10 polygon geometry"
    );


    // =========================================================================
    // Validation
    // =========================================================================

    if (
        validation
    ) {

        score += 25;

        reasons.push(
            "+25 validated political boundary"
        );


        // ---------------------------------------------------------------------
        // Validation confidence
        // ---------------------------------------------------------------------

        if (
            validation.confidence >= 90
        ) {

            score += 20;

            reasons.push(
                "+20 validation confidence >= 0.90"
            );

        }
        else if (
            validation.confidence >= 80
        ) {

            score += 15;

            reasons.push(
                "+15 validation confidence >= 0.80"
            );

        }
        else if (
            validation.confidence >= 70
        ) {

            score += 8;

            reasons.push(
                "+8 validation confidence >= 0.70"
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

        }
        else if (
            validation.distinctDistrictValues.length >= 3
        ) {

            score += 7;

            reasons.push(
                "+7 at least 3 distinct district values"
            );

        }
        else if (
            validation.distinctDistrictValues.length >= 2
        ) {

            score += 4;

            reasons.push(
                "+4 at least 2 distinct district values"
            );
        }


        // ---------------------------------------------------------------------
        // Recognizable value pattern
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


        if (
            validation.sampleCount > 0
        ) {

            score += 3;

            reasons.push(
                "+3 validation sample available"
            );
        }
    }


    // =========================================================================
    // Name field
    // =========================================================================

    if (
        inspection.nameField
    ) {

        score += 5;

        reasons.push(
            `+5 district name field: ${
                inspection.nameField
            }`
        );

    }
    else if (
        inspection.nameFields.length > 0
    ) {

        score += 2;

        reasons.push(
            "+2 district name field detected"
        );
    }


    // =========================================================================
    // Review penalty
    // =========================================================================

    if (
        candidate.candidate.requiresReview ||
        classification.requiresReview
    ) {

        score -= 10;

        reasons.push(
            "-10 requires review"
        );
    }


    // =========================================================================
    // Return
    // =========================================================================

    return {

        candidate,

        score,

        reasons
    };
}


// =============================================================================
// Compare candidate scores
// =============================================================================

export function compareCandidateScores(
    a: CandidateScore,
    b: CandidateScore
): number {

    // =========================================================================
    // Highest score first
    // =========================================================================

    if (
        b.score !==
        a.score
    ) {

        return (
            b.score -
            a.score
        );
    }


    // =========================================================================
    // Prefer validated candidates
    // =========================================================================

    const aValidated =
        hasValidatedPoliticalBoundary(
            a.candidate
        );

    const bValidated =
        hasValidatedPoliticalBoundary(
            b.candidate
        );

    if (
        aValidated !==
        bValidated
    ) {

        return aValidated
            ? -1
            : 1;
    }


    // =========================================================================
    // Prefer higher validation confidence
    // =========================================================================

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


    // =========================================================================
    // Prefer candidates that do not require review
    // =========================================================================

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

        return aRequiresReview
            ? 1
            : -1;
    }


    // =========================================================================
    // Prefer official municipal sources
    // =========================================================================

    const aOfficial =
        a.candidate
            .classification
            .officialMunicipalSource;

    const bOfficial =
        b.candidate
            .classification
            .officialMunicipalSource;

    if (
        aOfficial !==
        bOfficial
    ) {

        return aOfficial
            ? -1
            : 1;
    }


    // =========================================================================
    // Prefer FeatureServer
    // =========================================================================

    const aService =
        a.candidate
            .inspection
            .serviceType;

    const bService =
        b.candidate
            .inspection
            .serviceType;

    if (
        aService !==
        bService
    ) {

        return aService ===
            "FeatureServer"
            ? -1
            : 1;
    }


    // =========================================================================
    // Prefer explicit district field
    // =========================================================================

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

        return aField
            ? -1
            : 1;
    }


    // =========================================================================
    // Deterministic fallback
    // =========================================================================

    return (
        a.candidate.inspection.url
            .localeCompare(
                b.candidate.inspection.url
            )
    );
}


// =============================================================================
// Rank candidates
// =============================================================================

export function rankCandidates(
    candidates: InspectedCandidate[]
): CandidateScore[] {

    return candidates
        .map(
            scoreCandidate
        )
        .sort(
            compareCandidateScores
        );
}