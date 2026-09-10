import assert from "node:assert/strict";
import test from "node:test";

import {
    lookupMunicipalDistrict
} from "../../src/lookup.js";


// =============================================================================
// Tucson constants
// =============================================================================

const TUCSON_PLACE_FIPS =
    "0477000";


// =============================================================================
// Verified Tucson address fixtures
// =============================================================================

/*
 * These fixtures represent one real Tucson address in each municipal ward.
 *
 * The City of Tucson identifies the ward assignments for its municipal
 * addresses through its ward information and Property Research Online (PRO)
 * system.
 *
 * Coordinates are stored as deterministic test fixtures. They are not
 * dynamically geocoded during the test.
 */
const VERIFIED_ADDRESSES = [

    {
        address:
            "940 W Alameda St, Tucson, AZ 85745",

        ward:
            "Ward 1",

        latitude:
            32.2220,

        longitude:
            -110.9859
    },

    {
        address:
            "7575 E Speedway Blvd, Tucson, AZ 85710",

        ward:
            "Ward 2",

        latitude:
            32.2370698,

        longitude:
            -110.8305556
    },

    {
        address:
            "1510 E Grant Rd, Tucson, AZ 85719",

        ward:
            "Ward 3",

        latitude:
            32.2507,

        longitude:
            -110.9454
    },

    {
        address:
            "8123 E Poinciana Dr, Tucson, AZ 85730",

        ward:
            "Ward 4",

        latitude:
            32.1776,

        longitude:
            -110.8235
    },

    {
        /*
         * The previous Ward 5 fixture used an approximate coordinate
         * that actually fell inside Ward 1.
         *
         * This fixture uses the City of Tucson PRO record for
         * 3601 S Park Ave, which is identified as Ward 5 and provides
         * the coordinate:
         *
         *   latitude:  32.18064
         *   longitude: -110.95545
         */
        address:
            "3601 S Park Ave, Tucson, AZ 85713",

        ward:
            "Ward 5",

        latitude:
            32.18064,

        longitude:
            -110.95545
    },

    {
        address:
            "3202 E 1st St, Tucson, AZ 85716",

        ward:
            "Ward 6",

        latitude:
            32.2368,

        longitude:
            -110.9224
    }

] as const;


// =============================================================================
// Address accuracy tests
// =============================================================================

for (
    const testCase
    of VERIFIED_ADDRESSES
) {

    test(
        `${testCase.address} resolves to Tucson ${testCase.ward}`,
        () => {

            const result =
                lookupMunicipalDistrict({

                    latitude:
                        testCase.latitude,

                    longitude:
                        testCase.longitude,

                    city:
                        "Tucson",

                    state:
                        "AZ"
                });


            // -----------------------------------------------------------------
            // The point must resolve successfully.
            // -----------------------------------------------------------------

            assert.equal(
                result.found,
                true,
                `Expected ${testCase.address} to resolve to a Tucson ward.`
            );


            // -----------------------------------------------------------------
            // A district must be returned.
            // -----------------------------------------------------------------

            assert.ok(
                result.district,
                `Expected a district for ${testCase.address}.`
            );


            // -----------------------------------------------------------------
            // The result must belong to Tucson.
            // -----------------------------------------------------------------

            assert.equal(
                result.district?.city,
                "Tucson"
            );

            assert.equal(
                result.district?.state,
                "AZ"
            );

            assert.equal(
                result.district?.placeFips,
                TUCSON_PLACE_FIPS
            );

            assert.equal(
                result.district?.boundaryType,
                "ward"
            );


            // -----------------------------------------------------------------
            // Most important accuracy assertion.
            // -----------------------------------------------------------------

            assert.equal(
                result.district?.district,
                testCase.ward,
                `Expected ${testCase.address} to resolve to ${testCase.ward}, ` +
                `but got ${result.district?.district ?? "no district"}.`
            );


            // -----------------------------------------------------------------
            // Lookup must preserve the supplied coordinates.
            // -----------------------------------------------------------------

            assert.equal(
                result.coordinates.latitude,
                testCase.latitude
            );

            assert.equal(
                result.coordinates.longitude,
                testCase.longitude
            );
        }
    );
}


// =============================================================================
// Coverage test
// =============================================================================

test(
    "Tucson accuracy fixtures cover all six wards",
    () => {

        const expectedWards = [
            "Ward 1",
            "Ward 2",
            "Ward 3",
            "Ward 4",
            "Ward 5",
            "Ward 6"
        ];

        const fixtureWards =
            VERIFIED_ADDRESSES
                .map(
                    testCase =>
                        testCase.ward
                )
                .sort();

        assert.deepEqual(
            fixtureWards,
            expectedWards
        );
    }
);


// =============================================================================
// Distinct lookup test
// =============================================================================

test(
    "Tucson verified addresses resolve to six distinct wards",
    () => {

        const resolvedWards =
            VERIFIED_ADDRESSES.map(
                testCase => {

                    const result =
                        lookupMunicipalDistrict({

                            latitude:
                                testCase.latitude,

                            longitude:
                                testCase.longitude,

                            city:
                                "Tucson",

                            state:
                                "AZ"
                        });


                    assert.equal(
                        result.found,
                        true,
                        `Expected ${testCase.address} to resolve.`
                    );


                    assert.ok(
                        result.district,
                        `Expected a district for ${testCase.address}.`
                    );


                    return result.district?.district;
                }
            );


        // ---------------------------------------------------------------------
        // All six fixtures must resolve to different wards.
        // ---------------------------------------------------------------------

        assert.equal(
            new Set(
                resolvedWards
            ).size,
            6
        );


        // ---------------------------------------------------------------------
        // The six resolved values must be exactly the six Tucson wards.
        // ---------------------------------------------------------------------

        assert.deepEqual(
            [...resolvedWards].sort(),
            [
                "Ward 1",
                "Ward 2",
                "Ward 3",
                "Ward 4",
                "Ward 5",
                "Ward 6"
            ]
        );
    }
);