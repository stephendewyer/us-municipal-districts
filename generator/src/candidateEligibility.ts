import type {
    InspectedCandidate
} from "./types.js";

// =============================================================================
// Types
// =============================================================================

export type EligibilityFailureCode =
    | "classification-rejected"
    | "non-polygon"
    | "not-municipal-political-boundary"
    | "missing-validation"
    | "political-validation-failed"
    | "insufficient-validation-confidence"
    | "missing-district-field"
    | "strong-negative-evidence"
    | "multiple-municipalities"
    | "wrong-municipality";

export interface EligibilityFailure {
    code: EligibilityFailureCode;
    reason: string;
}

export interface CandidateEligibility {
    eligible: boolean;
    failures: EligibilityFailure[];
}

// =============================================================================
// Geometry
// =============================================================================

function isPolygon(
    candidate: InspectedCandidate
): boolean {
    const geometryType =
        candidate.inspection.geometryType;

    return (
        geometryType === "esriGeometryPolygon" ||
        geometryType === "polygon"
    );
}

// =============================================================================
// Classification
// =============================================================================

function checkClassification(
    candidate: InspectedCandidate
): EligibilityFailure | undefined {

    if (
        candidate.classification.rejected
    ) {
        return {
            code: "classification-rejected",
            reason:
                "candidate rejected by classification"
        };
    }

    return undefined;
}

// =============================================================================
// Geometry
// =============================================================================

function checkGeometry(
    candidate: InspectedCandidate
): EligibilityFailure | undefined {

    if (!isPolygon(candidate)) {
        return {
            code: "non-polygon",
            reason:
                "candidate is not polygon geometry"
        };
    }

    return undefined;
}

// =============================================================================
// Political boundary classification
// =============================================================================

function checkMunicipalPoliticalBoundary(
    candidate: InspectedCandidate
): EligibilityFailure | undefined {

    if (
        !candidate.classification
            .isMunicipalPoliticalBoundary
    ) {
        return {
            code:
                "not-municipal-political-boundary",
            reason:
                "candidate is not classified as a " +
                "municipal political boundary"
        };
    }

    return undefined;
}

// =============================================================================
// Political-boundary validation
// =============================================================================

function checkPoliticalValidation(
    candidate: InspectedCandidate
): EligibilityFailure | undefined {

    const validation =
        candidate.validation;

    if (!validation) {
        return {
            code: "missing-validation",
            reason:
                "candidate has no political-boundary validation"
        };
    }

    if (
        !validation.isLikelyPoliticalBoundary
    ) {
        return {
            code: "political-validation-failed",
            reason:
                "candidate failed political-boundary validation"
        };
    }

    if (
        validation.confidence < 60
    ) {
        return {
            code:
                "insufficient-validation-confidence",
            reason:
                `political-boundary validation confidence ` +
                `${validation.confidence} is below 60`
        };
    }

    if (
        !validation.districtField
    ) {
        return {
            code: "missing-district-field",
            reason:
                "candidate has no validated district field"
        };
    }

    if (
        validation.geometryType !==
            "esriGeometryPolygon" &&
        validation.geometryType !==
            "polygon"
    ) {
        return {
            code: "non-polygon",
            reason:
                "validated candidate is not polygon geometry"
        };
    }

    return undefined;
}

// =============================================================================
// Negative evidence
// =============================================================================

function checkNegativeEvidence(
    candidate: InspectedCandidate
): EligibilityFailure | undefined {

    const classification =
        candidate.classification;

    const political =
        classification.matches.political ?? [];

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
        return {
            code: "strong-negative-evidence",
            reason:
                "candidate contains strong " +
                "non-political dataset evidence"
        };
    }

    const thematic =
        classification.matches.thematic ?? [];

    if (
        !hasPoliticalIdentity &&
        thematic.length > 0
    ) {
        return {
            code: "strong-negative-evidence",
            reason:
                "candidate contains strong thematic " +
                "dataset evidence without political identity"
        };
    }

    return undefined;
}

// =============================================================================
// District / municipality scope
// =============================================================================

function checkDistrictMunicipalityScope(
    candidate: InspectedCandidate
): EligibilityFailure | undefined {

    const validation =
        candidate.districtMunicipalityValidation;

    if (!validation) {
        return undefined;
    }

    if (
        validation.spansMultipleMunicipalities
    ) {
        return {
            code: "multiple-municipalities",
            reason:
                "district values span multiple municipalities"
        };
    }

    return undefined;
}

// =============================================================================
// Eligibility
// =============================================================================

export function evaluateCandidateEligibility(
    candidate: InspectedCandidate
): CandidateEligibility {

    const failures: EligibilityFailure[] = [];

    const checks = [
        checkClassification(candidate),
        checkGeometry(candidate),
        checkMunicipalPoliticalBoundary(candidate),
        checkPoliticalValidation(candidate),
        checkNegativeEvidence(candidate),
        checkDistrictMunicipalityScope(candidate)
    ];

    for (const failure of checks) {
        if (failure) {
            failures.push(failure);
        }
    }

    return {
        eligible: failures.length === 0,
        failures
    };
}