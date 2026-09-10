import assert from "node:assert/strict";
import test from "node:test";

import { getSearchTiers } from "../../generator/src/discover.js";
import type { CensusPlace } from "../../generator/src/types.js";

const TUCSON_PLACE: CensusPlace = {
    city: "Tucson",
    state: "AZ",
    placeFips: "0477000"
};

test("getSearchTiers returns tiers in descending discovery priority", () => {
    const tiers = getSearchTiers(TUCSON_PLACE);

    assert.deepEqual(
        tiers.map(tier => tier.name),
        [
            "municipality-specific",
            "service-name",
            "municipality-gis",
            "broad-political"
        ]
    );
});

test("municipality-specific tier contains city-specific political queries", () => {
    const tiers = getSearchTiers(TUCSON_PLACE);

    const tier = tiers.find(
        tier => tier.name === "municipality-specific"
    );

    assert.ok(tier);

    assert.ok(
        tier.queries.some(
            query =>
                query.includes('"Tucson"') &&
                query.includes("city council districts")
        )
    );

    assert.ok(
        tier.queries.some(
            query =>
                query.includes('"Tucson"') &&
                query.includes("ward boundaries")
        )
    );

    assert.ok(
        tier.queries.some(
            query =>
                query.includes('"Tucson"') &&
                query.includes("political district boundaries")
        )
    );
});

test("service-name tier contains common ArcGIS naming conventions", () => {
    const tiers = getSearchTiers(TUCSON_PLACE);

    const tier = tiers.find(
        tier => tier.name === "service-name"
    );

    assert.ok(tier);

    assert.ok(
        tier.queries.includes(
            "Tucson Ward_Boundaries"
        )
    );

    assert.ok(
        tier.queries.includes(
            "Tucson Council_Districts"
        )
    );

    assert.ok(
        tier.queries.includes(
            "Tucson WardBoundaries"
        )
    );

    assert.ok(
        tier.queries.includes(
            "Tucson CouncilDistricts"
        )
    );

    assert.ok(
        tier.queries.includes(
            "Tucson Wards"
        )
    );
});

test("municipality-gis tier contains GIS and ArcGIS discovery queries", () => {
    const tiers = getSearchTiers(TUCSON_PLACE);

    const tier = tiers.find(
        tier => tier.name === "municipality-gis"
    );

    assert.ok(tier);

    assert.ok(
        tier.queries.includes(
            '"Tucson" AZ GIS wards'
        )
    );

    assert.ok(
        tier.queries.includes(
            '"Tucson" AZ GIS council'
        )
    );

    assert.ok(
        tier.queries.includes(
            '"Tucson" AZ GIS districts'
        )
    );

    assert.ok(
        tier.queries.includes(
            '"Tucson" AZ ArcGIS council'
        )
    );

    assert.ok(
        tier.queries.includes(
            '"Tucson" AZ ArcGIS wards'
        )
    );
});

test("broad-political tier contains municipality-independent political queries", () => {
    const tiers = getSearchTiers(TUCSON_PLACE);

    const tier = tiers.find(
        tier => tier.name === "broad-political"
    );

    assert.ok(tier);

    assert.ok(
        tier.queries.includes(
            "ward boundaries"
        )
    );

    assert.ok(
        tier.queries.includes(
            "council districts"
        )
    );

    assert.ok(
        tier.queries.includes(
            "municipal districts"
        )
    );

    assert.ok(
        tier.queries.includes(
            "political district boundaries"
        )
    );
});

test("municipality-specific queries include the municipality", () => {
    const tiers = getSearchTiers(TUCSON_PLACE);

    const tier = tiers.find(
        tier => tier.name === "municipality-specific"
    );

    assert.ok(tier);

    for (const query of tier.queries) {
        assert.ok(
            query.includes("Tucson"),
            `Expected municipality-specific query to contain Tucson: ${query}`
        );
    }
});

test("broad-political queries do not contain the municipality", () => {
    const tiers = getSearchTiers(TUCSON_PLACE);

    const tier = tiers.find(
        tier => tier.name === "broad-political"
    );

    assert.ok(tier);

    for (const query of tier.queries) {
        assert.ok(
            !query.includes("Tucson"),
            `Expected broad query not to contain Tucson: ${query}`
        );
    }
});

test("each tier has a stop score", () => {
    const tiers = getSearchTiers(TUCSON_PLACE);

    for (const tier of tiers) {
        assert.equal(
            typeof tier.stopScore,
            "number"
        );

        assert.ok(
            tier.stopScore > 0,
            `Expected positive stop score for ${tier.name}`
        );
    }
});

test("stop scores decrease as discovery becomes broader", () => {
    const tiers = getSearchTiers(TUCSON_PLACE);

    for (let i = 1; i < tiers.length; i++) {
        assert.ok(
            tiers[i].stopScore <
                tiers[i - 1].stopScore,
            `Expected ${tiers[i].name} stop score to be lower than ${tiers[i - 1].name}`
        );
    }
});

test("each tier has a positive maxQueries value", () => {
    const tiers = getSearchTiers(TUCSON_PLACE);

    for (const tier of tiers) {
        assert.equal(
            typeof tier.maxQueries,
            "number"
        );

        assert.ok(
            tier.maxQueries > 0,
            `Expected positive maxQueries for ${tier.name}`
        );

        assert.ok(
            tier.maxQueries <= tier.queries.length,
            `Expected maxQueries to not exceed query count for ${tier.name}`
        );
    }
});

test("maxQueries decreases for broader search tiers", () => {
    const tiers = getSearchTiers(TUCSON_PLACE);

    for (let i = 1; i < tiers.length; i++) {
        assert.ok(
            tiers[i].maxQueries <=
                tiers[i - 1].maxQueries,
            `Expected ${tiers[i].name} maxQueries to be no greater than ${tiers[i - 1].name}`
        );
    }
});

test("getSearchTiers uses the supplied municipality and state", () => {
    const place: CensusPlace = {
        city: "Phoenix",
        state: "AZ",
        placeFips: "0455000"
    };

    const tiers = getSearchTiers(place);

    const municipalityQueries = tiers
        .filter(
            tier =>
                tier.name === "municipality-specific" ||
                tier.name === "service-name" ||
                tier.name === "municipality-gis"
        )
        .flatMap(tier => tier.queries);

    assert.ok(
        municipalityQueries.some(
            query => query.includes("Phoenix")
        )
    );

    assert.ok(
        municipalityQueries.some(
            query => query.includes("AZ")
        )
    );

    assert.ok(
        !municipalityQueries.some(
            query => query.includes("Tucson")
        )
    );
});

test("municipality-specific tier searches both council districts and wards", () => {
    const place: CensusPlace = {
        city: "Phoenix",
        state: "AZ",
        placeFips: "0455000"
    };

    const tiers = getSearchTiers(place);

    const tier = tiers.find(
        tier => tier.name === "municipality-specific"
    );

    assert.ok(tier);

    assert.ok(
        tier.queries.some(
            query =>
                query.includes("council districts")
        )
    );

    assert.ok(
        tier.queries.some(
            query =>
                query.includes("ward boundaries")
        )
    );
});