import type { DistrictType } from "../generator/src/types.js";

export type CoverageFailureStage =
    | "discovery"
    | "inspection"
    | "classification"
    | "validation"
    | "canonical"
    | "geometry";

export type CoverageFailureCode =
    | "NO_DISCOVERY_CANDIDATES"
    | "NO_VALID_BOUNDARY"
    | "INCOMPLETE_DISTRICT_COVERAGE"
    | "NO_CANONICAL_SOURCE"
    | "GEOMETRY_FETCH_FAILED"
    | "GEOMETRY_VALIDATION_FAILED";

export interface CoverageFixture {
    placeFips: string;
    city: string;
    state: string;
    districtType: DistrictType;

    expectedDistrictCount: number;
    expectedDistrictValues?: string[];
}

export interface CoverageResult {
    placeFips: string;
    city: string;
    state: string;
    districtType: DistrictType;

    expectedDistrictCount: number;

    discoveredCandidateCount: number;
    inspectedCandidateCount: number;
    validCandidateCount: number;
    completeCandidateCount: number;

    canonicalSourceFound?: boolean;
    geometryGenerated?: boolean;

    failureStage?: CoverageFailureStage;
    failureCode?: CoverageFailureCode;
}