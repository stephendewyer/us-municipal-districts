import { test } from "node:test";
import assert from "node:assert/strict";

import { discoverArcGIS } from "../../generator/src/discover.js";
import type {
    DistrictType,
    DiscoveryResult,
    InspectedCandidate
} from "../../generator/src/types.js";

// =============================================================================
// Configuration
// =============================================================================

interface MunicipalityFixture {
    city: string;
    state: string;
    districtType: DistrictType;
    expectedDistrictCount?: number;
}

const MUNICIPALITY_FIXTURES: MunicipalityFixture[] = [
    {
        city: "Tucson",
        state: "AZ",
        districtType: "ward",
        expectedDistrictCount: 6
    },
    {
        city: "Phoenix",
        state: "AZ",
        districtType: "council-district",
        expectedDistrictCount: 8
    },
    {
        city: "Chicago",
        state: "IL",
        districtType: "ward",
        expectedDistrictCount: 50
    },
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

const RUN_NATIONWIDE_DISCOVERY =
    process.env.RUN_NATIONWIDE_DISCOVERY === "1";

const DISCOVERY_CITY =
    process.env.DISCOVERY_CITY?.trim();

const DISCOVERY_STATE =
    process.env.DISCOVERY_STATE?.trim().toUpperCase();

// =============================================================================
// Helpers
// =============================================================================

function describeMunicipality(
    fixture: MunicipalityFixture
): string {
    return `${fixture.city}, ${fixture.state} (${fixture.districtType})`;
}

function getSuccessfulResult(
    results: DiscoveryResult[],
    fixture: MunicipalityFixture
): DiscoveryResult {
    assert.ok(
        results.length > 0,
        `${describeMunicipality(fixture)} should return a discovery result`
    );

    const result = results[0];

    assert.ok(
        result,
        `${describeMunicipality(fixture)} should have a discovery result`
    );

    return result;
}

function getCanonicalCandidate(
    result: DiscoveryResult,
    fixture: MunicipalityFixture
): InspectedCandidate {
    assert.ok(
        result.canonical,
        `${describeMunicipality(fixture)} should have a canonical source`
    );

    const canonicalUrl =
        result.canonical.url;

    const candidate =
        result.inspectedCandidates.find(
            inspectedCandidate =>
                inspectedCandidate.inspection.url ===
                canonicalUrl
        );

    assert.ok(
        candidate,
        `${describeMunicipality(fixture)} canonical source should map to an inspected candidate`
    );

    return candidate;
}

function getFixturesToRun(): MunicipalityFixture[] {
    /*
     * A specific city/state takes precedence over nationwide mode.
     *
     * This makes local development fast:
     *
     * DISCOVERY_CITY=Phoenix DISCOVERY_STATE=AZ \
     * npm run test:integration
     */
    if (DISCOVERY_CITY) {
        const state =
            DISCOVERY_STATE;

        assert.ok(
            state,
            "DISCOVERY_STATE must be provided when DISCOVERY_CITY is provided"
        );

        const fixture =
            MUNICIPALITY_FIXTURES.find(
                candidate =>
                    candidate.city.toLowerCase() ===
                        DISCOVERY_CITY.toLowerCase() &&
                    candidate.state === state
            );

        if (fixture) {
            return [fixture];
        }

        /*
         * Allow development against a municipality that has not yet
         * been added to the nationwide fixture matrix.
         */
        return [
            {
                city: DISCOVERY_CITY,
                state,
                districtType:
                    "municipal-district"
            }
        ];
    }

    /*
     * Nationwide discovery is deliberately opt-in because it performs
     * expensive live ArcGIS discovery for every fixture.
     */
    if (RUN_NATIONWIDE_DISCOVERY) {
        return MUNICIPALITY_FIXTURES;
    }

    return [];
}

// =============================================================================
// Live discovery
// =============================================================================

const fixturesToRun =
    getFixturesToRun();

if (fixturesToRun.length === 0) {
    test(
        "nationwide discovery is skipped unless explicitly enabled",
        () => {
            assert.equal(
                RUN_NATIONWIDE_DISCOVERY,
                false
            );

            assert.equal(
                DISCOVERY_CITY,
                undefined
            );
        }
    );
} else {
    for (const fixture of fixturesToRun) {
        test(
            `discovers ${describeMunicipality(fixture)}`,
            async () => {
                const results =
                    await discoverArcGIS({
                        city: fixture.city,
                        state: fixture.state
                    });

                const result =
                    getSuccessfulResult(
                        results,
                        fixture
                    );

                // =============================================================
                // Canonical source
                // =============================================================

                assert.ok(
                    result.canonical,
                    `${describeMunicipality(fixture)} should have a canonical source`
                );

                assert.equal(
                    result.canonical.districtType,
                    fixture.districtType,
                    `${describeMunicipality(fixture)} should select the expected district type`
                );

                assert.equal(
                    result.canonical.officialMunicipalSource,
                    true,
                    `${describeMunicipality(fixture)} should select an official municipal source`
                );

                assert.ok(
                    result.canonical.url,
                    `${describeMunicipality(fixture)} canonical source should have a URL`
                );

                assert.ok(
                    result.canonical.title,
                    `${describeMunicipality(fixture)} canonical source should have a title`
                );

                assert.ok(
                    result.canonical.districtField,
                    `${describeMunicipality(fixture)} canonical source should have a district field`
                );

                // =============================================================
                // Underlying inspected candidate
                // =============================================================

                const canonicalCandidate =
                    getCanonicalCandidate(
                        result,
                        fixture
                    );

                assert.equal(
                    canonicalCandidate.classification.isPoliticalBoundary,
                    true,
                    `${describeMunicipality(fixture)} canonical candidate should be classified as a political boundary`
                );

                assert.equal(
                    canonicalCandidate.classification.officialMunicipalSource,
                    true,
                    `${describeMunicipality(fixture)} canonical candidate should be an official municipal source`
                );

                assert.equal(
                    canonicalCandidate.classification.districtType,
                    fixture.districtType,
                    `${describeMunicipality(fixture)} inspected candidate should have the expected district type`
                );

                assert.equal(
                    canonicalCandidate.classification.sourceRole,
                    "authoritative",
                    `${describeMunicipality(fixture)} canonical candidate should be authoritative`
                );

                // =============================================================
                // Geometry
                // =============================================================

                assert.ok(
                    canonicalCandidate.inspection.geometryType,
                    `${fixture.city}, ${fixture.state}: canonical candidate has no geometry type`
                );

                // =============================================================
                // Validation
                // =============================================================

                if (
                    fixture.expectedDistrictCount !==
                    undefined
                ) {
                    assert.ok(
                        canonicalCandidate.validation,
                        `${describeMunicipality(fixture)} should have validation data`
                    );

                    assert.equal(
                        canonicalCandidate.validation
                            .distinctDistrictValues.length,
                        fixture.expectedDistrictCount,
                        `${describeMunicipality(fixture)} should contain the expected number of districts`
                    );

                    assert.equal(
                        canonicalCandidate.validation
                            .completeDistrictCoverage,
                        true,
                        `${describeMunicipality(fixture)} should have complete district coverage`
                    );

                    assert.equal(
                        canonicalCandidate.validation
                            .expectedDistrictCount,
                        fixture.expectedDistrictCount,
                        `${describeMunicipality(fixture)} validation should use the expected district count`
                    );
                }
            }
        );
    }
}

// =============================================================================
// Fixture matrix tests
// =============================================================================

test(
    "nationwide municipality matrix covers multiple municipal district types",
    () => {
        const districtTypes =
            new Set(
                MUNICIPALITY_FIXTURES.map(
                    fixture =>
                        fixture.districtType
                )
            );

        assert.ok(
            districtTypes.has("ward"),
            "nationwide matrix should include a ward-based municipality"
        );

        assert.ok(
            districtTypes.has("council-district"),
            "nationwide matrix should include a council-district municipality"
        );

        assert.ok(
            districtTypes.has("aldermanic-district"),
            "nationwide matrix should include an aldermanic-district municipality"
        );
    }
);

test(
    "nationwide municipality matrix has unique city/state/district combinations",
    () => {
        const keys =
            MUNICIPALITY_FIXTURES.map(
                fixture =>
                    [
                        fixture.city.toLowerCase(),
                        fixture.state.toUpperCase(),
                        fixture.districtType
                    ].join("|")
            );

        assert.equal(
            new Set(keys).size,
            keys.length,
            "nationwide municipality matrix should not contain duplicate city/state/district combinations"
        );
    }
);

test(
    "nationwide municipality matrix uses valid state abbreviations",
    () => {
        for (const fixture of MUNICIPALITY_FIXTURES) {
            assert.match(
                fixture.state,
                /^[A-Z]{2}$/,
                `${describeMunicipality(fixture)} should use a two-letter state abbreviation`
            );
        }
    }
);

test(
    "nationwide municipality matrix contains non-empty municipality names",
    () => {
        for (const fixture of MUNICIPALITY_FIXTURES) {
            assert.ok(
                fixture.city.trim().length > 0,
                "municipality city should not be empty"
            );
        }
    }
);

test(
    "nationwide municipality matrix uses positive expected district counts",
    () => {
        for (const fixture of MUNICIPALITY_FIXTURES) {
            if (
                fixture.expectedDistrictCount !==
                undefined
            ) {
                assert.ok(
                    fixture.expectedDistrictCount > 0,
                    `${describeMunicipality(fixture)} should have a positive expected district count`
                );
            }
        }
    }
);