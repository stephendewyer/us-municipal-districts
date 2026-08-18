import type {
    CensusPlace,
    DiscoveryResult,
    InspectedCandidate,
    CandidateScore
} from "./types.js";

import {
    detectEquivalentLayers
} from "./equivalence.js";

import {
    scoreCandidate,
    selectMunicipalityCanonicalSource
} from "./canonical.js";


// =============================================================================
// Build one DiscoveryResult for one municipality
// =============================================================================

export function buildDiscoveryResult(
    place: CensusPlace,
    candidates: InspectedCandidate[]
): DiscoveryResult {

    // =========================================================================
    // Inspected candidates
    // =========================================================================
    //
    // `candidates` is already an InspectedCandidate[].
    //
    // Keep the original array as the inspected candidate collection.
    //

    const inspectedCandidates =
        candidates;


    // =========================================================================
    // Valid candidates
    // =========================================================================

    const validCandidates =
        inspectedCandidates.filter(
            candidate =>
                !candidate.classification.rejected
        );


    // =========================================================================
    // Rejected candidates
    // =========================================================================

    const rejectedCandidates =
        inspectedCandidates.filter(
            candidate =>
                candidate.classification.rejected
        );


    // =========================================================================
    // Ranked candidates
    // =========================================================================

    const rankedCandidates:
        CandidateScore[] =
        validCandidates
            .map(
                candidate =>
                    scoreCandidate(
                        candidate
                    )
            )
            .sort(
                (a, b) =>
                    b.score - a.score
            );


    // =========================================================================
    // Equivalent groups
    // =========================================================================

    const equivalentGroups =
        detectEquivalentLayers(
            validCandidates
        );


    // =========================================================================
    // Canonical source
    // =========================================================================

    const canonical =
        selectMunicipalityCanonicalSource(
            equivalentGroups
        );


    // =========================================================================
    // Discovery result
    // =========================================================================

    return {

        place,

        /*
         * DiscoveryResult.candidates represents the ORIGINAL
         * search candidates, before inspection/classification.
         *
         * InspectedCandidate wraps the original DiscoveryCandidate
         * inside `.candidate`.
         */
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

        canonical
    };
}