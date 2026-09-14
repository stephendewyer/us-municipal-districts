import type {
    DiscoveryCandidate,
    DistrictType
} from "./types.js";

// =============================================================================
// Types
// =============================================================================

export type ExpectedDistrictCountSource =
    | "municipal-source"
    | "state"
    | "official-election"
    | "manual";

export interface ExpectedDistrictCount {
    count: number;
    source: ExpectedDistrictCountSource;
    confidence: number;
}

// =============================================================================
// Known municipal district counts
// =============================================================================
//
// IMPORTANT:
//
// These values must come from an independent source of truth.
//
// They must NOT be calculated from:
//     - featureCount
//     - distinctDistrictValues
//     - observed geometry
//     - ArcGIS fields
//
// The purpose of this table is to establish what the municipality
// is expected to contain independently of the discovered dataset.
//
// =============================================================================

interface DistrictCountEntry {
    city: string;
    state: string;
    districtType: DistrictType;
    count: number;
    source: ExpectedDistrictCountSource;
    confidence: number;
}

const EXPECTED_DISTRICT_COUNTS: DistrictCountEntry[] = [
    {
        city: "phoenix",
        state: "az",
        districtType: "council-district",
        count: 8,
        source: "municipal-source",
        confidence: 100
    },
    {
        city: "phoenix",
        state: "az",
        districtType: "city-council-district",
        count: 8,
        source: "municipal-source",
        confidence: 100
    },
    {
        city: "tucson",
        state: "az",
        districtType: "ward",
        count: 6,
        source: "municipal-source",
        confidence: 100
    }
];

// =============================================================================
// Helpers
// =============================================================================

function normalize(
    value: string | undefined
): string {
    return (value ?? "")
        .replace(
            /([a-z])([A-Z])/g,
            "$1 $2"
        )
        .replace(
            /[_-]+/g,
            " "
        )
        .replace(
            /\s+/g,
            " "
        )
        .toLowerCase()
        .trim();
}

// =============================================================================
// Expected district count
// =============================================================================

export function getExpectedDistrictCount(
    candidate: DiscoveryCandidate,
    districtType: DistrictType | undefined
): ExpectedDistrictCount | undefined {

    if (!districtType) {
        return undefined;
    }

    const city =
        normalize(
            candidate.city
        );

    const state =
        normalize(
            candidate.state
        );

    if (!city || !state) {
        return undefined;
    }

    const entry =
        EXPECTED_DISTRICT_COUNTS.find(
            item =>
                item.city === city &&
                item.state === state &&
                item.districtType === districtType
        );

    if (!entry) {
        return undefined;
    }

    return {
        count: entry.count,
        source: entry.source,
        confidence: entry.confidence
    };
}