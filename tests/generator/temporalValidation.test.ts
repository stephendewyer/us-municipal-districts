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


function evaluate(
    overrides: Partial<ArcGISInspection>
) {

    return validateTemporal(
        createInspection(
            overrides
        )
    );
}


// =============================================================================
// Constants
// =============================================================================

const CURRENT_YEAR =
    new Date().getFullYear();

const PREVIOUS_YEAR =
    CURRENT_YEAR - 1;

const TWO_YEARS_AGO =
    CURRENT_YEAR - 2;

const NEXT_YEAR =
    CURRENT_YEAR + 1;

const TWO_YEARS_AHEAD =
    CURRENT_YEAR + 2;


// =============================================================================
// Undated behavior
// =============================================================================

test(
    "returns undated when no metadata contains temporal evidence",
    () => {

        const result =
            evaluate({
                title:
                    "Chicago Wards"
            });

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

        assert.deepEqual(
            result.reasons,
            [
                "no explicit current, dated, historical, or future temporal evidence detected"
            ]
        );
    }
);


test(
    "empty metadata is undated",
    () => {

        const result =
            evaluate({});

        assert.equal(
            result.status,
            "undated"
        );

        assert.equal(
            result.score,
            0
        );
    }
);


// =============================================================================
// Bare year behavior
// =============================================================================

test(
    "a bare past year in a title is dated",
    () => {

        const result =
            evaluate({
                title:
                    `Chicago Wards ${PREVIOUS_YEAR}`
            });

        assert.equal(
            result.status,
            "dated"
        );

        assert.equal(
            result.year,
            PREVIOUS_YEAR
        );

        assert.equal(
            result.score,
            5
        );

        assert.ok(
            result.reasons.some(
                reason =>
                    reason.includes(
                        "dated boundary vintage"
                    )
            )
        );
    }
);


test(
    "a bare current year in a title is current",
    () => {

        const result =
            evaluate({
                title:
                    `Chicago Wards ${CURRENT_YEAR}`
            });

        assert.equal(
            result.status,
            "current"
        );

        assert.equal(
            result.year,
            CURRENT_YEAR
        );

        assert.equal(
            result.score,
            20
        );
    }
);


test(
    "a bare future year in a title is future",
    () => {

        const result =
            evaluate({
                title:
                    `Chicago Wards ${NEXT_YEAR}`
            });

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


test(
    "a bare year in a non-boundary description is ignored",
    () => {

        const result =
            evaluate({
                description:
                    `Dataset references ${PREVIOUS_YEAR}.`
            });

        assert.equal(
            result.status,
            "undated"
        );

        assert.equal(
            result.score,
            0
        );
    }
);


// =============================================================================
// Numeric ranges
// =============================================================================

test(
    "a completed past numeric boundary range is dated",
    () => {

        const result =
            evaluate({
                title:
                    `Chicago Wards ${TWO_YEARS_AGO}-${PREVIOUS_YEAR}`
            });

        assert.equal(
            result.status,
            "dated"
        );

        assert.equal(
            result.startYear,
            TWO_YEARS_AGO
        );

        assert.equal(
            result.endYear,
            PREVIOUS_YEAR
        );

        assert.equal(
            result.year,
            undefined
        );

        assert.equal(
            result.score,
            5
        );
    }
);


test(
    "a numeric range ending in the current year is current",
    () => {

        const result =
            evaluate({
                title:
                    `Chicago Wards ${PREVIOUS_YEAR}-${CURRENT_YEAR}`
            });

        assert.equal(
            result.status,
            "current"
        );

        /*
         * evaluateText() returns the current year through
         * currentEvidence(), rather than startYear/endYear.
         */
        assert.equal(
            result.year,
            CURRENT_YEAR
        );

        assert.equal(
            result.startYear,
            undefined
        );

        assert.equal(
            result.endYear,
            undefined
        );

        assert.equal(
            result.score,
            20
        );
    }
);


test(
    "a numeric range entirely in the future is future",
    () => {

        const result =
            evaluate({
                title:
                    `Chicago Wards ${NEXT_YEAR}-${TWO_YEARS_AHEAD}`
            });

        assert.equal(
            result.status,
            "future"
        );

        assert.equal(
            result.startYear,
            NEXT_YEAR
        );

        assert.equal(
            result.endYear,
            TWO_YEARS_AHEAD
        );

        assert.equal(
            result.year,
            undefined
        );

        assert.equal(
            result.score,
            -10
        );
    }
);


test(
    "an en-dash completed range is normalized and classified as dated",
    () => {

        const result =
            evaluate({
                title:
                    `Chicago Wards ${TWO_YEARS_AGO}–${PREVIOUS_YEAR}`
            });

        assert.equal(
            result.status,
            "dated"
        );

        assert.equal(
            result.startYear,
            TWO_YEARS_AGO
        );

        assert.equal(
            result.endYear,
            PREVIOUS_YEAR
        );
    }
);


test(
    "an em-dash completed range is normalized and classified as dated",
    () => {

        const result =
            evaluate({
                title:
                    `Chicago Wards ${TWO_YEARS_AGO}—${PREVIOUS_YEAR}`
            });

        assert.equal(
            result.status,
            "dated"
        );

        assert.equal(
            result.startYear,
            TWO_YEARS_AGO
        );

        assert.equal(
            result.endYear,
            PREVIOUS_YEAR
        );
    }
);


// =============================================================================
// Natural-language ranges
// =============================================================================

test(
    "a through range ending before the current year is dated",
    () => {

        const result =
            evaluate({
                title:
                    `Chicago Wards ${TWO_YEARS_AGO} through ${PREVIOUS_YEAR}`
            });

        assert.equal(
            result.status,
            "dated"
        );

        assert.equal(
            result.startYear,
            TWO_YEARS_AGO
        );

        assert.equal(
            result.endYear,
            PREVIOUS_YEAR
        );

        assert.equal(
            result.score,
            5
        );
    }
);


test(
    "a thru range ending before the current year is dated",
    () => {

        const result =
            evaluate({
                title:
                    `Chicago Wards ${TWO_YEARS_AGO} thru ${PREVIOUS_YEAR}`
            });

        assert.equal(
            result.status,
            "dated"
        );

        assert.equal(
            result.startYear,
            TWO_YEARS_AGO
        );

        assert.equal(
            result.endYear,
            PREVIOUS_YEAR
        );
    }
);


test(
    "a to range ending before the current year is dated",
    () => {

        const result =
            evaluate({
                title:
                    `Chicago Wards ${TWO_YEARS_AGO} to ${PREVIOUS_YEAR}`
            });

        assert.equal(
            result.status,
            "dated"
        );

        assert.equal(
            result.startYear,
            TWO_YEARS_AGO
        );

        assert.equal(
            result.endYear,
            PREVIOUS_YEAR
        );
    }
);


test(
    "a natural-language range ending in the current year is current",
    () => {

        const result =
            evaluate({
                title:
                    `Chicago Wards ${PREVIOUS_YEAR} through ${CURRENT_YEAR}`
            });

        assert.equal(
            result.status,
            "current"
        );

        assert.equal(
            result.year,
            CURRENT_YEAR
        );

        assert.equal(
            result.score,
            20
        );
    }
);


// =============================================================================
// Open-ended current ranges
// =============================================================================

test(
    "a current-year trailing dash is current",
    () => {

        const result =
            evaluate({
                title:
                    `Chicago Wards ${CURRENT_YEAR}-`
            });

        assert.equal(
            result.status,
            "current"
        );

        assert.equal(
            result.year,
            CURRENT_YEAR
        );

        assert.equal(
            result.startYear,
            CURRENT_YEAR
        );

        assert.equal(
            result.endYear,
            undefined
        );

        assert.equal(
            result.score,
            20
        );
    }
);


test(
    "a current-year present range is current",
    () => {

        const result =
            evaluate({
                title:
                    `Chicago Wards ${CURRENT_YEAR}-present`
            });

        assert.equal(
            result.status,
            "current"
        );

        assert.equal(
            result.year,
            CURRENT_YEAR
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
    "a current-year current range is current",
    () => {

        const result =
            evaluate({
                title:
                    `Chicago Wards ${CURRENT_YEAR}-current`
            });

        assert.equal(
            result.status,
            "current"
        );

        assert.equal(
            result.year,
            CURRENT_YEAR
        );

        assert.equal(
            result.startYear,
            CURRENT_YEAR
        );
    }
);


test(
    "a current-year ongoing range is current",
    () => {

        const result =
            evaluate({
                title:
                    `Chicago Wards ${CURRENT_YEAR}-ongoing`
            });

        assert.equal(
            result.status,
            "current"
        );

        assert.equal(
            result.year,
            CURRENT_YEAR
        );

        assert.equal(
            result.startYear,
            CURRENT_YEAR
        );
    }
);


test(
    "a current-year active range is current",
    () => {

        const result =
            evaluate({
                title:
                    `Chicago Wards ${CURRENT_YEAR}-active`
            });

        assert.equal(
            result.status,
            "current"
        );

        assert.equal(
            result.year,
            CURRENT_YEAR
        );

        assert.equal(
            result.startYear,
            CURRENT_YEAR
        );
    }
);


test(
    "a past-year present range is current and preserves its startYear",
    () => {

        const result =
            evaluate({
                title:
                    `Chicago Wards ${PREVIOUS_YEAR}-present`
            });

        assert.equal(
            result.status,
            "current"
        );

        assert.equal(
            result.year,
            PREVIOUS_YEAR
        );

        assert.equal(
            result.startYear,
            PREVIOUS_YEAR
        );

        assert.equal(
            result.endYear,
            undefined
        );

        assert.equal(
            result.score,
            20
        );
    }
);


// =============================================================================
// Current language
// =============================================================================

test(
    "current language without a year is current",
    () => {

        const result =
            evaluate({
                title:
                    "Current Chicago Wards"
            });

        assert.equal(
            result.status,
            "current"
        );

        assert.equal(
            result.year,
            undefined
        );

        assert.equal(
            result.score,
            20
        );
    }
);


test(
    "currently is current",
    () => {

        const result =
            evaluate({
                title:
                    "Chicago Wards currently maintained"
            });

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
    "ongoing is current",
    () => {

        const result =
            evaluate({
                title:
                    "Chicago Wards ongoing"
            });

        assert.equal(
            result.status,
            "current"
        );
    }
);


test(
    "active is current",
    () => {

        const result =
            evaluate({
                title:
                    "Active Chicago Wards"
            });

        assert.equal(
            result.status,
            "current"
        );
    }
);


test(
    "present is current",
    () => {

        const result =
            evaluate({
                title:
                    "Chicago Wards present"
            });

        assert.equal(
            result.status,
            "current"
        );
    }
);


test(
    "current language preserves an explicitly present current year",
    () => {

        const result =
            evaluate({
                title:
                    `Current Chicago Wards ${CURRENT_YEAR}`
            });

        assert.equal(
            result.status,
            "current"
        );

        assert.equal(
            result.year,
            CURRENT_YEAR
        );
    }
);


// =============================================================================
// Historical language
// =============================================================================

test(
    "explicit historical language makes a past year historical",
    () => {

        const result =
            evaluate({
                title:
                    `Historical Chicago Wards ${PREVIOUS_YEAR}`
            });

        assert.equal(
            result.status,
            "historical"
        );

        assert.equal(
            result.year,
            PREVIOUS_YEAR
        );

        assert.equal(
            result.score,
            -60
        );
    }
);


test(
    "historic language makes a boundary historical",
    () => {

        const result =
            evaluate({
                title:
                    `Historic Chicago Wards ${PREVIOUS_YEAR}`
            });

        assert.equal(
            result.status,
            "historical"
        );

        assert.equal(
            result.year,
            PREVIOUS_YEAR
        );
    }
);


test(
    "former language makes a boundary historical",
    () => {

        const result =
            evaluate({
                title:
                    `Former Chicago Wards ${PREVIOUS_YEAR}`
            });

        assert.equal(
            result.status,
            "historical"
        );

        assert.equal(
            result.year,
            PREVIOUS_YEAR
        );
    }
);


test(
    "superseded language makes a boundary historical",
    () => {

        const result =
            evaluate({
                title:
                    `Superseded Chicago Wards ${PREVIOUS_YEAR}`
            });

        assert.equal(
            result.status,
            "historical"
        );

        assert.equal(
            result.year,
            PREVIOUS_YEAR
        );
    }
);


test(
    "explicit historical language overrides an otherwise dated range",
    () => {

        const result =
            evaluate({
                title:
                    `Historical Chicago Wards ${TWO_YEARS_AGO}-${PREVIOUS_YEAR}`
            });

        assert.equal(
            result.status,
            "historical"
        );

        assert.equal(
            result.startYear,
            TWO_YEARS_AGO
        );

        assert.equal(
            result.endYear,
            PREVIOUS_YEAR
        );

        assert.equal(
            result.score,
            -60
        );
    }
);


test(
    "historical language without a year still produces historical evidence",
    () => {

        const result =
            evaluate({
                title:
                    "Historical Chicago Wards"
            });

        assert.equal(
            result.status,
            "historical"
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

        assert.equal(
            result.score,
            -60
        );
    }
);


// =============================================================================
// Future language
// =============================================================================

test(
    "explicit future language makes a future boundary future",
    () => {

        const result =
            evaluate({
                title:
                    `Future Chicago Wards ${NEXT_YEAR}`
            });

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


test(
    "proposed language makes a boundary future",
    () => {

        const result =
            evaluate({
                title:
                    `Proposed Chicago Wards ${NEXT_YEAR}`
            });

        assert.equal(
            result.status,
            "future"
        );

        assert.equal(
            result.year,
            NEXT_YEAR
        );
    }
);


test(
    "planned language makes a boundary future",
    () => {

        const result =
            evaluate({
                title:
                    `Planned Chicago Wards ${NEXT_YEAR}`
            });

        assert.equal(
            result.status,
            "future"
        );

        assert.equal(
            result.year,
            NEXT_YEAR
        );
    }
);


test(
    "explicit future language overrides a past year",
    () => {

        const result =
            evaluate({
                title:
                    `Future Chicago Wards ${PREVIOUS_YEAR}`
            });

        assert.equal(
            result.status,
            "future"
        );

        /*
         * futureEvidence() receives only a year found by:
         *
         *     year > CURRENT_YEAR
         *
         * Therefore a future-language string containing only a past year
         * produces future evidence with no year.
         */
        assert.equal(
            result.year,
            undefined
        );

        assert.equal(
            result.score,
            -10
        );
    }
);


test(
    "explicit future language without a year still produces future evidence",
    () => {

        const result =
            evaluate({
                title:
                    "Proposed Chicago Wards"
            });

        assert.equal(
            result.status,
            "future"
        );

        assert.equal(
            result.year,
            undefined
        );

        assert.equal(
            result.score,
            -10
        );
    }
);


test(
    "a future numeric range is future",
    () => {

        const result =
            evaluate({
                title:
                    `Chicago Wards ${NEXT_YEAR}-${TWO_YEARS_AHEAD}`
            });

        assert.equal(
            result.status,
            "future"
        );

        assert.equal(
            result.startYear,
            NEXT_YEAR
        );

        assert.equal(
            result.endYear,
            TWO_YEARS_AHEAD
        );
    }
);


// =============================================================================
// Precedence inside evaluateText()
// =============================================================================

test(
    "future language has precedence over historical language",
    () => {

        const result =
            evaluate({
                title:
                    `Future historical Chicago Wards ${NEXT_YEAR}`
            });

        assert.equal(
            result.status,
            "future"
        );

        assert.equal(
            result.year,
            NEXT_YEAR
        );
    }
);


test(
    "historical language has precedence over current language",
    () => {

        const result =
            evaluate({
                title:
                    `Historical current Chicago Wards ${PREVIOUS_YEAR}`
            });

        assert.equal(
            result.status,
            "historical"
        );

        assert.equal(
            result.year,
            PREVIOUS_YEAR
        );
    }
);


test(
    "future language has precedence over current language",
    () => {

        const result =
            evaluate({
                title:
                    `Proposed current Chicago Wards ${NEXT_YEAR}`
            });

        assert.equal(
            result.status,
            "future"
        );

        assert.equal(
            result.year,
            NEXT_YEAR
        );
    }
);


// =============================================================================
// Non-vintage dates
// =============================================================================

test(
    "an updated past year in a description is not temporal boundary evidence",
    () => {

        const result =
            evaluate({
                description:
                    `Updated ${PREVIOUS_YEAR}`
            });

        assert.equal(
            result.status,
            "undated"
        );

        assert.equal(
            result.score,
            0
        );
    }
);


test(
    "a published year is not temporal boundary evidence",
    () => {

        const result =
            evaluate({
                description:
                    `Published ${PREVIOUS_YEAR}`
            });

        assert.equal(
            result.status,
            "undated"
        );
    }
);


test(
    "a modified year is not temporal boundary evidence",
    () => {

        const result =
            evaluate({
                description:
                    `Last modified ${PREVIOUS_YEAR}`
            });

        assert.equal(
            result.status,
            "undated"
        );
    }
);


test(
    "an accessed year is not temporal boundary evidence",
    () => {

        const result =
            evaluate({
                description:
                    `Accessed ${PREVIOUS_YEAR}`
            });

        assert.equal(
            result.status,
            "undated"
        );
    }
);


test(
    "an exported year is not temporal boundary evidence",
    () => {

        const result =
            evaluate({
                description:
                    `Exported ${PREVIOUS_YEAR}`
            });

        assert.equal(
            result.status,
            "undated"
        );
    }
);


test(
    "a publication date does not override the absence of boundary evidence",
    () => {

        const result =
            evaluate({
                title:
                    "Chicago Wards",

                description:
                    `Published ${CURRENT_YEAR}`
            });

        assert.equal(
            result.status,
            "undated"
        );
    }
);


test(
    "a numeric range is evaluated before the non-vintage date exclusion",
    () => {

        const result =
            evaluate({
                description:
                    `Updated ${TWO_YEARS_AGO}-${PREVIOUS_YEAR}`
            });

        /*
         * This is an important exact-behavior test.
         *
         * Numeric ranges are checked before
         * NON_VINTAGE_DATE_PATTERN.
         */
        assert.equal(
            result.status,
            "dated"
        );

        assert.equal(
            result.startYear,
            TWO_YEARS_AGO
        );

        assert.equal(
            result.endYear,
            PREVIOUS_YEAR
        );
    }
);


// =============================================================================
// Boundary context
// =============================================================================

test(
    "a past year in a boundary description is dated",
    () => {

        const result =
            evaluate({
                description:
                    `Ward boundaries adopted in ${PREVIOUS_YEAR}.`
            });

        assert.equal(
            result.status,
            "dated"
        );

        assert.equal(
            result.year,
            PREVIOUS_YEAR
        );
    }
);


test(
    "a current year in a boundary description is current",
    () => {

        const result =
            evaluate({
                description:
                    `Ward boundaries for ${CURRENT_YEAR}.`
            });

        assert.equal(
            result.status,
            "current"
        );

        assert.equal(
            result.year,
            CURRENT_YEAR
        );
    }
);


test(
    "a future year in a boundary description is future",
    () => {

        const result =
            evaluate({
                description:
                    `Ward boundaries for ${NEXT_YEAR}.`
            });

        assert.equal(
            result.status,
            "future"
        );

        assert.equal(
            result.year,
            NEXT_YEAR
        );
    }
);


// =============================================================================
// Metadata precedence
// =============================================================================

test(
    "title evidence takes precedence over layer name evidence",
    () => {

        const result =
            evaluate({
                title:
                    `Chicago Wards ${PREVIOUS_YEAR}`,

                layerName:
                    `Chicago Wards ${CURRENT_YEAR}`
            });

        assert.equal(
            result.status,
            "dated"
        );

        assert.equal(
            result.year,
            PREVIOUS_YEAR
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
    "layer name is used when title has no temporal evidence",
    () => {

        const result =
            evaluate({
                title:
                    "Chicago Wards",

                layerName:
                    `Chicago Wards ${PREVIOUS_YEAR}`
            });

        assert.equal(
            result.status,
            "dated"
        );

        assert.equal(
            result.year,
            PREVIOUS_YEAR
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
    "service name is used after title and layer name",
    () => {

        const result =
            evaluate({
                title:
                    "Chicago Wards",

                layerName:
                    "Ward Boundaries",

                serviceName:
                    `Chicago Wards ${PREVIOUS_YEAR}`
            });

        assert.equal(
            result.status,
            "dated"
        );

        assert.equal(
            result.year,
            PREVIOUS_YEAR
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


test(
    "layer description is used after service name",
    () => {

        const result =
            evaluate({
                title:
                    "Chicago Wards",

                layerName:
                    "Ward Boundaries",

                serviceName:
                    "Municipal Wards",

                description:
                    `Ward boundaries ${TWO_YEARS_AGO}-${PREVIOUS_YEAR}`
            });

        assert.equal(
            result.status,
            "dated"
        );

        assert.equal(
            result.startYear,
            TWO_YEARS_AGO
        );

        assert.equal(
            result.endYear,
            PREVIOUS_YEAR
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
    "service description is used after layer description",
    () => {

        const result =
            evaluate({
                title:
                    "Chicago Wards",

                serviceDescription:
                    "Current ward boundaries."
            });

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
    "the first temporal tag wins",
    () => {

        const result =
            evaluate({
                title:
                    "Chicago Wards",

                tags: [
                    "municipal boundaries",
                    `Chicago wards ${PREVIOUS_YEAR}`,
                    `current wards ${CURRENT_YEAR}`
                ]
            });

        assert.equal(
            result.status,
            "dated"
        );

        assert.equal(
            result.year,
            PREVIOUS_YEAR
        );

        assert.ok(
            result.reasons.some(
                reason =>
                    reason.includes(
                        `tag "Chicago wards ${PREVIOUS_YEAR}"`
                    )
            )
        );
    }
);


test(
    "type keywords are evaluated after tags",
    () => {

        const result =
            evaluate({
                title:
                    "Chicago Wards",

                tags: [
                    "municipal boundaries"
                ],

                typeKeywords: [
                    `ward boundary ${PREVIOUS_YEAR}`
                ]
            });

        assert.equal(
            result.status,
            "dated"
        );

        assert.equal(
            result.year,
            PREVIOUS_YEAR
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
// attachCurrentYear behavior through validateTemporal()
// =============================================================================

test(
    "current metadata containing the current year preserves that year",
    () => {

        const result =
            evaluate({
                title:
                    `Current Chicago Wards ${CURRENT_YEAR}`
            });

        assert.equal(
            result.status,
            "current"
        );

        assert.equal(
            result.year,
            CURRENT_YEAR
        );
    }
);


test(
    "current metadata without the current year leaves year undefined",
    () => {

        const result =
            evaluate({
                title:
                    "Current Chicago Wards"
            });

        assert.equal(
            result.status,
            "current"
        );

        assert.equal(
            result.year,
            undefined
        );
    }
);


// =============================================================================
// Real-world Tucson-style cases
// =============================================================================

test(
    "TucsonWards2022 is dated rather than historical",
    () => {

        const result =
            evaluate({
                title:
                    "TucsonWards2022"
            });

        /*
         * "2022" is a bare past year in the title.
         *
         * There is no historical language such as "historic" or "former".
         */
        assert.equal(
            result.status,
            "dated"
        );

        assert.equal(
            result.year,
            2022
        );

        assert.equal(
            result.score,
            5
        );
    }
);


test(
    "Chicago 2015-2023 boundary data is dated rather than historical",
    () => {

        const result =
            evaluate({
                title:
                    "Chicago Wards 2015-2023"
            });

        assert.equal(
            result.status,
            "dated"
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
            5
        );
    }
);


test(
    "explicitly historical Chicago 2015-2023 boundary data is historical",
    () => {

        const result =
            evaluate({
                title:
                    "Historical Chicago Wards 2015-2023"
            });

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


// =============================================================================
// Exact score contract
// =============================================================================

test(
    "temporal scores are exactly current=20, dated=5, historical=-60, future=-10, undated=0",
    () => {

        const current =
            evaluate({
                title:
                    `Current Chicago Wards ${CURRENT_YEAR}`
            });

        const dated =
            evaluate({
                title:
                    `Chicago Wards ${PREVIOUS_YEAR}`
            });

        const historical =
            evaluate({
                title:
                    `Historical Chicago Wards ${PREVIOUS_YEAR}`
            });

        const future =
            evaluate({
                title:
                    `Future Chicago Wards ${NEXT_YEAR}`
            });

        const undated =
            evaluate({
                title:
                    "Chicago Wards"
            });

        assert.equal(
            current.score,
            20
        );

        assert.equal(
            dated.score,
            5
        );

        assert.equal(
            historical.score,
            -60
        );

        assert.equal(
            future.score,
            -10
        );

        assert.equal(
            undated.score,
            0
        );
    }
);