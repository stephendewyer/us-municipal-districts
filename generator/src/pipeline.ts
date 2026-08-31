import type {
    CensusPlace,
    CandidateScore,
    CanonicalSource,
    DiscoveryResult,
    InspectedCandidate
} from "./types.js";


import {
    detectEquivalentLayers
} from "./equivalence.js";


import {
    rankCandidates
} from "./rank.js";


import {
    selectCanonicalSources,
    compareCanonicalSources
} from "./canonical.js";


// =============================================================================
// Options
// =============================================================================

export interface PipelineOptions {

    /**
     * Force canonical sources to require manual review.
     */
    review?: boolean;

    /**
     * Similarity required for two layers to be considered equivalent.
     */
    equivalenceThreshold?: number;
}


// =============================================================================
// Constants
// =============================================================================

const DEFAULT_EQUIVALENCE_THRESHOLD = 0.60;


// =============================================================================
// Build discovery result
// =============================================================================

export function buildDiscoveryResult(
    place: CensusPlace,
    candidates: InspectedCandidate[],
    options: PipelineOptions = {}
): DiscoveryResult {

    /*
     * Discovery has three different concepts:
     *
     * 1. inspected
     * 2. accepted
     * 3. canonical
     *
     * Classification says:
     *
     *     "This looks promising."
     *
     * Validation says:
     *
     *     "The actual feature data supports that conclusion."
     *
     * Only candidates that pass BOTH classification and validation
     * should become valid registry candidates.
     */

    const inspectedCandidates =
        candidates;


    // =========================================================================
    // Valid candidates
    // =========================================================================

    const validCandidates =
        inspectedCandidates.filter(
            candidate =>
                isValidatedPoliticalBoundary(
                    candidate
                )
        );


    // =========================================================================
    // Rejected candidates
    // =========================================================================

    const rejectedCandidates =
        inspectedCandidates.filter(
            candidate =>
                !isValidatedPoliticalBoundary(
                    candidate
                )
        );


    // =========================================================================
    // Rank valid candidates
    // =========================================================================

    const rankedCandidates:
        CandidateScore[] =
        rankCandidates(
            validCandidates
        );


    // =========================================================================
    // Detect equivalent layers
    // =========================================================================

    const equivalentGroups =
        detectEquivalentLayers(
            validCandidates,
            options.equivalenceThreshold ??
            DEFAULT_EQUIVALENCE_THRESHOLD
        );


    // =========================================================================
    // Select canonical source for every equivalence group
    // =========================================================================

    let canonicalSources:
        CanonicalSource[] =
        selectCanonicalSources(
            equivalentGroups
        );


    // =========================================================================
    // Apply manual review
    // =========================================================================

    if (
        options.review
    ) {

        canonicalSources =
            canonicalSources.map(
                source => ({
                    ...source,

                    requiresReview:
                        true
                })
            );
    }


    // =========================================================================
    // Select municipality-wide canonical source
    // =========================================================================

    const canonical =
        canonicalSources.length > 0
            ? [
                ...canonicalSources
            ].sort(
                compareCanonicalSources
            )[0]
            : undefined;


    // =========================================================================
    // Apply review to municipality-wide canonical
    // =========================================================================

    const reviewedCanonical =
        canonical &&
        options.review
            ? {
                ...canonical,

                requiresReview:
                    true
            }
            : canonical;


    // =========================================================================
    // Return
    // =========================================================================

    return {

        place,

        candidates:
            inspectedCandidates.map(
                candidate =>
                    candidate.candidate
            ),

        inspectedCandidates,

        validCandidates,

        rankedCandidates,

        rejectedCandidates,

        equivalentGroups,

        canonicalSources,

        canonical:
            reviewedCanonical
    };
}


// =============================================================================
// Validation gate
// =============================================================================

/**
 * Determine whether an inspected candidate is strong enough to enter
 * the political-boundary pipeline.
 *
 * This is intentionally stricter than classification.
 *
 * In particular:
 *
 *     WARD field
 *     DISTRICT field
 *
 * are NOT sufficient by themselves.
 *
 * A thematic layer can legitimately contain those fields. For example,
 * a parks or recreation dataset may include the ward in which a facility
 * is located. That does not make the dataset a ward-boundary layer.
 */
function isValidatedPoliticalBoundary(
    candidate: InspectedCandidate
): boolean {

    const classification =
        candidate.classification;

    const validation =
        candidate.validation;


    // =========================================================================
    // 1. Classifier gate
    // =========================================================================

    if (
        !classification.isPoliticalBoundary
    ) {
        return false;
    }


    // =========================================================================
    // 2. Explicit negative dataset gate
    // =========================================================================

    /*
     * These classifications are strong evidence that the dataset is
     * not itself a political-boundary layer.
     *
     * We intentionally inspect both the boolean classifications and
     * the underlying thematic matches.
     */
    if (
        classification.isCensusDataset ||
        classification.isParcelDataset ||
        classification.isHousingDataset
    ) {
        return false;
    }


    // =========================================================================
    // 3. Thematic contamination gate
    // =========================================================================

    /*
     * A thematic dataset can contain a field called WARD or DISTRICT.
     *
     * Example:
     *
     *     TPRD_TRACK_AND_FIELD
     *
     * contains WARD and DISTRICT fields, but it represents recreation
     * facilities rather than ward boundaries.
     *
     * Do not allow a candidate with strong thematic evidence to pass
     * solely because it has political-looking fields.
     *
     * Explicit political identity is allowed to coexist with thematic
     * metadata because legitimate political layers sometimes have
     * descriptions containing words such as "project" or "maintenance".
     */
    const thematicMatches =
        candidate.classification.matches
            .thematic ?? [];

    const explicitPoliticalMatches =
        candidate.classification.matches
            .political ?? [];

    const hasThematicEvidence =
        thematicMatches.length > 0;

    const hasStrongPoliticalIdentity =
        explicitPoliticalMatches.length > 0;


    if (
        hasThematicEvidence &&
        !hasStrongPoliticalIdentity
    ) {
        return false;
    }


    // =========================================================================
    // 4. Validation is mandatory
    // =========================================================================

    if (
        !validation
    ) {
        return false;
    }


    if (
        !validation.isLikelyPoliticalBoundary
    ) {
        return false;
    }


    // =========================================================================
    // 5. Confidence floor
    // =========================================================================

    if (
        validation.confidence < 60
    ) {
        return false;
    }


    // =========================================================================
    // 6. Polygon requirement
    // =========================================================================

    const polygon =
        validation.geometryType ===
            "esriGeometryPolygon" ||
        validation.geometryType ===
            "polygon";

    if (
        !polygon
    ) {
        return false;
    }


    // =========================================================================
    // 7. Multiple actual district values
    // =========================================================================

    if (
        validation.distinctDistrictValues.length < 2
    ) {
        return false;
    }


    // =========================================================================
    // 8. Usable district field
    // =========================================================================

    if (
        !validation.districtField
    ) {
        return false;
    }


    // =========================================================================
    // 9. District type
    // =========================================================================

    if (
        !classification.districtType
    ) {
        return false;
    }


    return true;
}