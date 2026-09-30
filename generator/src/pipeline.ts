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
    selectMunicipalityCanonicalSource
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

    /**
     * Known Census places used for municipality geography validation.
     */
    knownPlaces?: CensusPlace[];
}


// =============================================================================
// Constants
// =============================================================================

const DEFAULT_EQUIVALENCE_THRESHOLD = 0.60;


// =============================================================================
// Candidate identity
// =============================================================================

/**
 * Generate a stable identity for an inspected candidate.
 *
 * Candidates may pass through several stages of the discovery pipeline,
 * so bookkeeping should not depend exclusively on object identity.
 */
function candidateKey(
    candidate: InspectedCandidate
): string {

    return [
        candidate.candidate.url,
        candidate.inspection.url,
        candidate.inspection.itemId,
        candidate.inspection.serviceUrl,
        candidate.inspection.layerId
    ]
        .filter(
            value =>
                value !== undefined &&
                value !== null
        )
        .join("|");
}


// =============================================================================
// Build discovery result
// =============================================================================

export function buildDiscoveryResult(
    place: CensusPlace,
    candidates: InspectedCandidate[],
    rejectedCandidates: InspectedCandidate[] = [],
    options: PipelineOptions = {}
): DiscoveryResult {

    /*
     * =========================================================================
     * Discovery bookkeeping
     * =========================================================================
     *
     * Discovery has three distinct concepts:
     *
     *     1. inspected
     *     2. valid
     *     3. canonical
     *
     * An inspected candidate has reached the ArcGIS inspection stage.
     *
     * A rejected candidate was inspected but failed one or more downstream
     * validation gates.
     *
     * A valid candidate passed the required validation gates.
     *
     * Rejection decisions are made by discover.ts.
     *
     * This function organizes those results and performs the later
     * candidate-ranking / equivalence / canonical-selection stages.
     *
     * Invariant:
     *
     *     inspectedCandidates
     *         ├── rejectedCandidates
     *         └── validCandidates
     *
     * Therefore:
     *
     *     rejectedCandidates ⊆ inspectedCandidates
     *
     * and:
     *
     *     validCandidates ∩ rejectedCandidates = ∅
     */

    const inspectedCandidates =
        candidates;


    // =========================================================================
    // Rejected candidates
    // =========================================================================

    const rejectedKeys =
        new Set(
            rejectedCandidates.map(
                candidate =>
                    candidateKey(candidate)
            )
        );


    // =========================================================================
    // Valid candidates
    // =========================================================================
    //
    // discover.ts has already made the validation/rejection decision.
    //
    // buildDiscoveryResult() therefore does not independently determine
    // whether a candidate is valid.
    //

    const validCandidates =
        inspectedCandidates.filter(
            candidate =>
                !rejectedKeys.has(
                    candidateKey(candidate)
                )
        );


    // =========================================================================
    // Rank valid candidates
    // =========================================================================
    //
    // Ranking is performed only after rejection.
    //
    // Rejected candidates must never influence canonical selection.
    //

    const rankedCandidates:
        CandidateScore[] =
        rankCandidates(
            validCandidates
        );


    // =========================================================================
    // Detect equivalent layers
    // =========================================================================
    //
    // Equivalence is evaluated only among valid candidates.
    //
    // Candidates with different districtType values must never be placed
    // into the same equivalence group.
    //
    // For example:
    //
    //     ward
    //     council-district
    //
    // must remain separate groups even if their geometries, fields, or
    // metadata happen to look similar.
    //

    const equivalentGroups =
        detectEquivalentLayers(
            validCandidates,
            options.equivalenceThreshold ??
            DEFAULT_EQUIVALENCE_THRESHOLD
        );


    // =========================================================================
    // Select canonical source for each equivalence group
    // =========================================================================
    //
    // This produces one canonical source per distinct municipal district
    // system represented by the discovered data.
    //
    // Example:
    //
    //     Group 1 → ward
    //         → current authoritative ward boundary
    //
    //     Group 2 → council-district
    //         → current authoritative council district boundary
    //
    // Both may legitimately exist for the same municipality.
    //

    let canonicalSources:
        CanonicalSource[] =
        selectCanonicalSources(
            equivalentGroups
        );


    // =========================================================================
    // Select municipality-level canonical source
    // =========================================================================
    //
    // This is intentionally separate from canonicalSources.
    //
    // canonicalSources:
    //     one canonical source per equivalence group
    //
    // canonical:
    //     one canonical source for the municipality as a whole
    //
    // selectMunicipalityCanonicalSource() performs the cross-group
    // comparison using source role, official municipal status, temporal
    // priority, municipal-service priority, canonical-source bonuses,
    // and candidate ranking.
    //

    const canonical =
        selectMunicipalityCanonicalSource(
            equivalentGroups
        );


    // =========================================================================
    // Apply manual review
    // =========================================================================
    //
    // Review is a presentation/selection-state override.
    //
    // It does not change which candidate was selected, its score, or the
    // underlying validation results.
    //

    const reviewedCanonical =
        canonical &&
        options.review
            ? {
                ...canonical,
                requiresReview: true
            }
            : canonical;


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
    // Return
    // =========================================================================

    return {

        place,

        /*
         * `candidates` represents candidates that reached inspection.
         *
         * Search-result candidates discarded before inspection are not
         * represented here.
         */
        candidates:
            inspectedCandidates.map(
                candidate =>
                    candidate.candidate
            ),

        inspectedCandidates,

        validCandidates,

        rejectedCandidates,

        rankedCandidates,

        equivalentGroups,

        canonicalSources,

        canonical:
            reviewedCanonical
    };
}