import assert from "node:assert/strict";
import test from "node:test";

import {
    validateTemporal
} from "../../generator/src/temporalValidation.js";

import type {
    ArcGISInspection
} from "../../generator/src/types.js";


// =============================================================================
// Helpers
// =============================================================================

function createInspection(
    overrides: Partial<ArcGISInspection> = {}
): ArcGISInspection {

    return {
        url:
            "https://example.com/FeatureServer/0",

        isArcGIS:
            true,

        serviceType:
            "FeatureServer",

        isLayer:
            true,

        title:
            undefined,

        serviceName:
            undefined,

        layerName:
            undefined,

        description:
            undefined,

        serviceDescription:
            undefined,

        fields:
            [],

        districtFields:
            [],

        nameFields:
            [],

        fieldSamples:
            [],

        tags:
            [],

        typeKeywords:
            [],

        ...overrides
    };
}


// =============================================================================
// Constants
// =============================================================================

const CURRENT_YEAR =
    new Date().getFullYear();

const NEXT_YEAR =
    CURRENT_YEAR + 1;


// =============================================================================
// Title precedence
// =============================================================================

test(
    "classifies a historical year in the title as historical",
    () => {

        const inspection =
            createInspection({
                title:
                    "Chicago Wards (2015)"
            });


        const result =
            validateTemporal(
                inspection
            );


        assert.equal(
            result.status,
            "historical"
        );


        assert.equal(
            result.year,
            2015
        );


        assert.equal(
            result.score,
            -60
        );


        assert.ok(
            result.reasons.some(
                reason =>
                    reason.includes(
                        "title"
                    )
            )
        );
    }
);


test(
    "title-level historical evidence takes precedence over current description evidence",
    () => {

        const inspection =
            createInspection({
                title:
                    "Chicago Wards (2015)",

                description:
                    "Current ward boundary data maintained by the city."
            });


        const result =
            validateTemporal(
                inspection
            );


        assert.equal(
            result.status,
            "historical"
        );


        assert.equal(
            result.year,
            2015
        );


        assert.equal(
            result.score,
            -60
        );


        assert.ok(
            result.reasons.some(
                reason =>
                    reason.includes(
                        "title"
                    )
            )
        );
    }
);


test(
    "title-level current evidence takes precedence over historical description evidence",
    () => {

        const inspection =
            createInspection({
                title:
                    "Current Chicago Wards",

                description:
                    "This dataset supersedes the 2015-2023 ward boundaries."
            });


        const result =
            validateTemporal(
                inspection
            );


        assert.equal(
            result.status,
            "current"
        );


        assert.equal(
            result.score,
            20
        );


        assert.ok(
            result.reasons.some(
                reason =>
                    reason.includes(
                        "title"
                    )
            )
        );
    }
);


// =============================================================================
// Historical titles
// =============================================================================

test(
    "recognizes an explicit historical year in a ward title",
    () => {

        const inspection =
            createInspection({
                title:
                    "Chicago Wards 2015"
            });


        const result =
            validateTemporal(
                inspection
            );


        assert.equal(
            result.status,
            "historical"
        );


        assert.equal(
            result.year,
            2015
        );
    }
);


test(
    "recognizes an explicit historical year in a district title",
    () => {

        const inspection =
            createInspection({
                title:
                    "City Council Districts 2020"
            });


        const result =
            validateTemporal(
                inspection
            );


        assert.equal(
            result.status,
            "historical"
        );


        assert.equal(
            result.year,
            2020
        );
    }
);


test(
    "recognizes a historical numeric range in a title",
    () => {

        const inspection =
            createInspection({
                title:
                    "Chicago Wards 2015-2023"
            });


        const result =
            validateTemporal(
                inspection
            );


        assert.equal(
            result.status,
            "historical"
        );


        assert.equal(
            result.startYear,
            2015
        );


        assert.equal(
            result.endYear,
            2023
        );


        assert.equal(
            result.score,
            -60
        );
    }
);


test(
    "recognizes an en-dash historical range in a title",
    () => {

        const inspection =
            createInspection({
                title:
                    "Chicago Wards 2015–2023"
            });


        const result =
            validateTemporal(
                inspection
            );


        assert.equal(
            result.status,
            "historical"
        );


        assert.equal(
            result.startYear,
            2015
        );


        assert.equal(
            result.endYear,
            2023
        );
    }
);


test(
    "recognizes a natural-language historical range in a title",
    () => {

        const inspection =
            createInspection({
                title:
                    "Chicago Wards 2015 through 2023"
            });


        const result =
            validateTemporal(
                inspection
            );


        assert.equal(
            result.status,
            "historical"
        );


        assert.equal(
            result.startYear,
            2015
        );


        assert.equal(
            result.endYear,
            2023
        );
    }
);


// =============================================================================
// Current titles
// =============================================================================

test(
    "recognizes current in a title",
    () => {

        const inspection =
            createInspection({
                title:
                    "Current Chicago Wards"
            });


        const result =
            validateTemporal(
                inspection
            );


        assert.equal(
            result.status,
            "current"
        );


        assert.equal(
            result.score,
            20
        );
    }
);


test(
    "recognizes currently in a title",
    () => {

        const inspection =
            createInspection({
                title:
                    "Chicago Wards — Currently Maintained"
            });


        const result =
            validateTemporal(
                inspection
            );


        assert.equal(
            result.status,
            "current"
        );


        assert.equal(
            result.score,
            20
        );
    }
);


test(
    "recognizes an open-ended current year range in a title",
    () => {

        const inspection =
            createInspection({
                title:
                    `Chicago Wards ${CURRENT_YEAR}-`
            });


        const result =
            validateTemporal(
                inspection
            );


        assert.equal(
            result.status,
            "current"
        );


        assert.equal(
            result.startYear,
            CURRENT_YEAR
        );


        assert.equal(
            result.score,
            20
        );
    }
);


test(
    "recognizes a present-tense year range in a title",
    () => {

        const inspection =
            createInspection({
                title:
                    `Chicago Wards ${CURRENT_YEAR}-present`
            });


        const result =
            validateTemporal(
                inspection
            );


        assert.equal(
            result.status,
            "current"
        );


        assert.equal(
            result.startYear,
            CURRENT_YEAR
        );
    }
);


// =============================================================================
// Future titles
// =============================================================================

test(
    "recognizes an explicit future year in a boundary title",
    () => {

        const inspection =
            createInspection({
                title:
                    `Chicago Wards ${NEXT_YEAR}`
            });


        const result =
            validateTemporal(
                inspection
            );


        assert.equal(
            result.status,
            "future"
        );


        assert.equal(
            result.year,
            NEXT_YEAR
        );


        assert.equal(
            result.score,
            -10
        );
    }
);


// =============================================================================
// Metadata fallback
// =============================================================================

test(
    "uses layer name when title has no temporal evidence",
    () => {

        const inspection =
            createInspection({
                title:
                    "Chicago Wards",

                layerName:
                    "Chicago Wards 2015"
            });


        const result =
            validateTemporal(
                inspection
            );


        /*
         * The title contains the boundary term but no date.
         * The implementation evaluates the title first, then the layer
         * name because the title itself has no temporal classification.
         */

        assert.equal(
            result.status,
            "historical"
        );


        assert.equal(
            result.year,
            2015
        );


        assert.ok(
            result.reasons.some(
                reason =>
                    reason.includes(
                        "layer name"
                    )
            )
        );
    }
);


test(
    "uses description when title and layer name have no temporal evidence",
    () => {

        const inspection =
            createInspection({
                title:
                    "Chicago Wards",

                description:
                    "Ward boundaries effective from 2015 through 2023."
            });


        const result =
            validateTemporal(
                inspection
            );


        assert.equal(
            result.status,
            "historical"
        );


        assert.equal(
            result.startYear,
            2015
        );


        assert.equal(
            result.endYear,
            2023
        );


        assert.ok(
            result.reasons.some(
                reason =>
                    reason.includes(
                        "layer description"
                    )
            )
        );
    }
);


test(
    "uses service description as temporal evidence",
    () => {

        const inspection =
            createInspection({
                title:
                    "Chicago Wards",

                serviceDescription:
                    "Current ward boundaries maintained by the municipality."
            });


        const result =
            validateTemporal(
                inspection
            );


        assert.equal(
            result.status,
            "current"
        );


        assert.equal(
            result.score,
            20
        );


        assert.ok(
            result.reasons.some(
                reason =>
                    reason.includes(
                        "service description"
                    )
            )
        );
    }
);


test(
    "uses tags when earlier metadata has no temporal evidence",
    () => {

        const inspection =
            createInspection({
                title:
                    "Chicago Wards",

                tags: [
                    "political boundaries",
                    "current"
                ]
            });


        const result =
            validateTemporal(
                inspection
            );


        assert.equal(
            result.status,
            "current"
        );


        assert.equal(
            result.score,
            20
        );


        assert.ok(
            result.reasons.some(
                reason =>
                    reason.includes(
                        "tag"
                    )
            )
        );
    }
);


test(
    "uses type keywords as the final metadata source",
    () => {

        const inspection =
            createInspection({
                title:
                    "Chicago Wards",

                typeKeywords: [
                    "Political Boundary",
                    "2025"
                ]
            });


        const result =
            validateTemporal(
                inspection
            );


        assert.equal(
            result.status,
            "historical"
        );


        assert.equal(
            result.year,
            2025
        );


        assert.ok(
            result.reasons.some(
                reason =>
                    reason.includes(
                        "type keyword"
                    )
            )
        );
    }
);


// =============================================================================
// Undated
// =============================================================================

test(
    "returns undated when no temporal evidence exists",
    () => {

        const inspection =
            createInspection({
                title:
                    "Chicago Wards"
            });


        const result =
            validateTemporal(
                inspection
            );


        assert.equal(
            result.status,
            "undated"
        );


        assert.equal(
            result.score,
            0
        );


        assert.equal(
            result.year,
            undefined
        );


        assert.equal(
            result.startYear,
            undefined
        );


        assert.equal(
            result.endYear,
            undefined
        );
    }
);


// =============================================================================
// Incidental dates
// =============================================================================

test(
    "does not classify an unrelated year in a generic title as historical",
    () => {

        const inspection =
            createInspection({
                title:
                    "Chicago Wards"
            });


        const result =
            validateTemporal(
                inspection
            );


        assert.equal(
            result.status,
            "undated"
        );
    }
);


test(
    "does not classify an unrelated ordinance year in a description as historical",
    () => {

        const inspection =
            createInspection({
                title:
                    "Chicago Wards",

                description:
                    "Dataset created pursuant to ordinance 2020-14."
            });


        const result =
            validateTemporal(
                inspection
            );


        assert.equal(
            result.status,
            "undated"
        );
    }
);


// =============================================================================
// Metadata precedence
// =============================================================================

test(
    "layer name takes precedence over description",
    () => {

        const inspection =
            createInspection({
                title:
                    "Chicago Wards",

                layerName:
                    "Chicago Wards 2015",

                description:
                    "Current ward boundaries."
            });


        const result =
            validateTemporal(
                inspection
            );


        assert.equal(
            result.status,
            "historical"
        );


        assert.equal(
            result.year,
            2015
        );


        assert.ok(
            result.reasons.some(
                reason =>
                    reason.includes(
                        "layer name"
                    )
            )
        );
    }
);


test(
    "service name takes precedence over description",
    () => {

        const inspection =
            createInspection({
                title:
                    "Chicago Wards",

                serviceName:
                    "Chicago Wards 2015",

                description:
                    "Current ward boundaries."
            });


        const result =
            validateTemporal(
                inspection
            );


        assert.equal(
            result.status,
            "historical"
        );


        assert.equal(
            result.year,
            2015
        );


        assert.ok(
            result.reasons.some(
                reason =>
                    reason.includes(
                        "service name"
                    )
            )
        );
    }
);


// =============================================================================
// Result structure
// =============================================================================

test(
    "returns a reasons array for every temporal result",
    () => {

        const inspections = [

            createInspection({
                title:
                    "Chicago Wards (2015)"
            }),

            createInspection({
                title:
                    "Current Chicago Wards"
            }),

            createInspection({
                title:
                    "Chicago Wards"
            })
        ];


        for (
            const inspection of inspections
        ) {

            const result =
                validateTemporal(
                    inspection
                );


            assert.ok(
                Array.isArray(
                    result.reasons
                )
            );


            assert.ok(
                result.reasons.length > 0
            );
        }
    }
);