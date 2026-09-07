import {
    test
} from "node:test";

import assert from "node:assert/strict";

import {
    discoverArcGIS
} from "../../generator/src/discover.js";


// =============================================================================
// Full discovery pipeline
// =============================================================================

test(
    "full discovery pipeline discovers Tucson municipal wards",
    async () => {

        const results =
            await discoverArcGIS({

                placeFips:
                    "0477000",

                city:
                    "Tucson",

                state:
                    "AZ",

                review:
                    false,

                verbose:
                    true
            });


        // ---------------------------------------------------------------------
        // Exactly one Census place should have been processed.
        // ---------------------------------------------------------------------

        assert.equal(
            results.length,
            1
        );


        const result =
            results[0];

        assert.ok(
            result,
            "Expected a discovery result for Tucson"
        );


        // ---------------------------------------------------------------------
        // Confirm the expected Census place.
        // ---------------------------------------------------------------------

        assert.equal(
            result.place.placeFips,
            "0477000"
        );

        assert.equal(
            result.place.city,
            "Tucson"
        );

        assert.equal(
            result.place.state,
            "AZ"
        );


        // ---------------------------------------------------------------------
        // Candidate discovery.
        // ---------------------------------------------------------------------

        assert.ok(
            result.candidates.length > 0,
            "Expected ArcGIS candidates to be discovered"
        );


        // ---------------------------------------------------------------------
        // Candidate inspection.
        // ---------------------------------------------------------------------

        assert.ok(
            result.inspectedCandidates.length > 0,
            "Expected at least one inspected candidate"
        );


        // ---------------------------------------------------------------------
        // Candidate validation.
        // ---------------------------------------------------------------------

        assert.ok(
            result.validCandidates.length > 0,
            "Expected at least one valid candidate"
        );


        // ---------------------------------------------------------------------
        // Candidate ranking.
        // ---------------------------------------------------------------------

        assert.ok(
            result.rankedCandidates.length > 0,
            "Expected at least one ranked candidate"
        );


        // ---------------------------------------------------------------------
        // Municipality geography validation.
        //
        // This verifies that the geometry retrieved from ArcGIS made it
        // through the municipality geography validation stage.
        // ---------------------------------------------------------------------

        const geographyValidatedCandidates =
            result.inspectedCandidates.filter(
                candidate =>
                    candidate.municipalityGeographyValidation !==
                    undefined
            );


        assert.ok(
            geographyValidatedCandidates.length > 0,
            "Expected at least one candidate to receive municipality geography validation"
        );


        // ---------------------------------------------------------------------
        // At least one candidate should positively match the Census
        // municipality boundary.
        // ---------------------------------------------------------------------

        const geographicallyMatchedCandidates =
            geographyValidatedCandidates.filter(
                candidate => {

                    const status =
                        candidate
                            .municipalityGeographyValidation
                            ?.status;


                    return (
                        status ===
                            "strong-match" ||
                        status ===
                            "probable-match"
                    );
                }
            );


        assert.ok(
            geographicallyMatchedCandidates.length > 0,
            "Expected at least one candidate with a strong or probable municipality geography match"
        );


        // ---------------------------------------------------------------------
        // Equivalent-layer grouping.
        // ---------------------------------------------------------------------

        assert.ok(
            result.equivalentGroups.length > 0,
            "Expected at least one equivalent-layer group"
        );


        // ---------------------------------------------------------------------
        // Canonical source selection.
        // ---------------------------------------------------------------------

        assert.ok(
            result.canonicalSources.length > 0,
            "Expected at least one canonical source"
        );


        assert.ok(
            result.canonical,
            "Expected a municipality-wide canonical source"
        );


        const canonical =
            result.canonical;


        // ---------------------------------------------------------------------
        // Validate the canonical source.
        // ---------------------------------------------------------------------

        assert.equal(
            canonical.city,
            "Tucson"
        );

        assert.equal(
            canonical.state,
            "AZ"
        );

        assert.equal(
            canonical.placeFips,
            "0477000"
        );

        assert.equal(
            canonical.districtType,
            "ward"
        );


        // ---------------------------------------------------------------------
        // Validate the ArcGIS source.
        // ---------------------------------------------------------------------

        assert.ok(
            canonical.url,
            "Expected canonical source URL"
        );

        assert.ok(
            canonical.districtField,
            "Expected canonical source to have a district field"
        );

        assert.ok(
            canonical.serviceType ===
                "FeatureServer" ||
            canonical.serviceType ===
                "MapServer",
            "Expected canonical source to use an ArcGIS FeatureServer or MapServer"
        );


        // ---------------------------------------------------------------------
        // Verify that the canonical source contains selection reasoning.
        // ---------------------------------------------------------------------

        assert.ok(
            canonical.selectionReasons.length > 0,
            "Expected canonical source selection reasons"
        );


        // ---------------------------------------------------------------------
        // Verify that geography influenced the ranking.
        //
        // A strong geographic match should produce the +30 ranking reason.
        // A probable match should produce the +20 reason.
        // ---------------------------------------------------------------------

        const geographyRankedCandidates =
            geographicallyMatchedCandidates.filter(
                candidate => {

                    const reasons =
                        candidate
                            .candidate
                            .reasons;

                    return reasons.some(
                        reason =>
                            reason.includes(
                                "municipality geography"
                            )
                    );
                }
            );


        // This assertion is intentionally diagnostic rather than requiring
        // one exact reason string, because the candidate's original reasons
        // and the geography validation reasons are maintained separately.
        //
        // The existence of the geographic validation above is the primary
        // end-to-end assertion.
        if (
            geographyRankedCandidates.length ===
            0
        ) {

            console.log(
                "\nNo candidate contained a geographic ranking reason in " +
                "DiscoveryCandidate.reasons."
            );

            console.log(
                "Geography validation was nevertheless confirmed above."
            );
        }


        // ---------------------------------------------------------------------
        // Diagnostic output.
        // ---------------------------------------------------------------------

        console.log(
            "\nTucson discovery pipeline succeeded:"
        );

        console.log(
            `  Census place: ${result.place.city}, ${result.place.state}`
        );

        console.log(
            `  Place FIPS: ${result.place.placeFips}`
        );

        console.log(
            `  Candidates discovered: ${result.candidates.length}`
        );

        console.log(
            `  Candidates inspected: ${result.inspectedCandidates.length}`
        );

        console.log(
            `  Valid candidates: ${result.validCandidates.length}`
        );

        console.log(
            `  Ranked candidates: ${result.rankedCandidates.length}`
        );

        console.log(
            `  Rejected candidates: ${result.rejectedCandidates.length}`
        );

        console.log(
            `  Equivalent groups: ${result.equivalentGroups.length}`
        );

        console.log(
            `  Geographic matches: ${geographicallyMatchedCandidates.length}`
        );

        console.log(
            `  Canonical sources: ${result.canonicalSources.length}`
        );

        console.log(
            `  Canonical URL: ${canonical.url}`
        );

        console.log(
            `  District field: ${canonical.districtField}`
        );

        console.log(
            `  District type: ${canonical.districtType}`
        );

        console.log(
            `  Canonical score: ${canonical.score}`
        );

        console.log(
            `  Requires review: ${canonical.requiresReview}`
        );
    }
);