import test from "node:test";
import assert from "node:assert/strict";

import {
    getExpectedDistrictCount
} from "../../generator/src/expectedDistrictCount.js";

import type {
    DiscoveryCandidate
} from "../../generator/src/types.js";

// =============================================================================
// Test helpers
// =============================================================================

function createCandidate(
    city: string,
    state: string
): DiscoveryCandidate {
    return {
        placeFips: "0000000",
        city,
        state,
        url: "",
        score: 0,
        requiresReview: false,
        reasons: []
    };
}

// =============================================================================
// Phoenix
// =============================================================================

test(
    "returns 8 expected council districts for Phoenix",
    () => {

        const candidate =
            createCandidate(
                "Phoenix",
                "AZ"
            );

        const result =
            getExpectedDistrictCount(
                candidate,
                "council-district"
            );

        assert.deepEqual(
            result,
            {
                count: 8,
                source: "municipal-source",
                confidence: 100
            }
        );
    }
);


test(
    "returns 8 expected city council districts for Phoenix",
    () => {

        const candidate =
            createCandidate(
                "Phoenix",
                "AZ"
            );

        const result =
            getExpectedDistrictCount(
                candidate,
                "city-council-district"
            );

        assert.deepEqual(
            result,
            {
                count: 8,
                source: "municipal-source",
                confidence: 100
            }
        );
    }
);


// =============================================================================
// Tucson
// =============================================================================

test(
    "returns 6 expected wards for Tucson",
    () => {

        const candidate =
            createCandidate(
                "Tucson",
                "AZ"
            );

        const result =
            getExpectedDistrictCount(
                candidate,
                "ward"
            );

        assert.deepEqual(
            result,
            {
                count: 6,
                source: "municipal-source",
                confidence: 100
            }
        );
    }
);


// =============================================================================
// Unsupported combinations
// =============================================================================

test(
    "returns undefined for an unsupported district type",
    () => {

        const candidate =
            createCandidate(
                "Phoenix",
                "AZ"
            );

        const result =
            getExpectedDistrictCount(
                candidate,
                "ward"
            );

        assert.equal(
            result,
            undefined
        );
    }
);


test(
    "returns undefined for an unknown municipality",
    () => {

        const candidate =
            createCandidate(
                "Flagstaff",
                "AZ"
            );

        const result =
            getExpectedDistrictCount(
                candidate,
                "council-district"
            );

        assert.equal(
            result,
            undefined
        );
    }
);


test(
    "returns undefined when district type is undefined",
    () => {

        const candidate =
            createCandidate(
                "Phoenix",
                "AZ"
            );

        const result =
            getExpectedDistrictCount(
                candidate,
                undefined
            );

        assert.equal(
            result,
            undefined
        );
    }
);


// =============================================================================
// Municipality/state matching
// =============================================================================

test(
    "matches municipality and state case-insensitively",
    () => {

        const candidate =
            createCandidate(
                "PHOENIX",
                "az"
            );

        const result =
            getExpectedDistrictCount(
                candidate,
                "council-district"
            );

        assert.deepEqual(
            result,
            {
                count: 8,
                source: "municipal-source",
                confidence: 100
            }
        );
    }
);


// =============================================================================
// Independence from observed data
// =============================================================================

test(
    "returns the independent expected count without observed district data",
    () => {

        const candidate =
            createCandidate(
                "Phoenix",
                "AZ"
            );

        /*
         * The resolver receives no featureCount or
         * distinctDistrictValues.
         *
         * Therefore the returned count cannot be inferred
         * from the discovered ArcGIS dataset.
         */
        const result =
            getExpectedDistrictCount(
                candidate,
                "council-district"
            );

        assert.equal(
            result?.count,
            8
        );
    }
);