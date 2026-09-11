import type { CoverageFixture } from "./types.js";

export const COVERAGE_FIXTURES: CoverageFixture[] = [
    {
        placeFips: "0477000",
        city: "Tucson",
        state: "AZ",
        districtType: "ward",
        expectedDistrictCount: 6,
        expectedDistrictValues: ["1", "2", "3", "4", "5", "6"]
    },

    {
        placeFips: "0455000",
        city: "Phoenix",
        state: "AZ",
        districtType: "council-district",
        expectedDistrictCount: 8,
        expectedDistrictValues: [
            "1",
            "2",
            "3",
            "4",
            "5",
            "6",
            "7",
            "8"
        ]
    },

    {
        placeFips: "1714000",
        city: "Chicago",
        state: "IL",
        districtType: "ward",
        expectedDistrictCount: 50,
        expectedDistrictValues: Array.from(
            { length: 50 },
            (_, index) => String(index + 1)
        )
    }
];