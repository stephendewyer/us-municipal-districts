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
     * Discovery has three different concepts:
     *
     *     1. inspected
     *     2. accepted
     *     3. canonical
     *
     * An inspected candidate has reached the ArcGIS inspection stage.
     *
     * A rejected candidate was inspected but failed one of the downstream
     * validation gates.
     *
     * A valid candidate passed all required validation gates.
     *
     * The important invariant is:
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
     *
     * Rejection decisions are made by discover.ts. This function should
     * organize those results rather than independently reconstructing
     * rejection status.
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
        selectMunicipalityCanonicalSource(
            equivalentGroups
        );


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

        /*
         * `candidates` represents the candidates that reached inspection.
         *
         * It is intentionally equivalent to inspectedCandidates at this
         * stage. Search-result candidates that were discarded before
         * inspection should not be counted here.
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