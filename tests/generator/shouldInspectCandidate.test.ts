import assert from "node:assert/strict";
import test from "node:test";

import {
    shouldInspectCandidate
} from "../../generator/src/discover.js";

import type {
    DiscoveryCandidate
} from "../../generator/src/types.js";

function candidate(
    title: string,
    url = "https://maps.example.gov/arcgis/rest/services/example/MapServer/0"
): DiscoveryCandidate {
    return {
        placeFips: "0455000",
        city: "Phoenix",
        state: "AZ",
        url,
        title,
        score: 20,
        requiresReview: false,
        reasons: []
    };
}

// =============================================================================
// Phoenix examples
// =============================================================================

test(
    "should inspect Phoenix Council Districts",
    () => {
        assert.equal(
            shouldInspectCandidate(
                candidate(
                    "Council Districts and Members"
                )
            ),
            true
        );
    }
);

test(
    "should inspect Phoenix Council Districts and Members Hash",
    () => {
        assert.equal(
            shouldInspectCandidate(
                candidate(
                    "Council Districts and Members Hash"
                )
            ),
            true
        );
    }
);

test(
    "should inspect Phoenix Eviction Filings by Council Districts",
    () => {
        assert.equal(
            shouldInspectCandidate(
                candidate(
                    "Eviction Filings by Council Districts"
                )
            ),
            true
        );
    }
);

test(
    "should skip Phoenix EV Charging Sites Public",
    () => {
        assert.equal(
            shouldInspectCandidate(
                candidate(
                    "Phoenix EV Charging Sites: Public"
                )
            ),
            false
        );
    }
);

test(
    "should skip Phoenix EV Charging Sites Fleet",
    () => {
        assert.equal(
            shouldInspectCandidate(
                candidate(
                    "Phoenix EV Charging Sites: Fleet"
                )
            ),
            false
        );
    }
);

test(
    "should skip Phoenix EV Charging Sites Employee",
    () => {
        assert.equal(
            shouldInspectCandidate(
                candidate(
                    "Phoenix EV Charging Sites: Employee"
                )
            ),
            false
        );
    }
);

test(
    "should skip Phoenix Regional EV Charging Sites",
    () => {
        assert.equal(
            shouldInspectCandidate(
                candidate(
                    "Regional EV Charging Sites"
                )
            ),
            false
        );
    }
);

test(
    "should skip Phoenix Public Libraries",
    () => {
        assert.equal(
            shouldInspectCandidate(
                candidate(
                    "Public Libraries"
                )
            ),
            false
        );
    }
);

// =============================================================================
// General gate behavior
// =============================================================================

test(
    "should inspect a ward boundary",
    () => {
        assert.equal(
            shouldInspectCandidate(
                candidate(
                    "Ward Boundaries"
                )
            ),
            true
        );
    }
);

test(
    "should inspect a city council district layer",
    () => {
        assert.equal(
            shouldInspectCandidate(
                candidate(
                    "City Council Districts"
                )
            ),
            true
        );
    }
);

test(
    "should inspect an aldermanic district layer",
    () => {
        assert.equal(
            shouldInspectCandidate(
                candidate(
                    "Aldermanic Districts"
                )
            ),
            true
        );
    }
);

test(
    "should inspect a political dataset even when it has thematic terminology",
    () => {
        assert.equal(
            shouldInspectCandidate(
                candidate(
                    "Crime Statistics by Ward"
                )
            ),
            true
        );
    }
);

test(
    "should skip a thematic dataset without political identity",
    () => {
        assert.equal(
            shouldInspectCandidate(
                candidate(
                    "Public Parks"
                )
            ),
            false
        );
    }
);

test(
    "should skip a candidate with no useful identity",
    () => {
        assert.equal(
            shouldInspectCandidate(
                candidate(
                    "Layer 0",
                    "https://example.com/arcgis/rest/services/0"
                )
            ),
            false
        );
    }
);