import {
    performance
} from "node:perf_hooks";


import {
    COVERAGE_FIXTURES
} from "./fixtures.js";


import type {
    CoverageFixture,
    CoverageResult
} from "./types.js";


import {
    discoverArcGIS
} from "../generator/src/discover.js";


import type {
    DiscoveryResult,
    InspectedCandidate
} from "../generator/src/types.js";


// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {

    console.log(
        "\nMunicipal Division Coverage"
    );

    console.log(
        "===========================\n"
    );


    const results: CoverageResult[] = [];


    for (
        const fixture of COVERAGE_FIXTURES
    ) {

        console.log(
            `${fixture.city}, ${fixture.state}`
        );

        console.log(
            `  Type: ${fixture.districtType}`
        );

        console.log(
            `  Expected districts: ${fixture.expectedDistrictCount}`
        );


        const startTime =
            performance.now();


        try {

            const result =
                await evaluateFixture(
                    fixture
                );


            result.runtimeMs =
                performance.now() -
                startTime;


            results.push(
                result
            );


            printResult(
                result
            );

        } catch (error) {

            const runtimeMs =
                performance.now() -
                startTime;


            const result: CoverageResult = {

                placeFips:
                    fixture.placeFips,

                city:
                    fixture.city,

                state:
                    fixture.state,

                districtType:
                    fixture.districtType,

                expectedDistrictCount:
                    fixture.expectedDistrictCount,


                discoveredCandidateCount:
                    0,

                inspectedCandidateCount:
                    0,

                validCandidateCount:
                    0,

                completeCandidateCount:
                    0,


                canonicalSourceFound:
                    false,

                geometryGenerated:
                    false,


                runtimeMs,


                failureStage:
                    "discovery",

                failureCode:
                    "NO_DISCOVERY_CANDIDATES"
            };


            results.push(
                result
            );


            console.log(
                `  ERROR: ${
                    error instanceof Error
                        ? error.message
                        : String(error)
                }`
            );

            console.log(
                `  Runtime: ${formatRuntime(runtimeMs)}`
            );
        }


        console.log();
    }


    printSummary(
        results
    );
}


// =============================================================================
// Evaluate one fixture
// =============================================================================

async function evaluateFixture(
    fixture: CoverageFixture
): Promise<CoverageResult> {

    const discoveryResults =
        await discoverArcGIS({
            city:
                fixture.city,

            state:
                fixture.state,

            placeFips:
                fixture.placeFips
        });


    const discovery =
        discoveryResults[0];


    if (!discovery) {

        return {
            ...createEmptyResult(
                fixture
            ),

            failureStage:
                "discovery",

            failureCode:
                "NO_DISCOVERY_CANDIDATES"
        };
    }


    // =========================================================================
    // Filter candidates to the expected district type
    // =========================================================================

    const typeCandidates =
        discovery.inspectedCandidates.filter(
            candidate =>
                candidate.classification.districtType ===
                fixture.districtType
        );


    // =========================================================================
    // Discovery
    // =========================================================================

    if (
        discovery.candidates.length === 0
    ) {

        return createResult(
            fixture,
            discovery,
            typeCandidates,
            "discovery",
            "NO_DISCOVERY_CANDIDATES"
        );
    }


    // =========================================================================
    // Inspection / classification
    // =========================================================================

    if (
        typeCandidates.length === 0
    ) {

        return createResult(
            fixture,
            discovery,
            typeCandidates,
            "classification",
            "NO_VALID_BOUNDARY"
        );
    }


    // =========================================================================
    // Valid candidates
    // =========================================================================

    const validCandidates =
        typeCandidates.filter(
            candidate =>
                discovery.validCandidates.includes(
                    candidate
                )
        );


    if (
        validCandidates.length === 0
    ) {

        return createResult(
            fixture,
            discovery,
            typeCandidates,
            "validation",
            "NO_VALID_BOUNDARY"
        );
    }


    // =========================================================================
    // Complete candidates
    // =========================================================================

    const completeCandidates =
        validCandidates.filter(
            candidate =>
                isCompleteCandidate(
                    candidate,
                    fixture
                )
        );


    if (
        completeCandidates.length === 0
    ) {

        return createResult(
            fixture,
            discovery,
            typeCandidates,
            "validation",
            "INCOMPLETE_DISTRICT_COVERAGE"
        );
    }


    // =========================================================================
    // Success
    // =========================================================================

    return createResult(
        fixture,
        discovery,
        typeCandidates,
        undefined,
        undefined
    );
}


// =============================================================================
// Determine whether a candidate completely covers the fixture
// =============================================================================

function isCompleteCandidate(
    candidate: InspectedCandidate,
    fixture: CoverageFixture
): boolean {

    const validation =
        candidate.validation;


    // -------------------------------------------------------------------------
    // Prefer the validation result when available
    // -------------------------------------------------------------------------

    if (
        validation?.completeDistrictCoverage === true
    ) {

        return true;
    }


    // -------------------------------------------------------------------------
    // Independently verify expected district values
    //
    // This is important because evaluation fixtures are ground truth and
    // should not depend entirely on production municipality expectations.
    // -------------------------------------------------------------------------

    if (
        fixture.expectedDistrictValues === undefined
    ) {

        return (
            validation?.distinctDistrictValues.length ===
            fixture.expectedDistrictCount
        );
    }


    const actualValues =
        new Set(
            validation?.distinctDistrictValues ?? []
        );


    if (
        actualValues.size !==
        fixture.expectedDistrictValues.length
    ) {

        return false;
    }


    return fixture.expectedDistrictValues.every(
        expectedValue =>
            actualValues.has(
                expectedValue
            )
    );
}


// =============================================================================
// Create empty result
// =============================================================================

function createEmptyResult(
    fixture: CoverageFixture
): CoverageResult {

    return {

        placeFips:
            fixture.placeFips,

        city:
            fixture.city,

        state:
            fixture.state,

        districtType:
            fixture.districtType,

        expectedDistrictCount:
            fixture.expectedDistrictCount,


        discoveredCandidateCount:
            0,

        inspectedCandidateCount:
            0,

        validCandidateCount:
            0,

        completeCandidateCount:
            0,


        canonicalSourceFound:
            false,

        geometryGenerated:
            false,


        runtimeMs:
            0
    };
}


// =============================================================================
// Create result
// =============================================================================

function createResult(
    fixture: CoverageFixture,
    discovery: DiscoveryResult,
    typeCandidates: InspectedCandidate[],
    failureStage?: CoverageResult["failureStage"],
    failureCode?: CoverageResult["failureCode"]
): CoverageResult {

    const validCandidates =
        typeCandidates.filter(
            candidate =>
                discovery.validCandidates.includes(
                    candidate
                )
        );


    const completeCandidates =
        validCandidates.filter(
            candidate =>
                isCompleteCandidate(
                    candidate,
                    fixture
                )
        );


    return {

        placeFips:
            fixture.placeFips,

        city:
            fixture.city,

        state:
            fixture.state,

        districtType:
            fixture.districtType,

        expectedDistrictCount:
            fixture.expectedDistrictCount,


        discoveredCandidateCount:
            discovery.candidates.length,

        inspectedCandidateCount:
            typeCandidates.length,

        validCandidateCount:
            validCandidates.length,

        completeCandidateCount:
            completeCandidates.length,


        /*
         * Canonical and geometry evaluation are intentionally not wired
         * into this first instrumentation version. Those will be evaluated
         * separately once discovery/validation coverage is established.
         */
        canonicalSourceFound:
            false,

        geometryGenerated:
            false,


        /*
         * Runtime is assigned by main() after evaluateFixture() completes.
         */
        runtimeMs:
            0,


        failureStage,

        failureCode
    };
}


// =============================================================================
// Format runtime
// =============================================================================

function formatRuntime(
    runtimeMs: number
): string {

    return (
        `${(runtimeMs / 1000).toFixed(2)}s`
    );
}


// =============================================================================
// Print individual result
// =============================================================================

function printResult(
    result: CoverageResult
): void {

    console.log(
        `  Discovered candidates: ${result.discoveredCandidateCount}`
    );

    console.log(
        `  Matching district type: ${result.inspectedCandidateCount}`
    );

    console.log(
        `  Valid boundaries: ${result.validCandidateCount}`
    );

    console.log(
        `  Complete boundaries: ${result.completeCandidateCount}`
    );

    console.log(
        `  Runtime: ${formatRuntime(result.runtimeMs)}`
    );


    if (
        result.failureCode === undefined
    ) {

        console.log(
            "  Status: PASS"
        );

        return;
    }


    console.log(
        "  Status: FAIL"
    );

    console.log(
        `  Failure: ${result.failureCode}`
    );
}


// =============================================================================
// Summary
// =============================================================================

function printSummary(
    results: CoverageResult[]
): void {

    const total =
        results.length;


    const discoveryCoverage =
        results.filter(
            result =>
                result.discoveredCandidateCount > 0
        ).length;


    const validCoverage =
        results.filter(
            result =>
                result.validCandidateCount > 0
        ).length;


    const completeCoverage =
        results.filter(
            result =>
                result.completeCandidateCount > 0
        ).length;


    const passed =
        results.filter(
            result =>
                result.failureCode === undefined
        ).length;


    const totalRuntimeMs =
        results.reduce(
            (sum, result) =>
                sum + result.runtimeMs,
            0
        );


    const averageRuntimeMs =
        total > 0
            ? totalRuntimeMs / total
            : 0;


    const slowestResult =
        results.length > 0
            ? results.reduce(
                (slowest, result) =>
                    result.runtimeMs >
                    slowest.runtimeMs
                        ? result
                        : slowest,
                results[0]
            )
            : undefined;


    const fastestResult =
        results.length > 0
            ? results.reduce(
                (fastest, result) =>
                    result.runtimeMs <
                    fastest.runtimeMs
                        ? result
                        : fastest,
                results[0]
            )
            : undefined;


    console.log(
        "\nSUMMARY"
    );

    console.log(
        "======="
    );


    console.log(
        `\nEvaluation cases:       ${total}`
    );

    console.log(
        `Discovery coverage:     ${discoveryCoverage} / ${total}`
    );

    console.log(
        `Valid coverage:         ${validCoverage} / ${total}`
    );

    console.log(
        `Complete coverage:      ${completeCoverage} / ${total}`
    );

    console.log(
        `Passed:                 ${passed} / ${total}`
    );


    // -------------------------------------------------------------------------
    // Runtime
    // -------------------------------------------------------------------------

    console.log(
        "\nRuntime:"
    );

    console.log(
        `  Total:                ${formatRuntime(totalRuntimeMs)}`
    );

    console.log(
        `  Average:              ${formatRuntime(averageRuntimeMs)}`
    );


    if (
        slowestResult
    ) {

        console.log(
            `  Slowest:              ${slowestResult.city}, ${slowestResult.state} (${formatRuntime(slowestResult.runtimeMs)})`
        );
    }


    if (
        fastestResult
    ) {

        console.log(
            `  Fastest:              ${fastestResult.city}, ${fastestResult.state} (${formatRuntime(fastestResult.runtimeMs)})`
        );
    }


    // -------------------------------------------------------------------------
    // Failure breakdown
    // -------------------------------------------------------------------------

    const failures =
        new Map<
            string,
            number
        >();


    for (
        const result of results
    ) {

        if (
            result.failureCode === undefined
        ) {

            continue;
        }


        failures.set(
            result.failureCode,
            (failures.get(
                result.failureCode
            ) ?? 0) + 1
        );
    }


    if (
        failures.size > 0
    ) {

        console.log(
            "\nFailure modes:"
        );


        for (
            const [
                code,
                count
            ] of failures
        ) {

            console.log(
                `  ${code}: ${count}`
            );
        }
    }
}


// =============================================================================
// Run
// =============================================================================

main().catch(
    error => {

        console.error(
            "\nCoverage evaluation failed:"
        );

        console.error(
            error
        );

        process.exitCode = 1;
    }
);