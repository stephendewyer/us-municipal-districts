import assert from "node:assert/strict";
import test from "node:test";

import {
    scoreSearchResult,
    SEARCH_RELEVANCE_THRESHOLD
} from "../../generator/src/searchRelevance.js";

import type {
    ArcGISSearchResult,
    CensusPlace
} from "../../generator/src/types.js";


// =============================================================================
// Fixtures
// =============================================================================

const tucson: CensusPlace = {
    placeFips: "0477000",
    city: "Tucson",
    state: "AZ",
    placeType: "incorporated-place"
};


function result(
    overrides: Partial<ArcGISSearchResult>
): ArcGISSearchResult {

    return {
        id: "test-id",
        title: "Test Layer",
        type: "Feature Service",
        ...overrides
    };
}


// =============================================================================
// Municipal political boundaries
// =============================================================================

test(
    "Tucson ward layer receives a high relevance score",
    () => {

        const relevance =
            scoreSearchResult(
                result({
                    title: "Tucson Wards",
                    owner: "City_Of_Tucson"
                }),
                tucson
            );

        console.log("Tucson ward relevance:", relevance);

        assert.ok(
            relevance.score >= SEARCH_RELEVANCE_THRESHOLD
        );

        assert.equal(
            relevance.likelyRelevant,
            true
        );

        assert.ok(
            relevance.reasons.some(
                reason =>
                    reason.includes(
                        "municipality name"
                    )
            )
        );

        assert.ok(
            relevance.reasons.some(
                reason =>
                    reason.includes('"ward"') ||
                    reason.includes('"wards"')
            )
        );
    }
);


test(
    "Tucson city council district layer receives a high relevance score",
    () => {

        const relevance =
            scoreSearchResult(
                result({
                    title:
                        "Tucson City Council Districts",
                    owner:
                        "City_Of_Tucson"
                }),
                tucson
            );

        assert.equal(
            relevance.likelyRelevant,
            true
        );

        assert.ok(
            relevance.score >= 50
        );
    }
);


test(
    "municipal district boundary layer is considered relevant",
    () => {

        const relevance =
            scoreSearchResult(
                result({
                    title:
                        "Municipal District Boundaries"
                }),
                tucson
            );

        assert.equal(
            relevance.likelyRelevant,
            true
        );
    }
);


// =============================================================================
// Obvious false positives
// =============================================================================

test(
    "World Transit Stops is rejected",
    () => {

        const relevance =
            scoreSearchResult(
                result({
                    title:
                        "World Transit Stops",
                    owner:
                        "esri_transit"
                }),
                tucson
            );

        assert.equal(
            relevance.likelyRelevant,
            false
        );

        assert.ok(
            relevance.score <
            SEARCH_RELEVANCE_THRESHOLD
        );
    }
);


test(
    "transit layers receive a strong negative score",
    () => {

        const relevance =
            scoreSearchResult(
                result({
                    title:
                        "Tucson Transit Lines"
                }),
                tucson
            );

        assert.ok(
            relevance.score <
            SEARCH_RELEVANCE_THRESHOLD
        );
    }
);


test(
    "housing datasets are rejected",
    () => {

        const relevance =
            scoreSearchResult(
                result({
                    title:
                        "Tucson Housing Demographics"
                }),
                tucson
            );

        assert.equal(
            relevance.likelyRelevant,
            false
        );
    }
);


test(
    "parcel datasets are rejected",
    () => {

        const relevance =
            scoreSearchResult(
                result({
                    title:
                        "Tucson Parcels"
                }),
                tucson
            );

        assert.equal(
            relevance.likelyRelevant,
            false
        );
    }
);


test(
    "school district datasets are rejected",
    () => {

        const relevance =
            scoreSearchResult(
                result({
                    title:
                        "Tucson School Districts"
                }),
                tucson
            );

        assert.equal(
            relevance.likelyRelevant,
            false
        );
    }
);


// =============================================================================
// Municipality evidence
// =============================================================================

test(
    "municipality name increases relevance",
    () => {

        const withoutCity =
            scoreSearchResult(
                result({
                    title:
                        "Ward Boundaries"
                }),
                tucson
            );

        const withCity =
            scoreSearchResult(
                result({
                    title:
                        "Tucson Ward Boundaries"
                }),
                tucson
            );

        assert.ok(
            withCity.score >
            withoutCity.score
        );
    }
);


test(
    "municipality name in description increases relevance",
    () => {

        const relevance =
            scoreSearchResult(
                result({
                    title:
                        "Ward Boundaries",
                    description:
                        "Official boundaries for the City of Tucson."
                }),
                tucson
            );

        assert.ok(
            relevance.score >=
            SEARCH_RELEVANCE_THRESHOLD
        );

        assert.equal(
            relevance.likelyRelevant,
            true
        );
    }
);


test(
    "official municipal ownership increases relevance",
    () => {

        const privateSource =
            scoreSearchResult(
                result({
                    title:
                        "Tucson Ward Boundaries",
                    owner:
                        "some_private_user"
                }),
                tucson
            );

        const municipalSource =
            scoreSearchResult(
                result({
                    title:
                        "Tucson Ward Boundaries",
                    owner:
                        "City_Of_Tucson"
                }),
                tucson
            );

        assert.ok(
            municipalSource.score >
            privateSource.score
        );
    }
);


// =============================================================================
// Political terminology
// =============================================================================

test(
    "council district keyword increases relevance",
    () => {

        const relevance =
            scoreSearchResult(
                result({
                    title:
                        "Tucson Council Districts"
                }),
                tucson
            );

        assert.ok(
            relevance.score >=
            SEARCH_RELEVANCE_THRESHOLD
        );
    }
);


test(
    "aldermanic keyword increases relevance",
    () => {

        const relevance =
            scoreSearchResult(
                result({
                    title:
                        "Aldermanic District Boundaries"
                }),
                tucson
            );

        assert.ok(
            relevance.score >=
            SEARCH_RELEVANCE_THRESHOLD
        );
    }
);


// =============================================================================
// Search metadata
// =============================================================================

test(
    "tags contribute to relevance",
    () => {

        const relevance =
            scoreSearchResult(
                result({
                    title:
                        "Municipal Boundaries",
                    tags: [
                        "Tucson",
                        "ward",
                        "city council"
                    ]
                }),
                tucson
            );

        assert.equal(
            relevance.likelyRelevant,
            true
        );
    }
);


test(
    "Feature Service receives a small positive score",
    () => {

        const featureService =
            scoreSearchResult(
                result({
                    title:
                        "Tucson Wards",
                    type:
                        "Feature Service"
                }),
                tucson
            );

        const webMap =
            scoreSearchResult(
                result({
                    title:
                        "Tucson Wards",
                    type:
                        "Web Map"
                }),
                tucson
            );

        assert.ok(
            featureService.score >
            webMap.score
        );
    }
);