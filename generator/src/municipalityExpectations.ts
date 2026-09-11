import type { DistrictType } from "./types.js";

export interface MunicipalDivisionExpectation {
    placeFips: string;
    districtType: DistrictType;
    expectedDistrictCount: number;
    expectedDistrictValues?: string[];
}

const MUNICIPAL_DIVISION_EXPECTATIONS:
    MunicipalDivisionExpectation[] = [
    {
        placeFips: "0455000",
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
        placeFips: "0477000",
        districtType: "ward",
        expectedDistrictCount: 6,
        expectedDistrictValues: [
            "1",
            "2",
            "3",
            "4",
            "5",
            "6"
        ]
    },
    {
        placeFips: "1714000",
        districtType: "ward",
        expectedDistrictCount: 50,
        expectedDistrictValues: Array.from(
            { length: 50 },
            (_, index) => String(index + 1)
        )
    }
];

export function getMunicipalDivisionExpectation(
    placeFips: string,
    districtType: DistrictType
): MunicipalDivisionExpectation | undefined {
    return MUNICIPAL_DIVISION_EXPECTATIONS.find(
        expectation =>
            expectation.placeFips === placeFips &&
            expectation.districtType === districtType
    );
}