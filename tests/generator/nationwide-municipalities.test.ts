import {
    describe,
    it
} from "node:test";

import assert from "node:assert/strict";

import type {
    DistrictType
} from "../../generator/src/types.js";


// =============================================================================
// Types
// =============================================================================

interface MunicipalityFixture {
    city: string;
    state: string;

    districtType: DistrictType;

    expectedDistrictCount?: number;

    expectedOfficialMunicipalSource?: boolean;

    expectedSourceRole?:
        | "authoritative"
        | "derived"
        | "duplicate"
        | "unknown";

    expectedTemporalStatus?:
        | "current"
        | "historical"
        | "undated";
}


// =============================================================================
// Municipality fixtures
// =============================================================================
//
// These fixtures represent different kinds of municipal political
// divisions that the nationwide discovery system must eventually support.
//
// IMPORTANT:
//
// This file should test representative municipal configurations.
// It should NOT become a collection of municipality-specific implementation
// rules.
//
// If a municipality requires a special-case implementation, that should be
// justified by the discovery/source architecture rather than added here
// simply to make a test pass.
//
// =============================================================================

const MUNICIPALITY_FIXTURES:
    MunicipalityFixture[] = [

        // ---------------------------------------------------------------------
        // Existing validated municipalities
        // ---------------------------------------------------------------------

        {
            city: "Tucson",
            state: "AZ",
            districtType: "ward",
            expectedDistrictCount: 6,
            expectedOfficialMunicipalSource: true,
            expectedSourceRole: "authoritative",
            expectedTemporalStatus: "undated"
        },

        {
            city: "Phoenix",
            state: "AZ",
            districtType: "council-district",
            expectedDistrictCount: 8,
            expectedOfficialMunicipalSource: true,
            expectedSourceRole: "authoritative",
            expectedTemporalStatus: "undated"
        },

        {
            city: "Chicago",
            state: "IL",
            districtType: "ward",
            expectedDistrictCount: 50,
            expectedOfficialMunicipalSource: true,
            expectedSourceRole: "authoritative",
            expectedTemporalStatus: "undated"
        },

        // ---------------------------------------------------------------------
        // New representative municipalities
        // ---------------------------------------------------------------------

        {
            city: "Milwaukee",
            state: "WI",
            districtType: "aldermanic-district"
        },

        {
            city: "Austin",
            state: "TX",
            districtType: "council-district"
        },

        {
            city: "Philadelphia",
            state: "PA",
            districtType: "ward"
        }
    ];


// =============================================================================
// Helpers
// =============================================================================

function describeMunicipality(
    fixture: MunicipalityFixture
): string {
    return `${fixture.city}, ${fixture.state} (${fixture.districtType})`;
}


// =============================================================================
// Fixture validation
// =============================================================================

describe(
    "nationwide municipality fixtures",
    () => {

        it(
            "contains unique municipality/district combinations",
            () => {

                const keys =
                    MUNICIPALITY_FIXTURES.map(
                        fixture =>
                            [
                                fixture.city
                                    .trim()
                                    .toLowerCase(),

                                fixture.state
                                    .trim()
                                    .toLowerCase(),

                                fixture.districtType
                            ].join("|")
                    );

                assert.equal(
                    new Set(keys).size,
                    keys.length
                );
            }
        );


        it(
            "contains valid state abbreviations",
            () => {

                for (
                    const fixture of
                    MUNICIPALITY_FIXTURES
                ) {

                    assert.match(
                        fixture.state,
                        /^[A-Za-z]{2}$/,
                        `Invalid state abbreviation for ${describeMunicipality(fixture)}`
                    );
                }
            }
        );


        it(
            "contains non-empty municipality names",
            () => {

                for (
                    const fixture of
                    MUNICIPALITY_FIXTURES
                ) {

                    assert.ok(
                        fixture.city.trim().length > 0,
                        `Missing city name for ${fixture.state}`
                    );
                }
            }
        );


        it(
            "contains positive expected district counts",
            () => {

                for (
                    const fixture of
                    MUNICIPALITY_FIXTURES
                ) {

                    if (
                        fixture.expectedDistrictCount !== undefined
                    ) {

                        assert.ok(
                            fixture.expectedDistrictCount > 0,
                            `Invalid district count for ${describeMunicipality(fixture)}`
                        );
                    }
                }
            }
        );
    }
);


// =============================================================================
// Coverage categories
// =============================================================================

describe(
    "nationwide municipality coverage",
    () => {

        it(
            "includes a ward-based municipality",
            () => {

                assert.ok(
                    MUNICIPALITY_FIXTURES.some(
                        fixture =>
                            fixture.districtType === "ward"
                    )
                );
            }
        );


        it(
            "includes a council-district municipality",
            () => {

                assert.ok(
                    MUNICIPALITY_FIXTURES.some(
                        fixture =>
                            fixture.districtType === "council-district"
                    )
                );
            }
        );


        it(
            "includes an aldermanic-district municipality",
            () => {

                assert.ok(
                    MUNICIPALITY_FIXTURES.some(
                        fixture =>
                            fixture.districtType ===
                            "aldermanic-district"
                    )
                );
            }
        );
    }
);