// generator/src/dedupe.ts

import type {
    EquivalentLayerGroup,
    InspectedCandidate,
    LayerFingerprint
} from "./types.js";

import {
    compareCandidates,
    createLayerFingerprint,
    detectEquivalentLayers,
    groupEquivalentCandidates
} from "./equivalence.js";


// =============================================================================
// Public compatibility API
// =============================================================================

export {

    compareCandidates,

    createLayerFingerprint,

    detectEquivalentLayers,

    groupEquivalentCandidates

};


// =============================================================================
// Deduplication
// =============================================================================

/**
 * Deduplicate inspected political-boundary candidates.
 *
 * This function intentionally delegates all equivalence logic to
 * equivalence.ts so there is only one equivalence implementation.
 */
export function dedupeCandidates(
    candidates: InspectedCandidate[]
): EquivalentLayerGroup[] {

    return detectEquivalentLayers(
        candidates
    );
}


// =============================================================================
// Type compatibility
// =============================================================================

export type {
    LayerFingerprint
};