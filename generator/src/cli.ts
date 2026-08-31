import { generateCensusPlaces } from "./generateCensusPlaces.js";
import { discoverArcGIS } from "./discover.js";
import {
    buildRegistry,
    writeRegistry
} from "./registry.js";
import { validateRegistry } from "./validate.js";

import type {
    DiscoveryResult
} from "./types.js";


// =============================================================================
// Commands
// =============================================================================

type Command =
    | "places"
    | "discover"
    | "build"
    | "validate"
    | undefined;


// =============================================================================
// CLI options
// =============================================================================

interface CliOptions {

    city?: string;

    state?: string;

    placeFips?: string;

    review?: boolean;

    verbose?: boolean;
}


// =============================================================================
// Main
// =============================================================================

const command =
    process.argv[2] as Command;


async function main(): Promise<void> {

    const options =
        parseOptions(
            process.argv.slice(3)
        );


    switch (command) {

        // ---------------------------------------------------------------------
        // Places
        // ---------------------------------------------------------------------

        case "places": {

            await generateCensusPlaces();

            break;
        }


        // ---------------------------------------------------------------------
        // Discover
        // ---------------------------------------------------------------------

        case "discover": {

            const results =
                await discoverArcGIS(
                    options
                );


            printDiscoverySummary(
                results
            );


            // ---------------------------------------------------------------
            // Write registry
            // ---------------------------------------------------------------

            const registry =
                writeRegistry(
                    results
                );


            console.log(
                `\nRegistry entries: ${registry.entries.length}`
            );

            break;
        }


        // ---------------------------------------------------------------------
        // Build
        // ---------------------------------------------------------------------

        case "build": {

            /*
             * Build is currently kept as a compatibility command.
             *
             * If registry.ts eventually reads persisted DiscoveryResult
             * data, this command can be expanded later.
             */

            const registry =
                buildRegistry(
                    []
                );


            console.log(
                `Built registry with ${registry.entries.length} entries.`
            );

            break;
        }


        // ---------------------------------------------------------------------
        // Validate
        // ---------------------------------------------------------------------

        case "validate": {

            await validateRegistry();

            break;
        }


        // ---------------------------------------------------------------------
        // Help
        // ---------------------------------------------------------------------

        default: {

            printUsage();

            process.exitCode = 1;
        }
    }
}


// =============================================================================
// Discovery summary
// =============================================================================

function printDiscoverySummary(
    results: DiscoveryResult[]
): void {

    const successful =
        results.filter(
            result =>
                result.canonical !== undefined
        );


    const failed =
        results.filter(
            result =>
                result.error !== undefined
        );


    const noCanonical =
        results.filter(
            result =>
                result.error === undefined &&
                result.canonical === undefined
        );


    const totalCandidates =
        results.reduce(
            (
                total,
                result
            ) =>
                total +
                result.candidates.length,
            0
        );


    const totalInspected =
        results.reduce(
            (
                total,
                result
            ) =>
                total +
                result.inspectedCandidates.length,
            0
        );


    const totalValid =
        results.reduce(
            (
                total,
                result
            ) =>
                total +
                result.validCandidates.length,
            0
        );


    const totalRejected =
        results.reduce(
            (
                total,
                result
            ) =>
                total +
                result.rejectedCandidates.length,
            0
        );


    const totalGroups =
        results.reduce(
            (
                total,
                result
            ) =>
                total +
                result.equivalentGroups.length,
            0
        );


    console.log(
        "\nDiscovery complete."
    );


    console.log(
        `  Municipalities: ${results.length}`
    );


    console.log(
        `  Search candidates: ${totalCandidates}`
    );


    console.log(
        `  Inspected: ${totalInspected}`
    );


    console.log(
        `  Valid: ${totalValid}`
    );


    console.log(
        `  Rejected: ${totalRejected}`
    );


    console.log(
        `  Equivalence groups: ${totalGroups}`
    );


    console.log(
        `  Canonical sources: ${successful.length}`
    );


    console.log(
        `  No canonical source: ${noCanonical.length}`
    );


    console.log(
        `  Failed municipalities: ${failed.length}`
    );


    // =========================================================================
    // Failed municipalities
    // =========================================================================

    if (
        failed.length > 0
    ) {

        console.log(
            "\nFailed municipalities:"
        );


        for (
            const result of failed
        ) {

            console.log(
                `  ${result.place.city}, ${result.place.state}`
            );


            if (result.error) {

                console.log(
                    `    ${result.error}`
                );
            }
        }
    }


    // =========================================================================
    // Municipalities without canonical sources
    // =========================================================================

    if (
        noCanonical.length > 0
    ) {

        console.log(
            "\nMunicipalities without canonical sources:"
        );


        for (
            const result of noCanonical
        ) {

            console.log(
                `  ${result.place.city}, ${result.place.state}`
            );
        }
    }


    // =========================================================================
    // Rejection report
    // =========================================================================

    printRejectionReport(
        results
    );
}


// =============================================================================
// Rejection report
// =============================================================================

function printRejectionReport(
    results: DiscoveryResult[]
): void {

    let totalRejected = 0;


    console.log(
        "\nRejection report:"
    );


    for (
        const result of results
    ) {

        if (
            result.rejectedCandidates.length === 0
        ) {
            continue;
        }


        console.log(
            `\n  ${result.place.city}, ${result.place.state}`
        );


        for (
            const rejected of
            result.rejectedCandidates
        ) {

            totalRejected++;


            const title =
                rejected.inspection.title ??
                rejected.inspection.layerName ??
                rejected.inspection.serviceName ??
                "(untitled)";


            const reasons =
                getRejectionReasons(
                    rejected
                );


            console.log(
                `\n    ✗ ${title}`
            );


            console.log(
                `      ${rejected.inspection.url}`
            );


            console.log(
                `      Reasons: ${reasons.join("; ")}`
            );


            // -----------------------------------------------------------------
            // Political matches
            // -----------------------------------------------------------------

            if (
                rejected.classification.matches.political.length > 0
            ) {

                console.log(
                    `      Political matches: ${
                        rejected.classification.matches.political.join(", ")
                    }`
                );
            }


            // -----------------------------------------------------------------
            // Thematic matches
            // -----------------------------------------------------------------

            if (
                rejected.classification.matches.thematic.length > 0
            ) {

                console.log(
                    `      Thematic matches: ${
                        rejected.classification.matches.thematic.join(", ")
                    }`
                );
            }


            // -----------------------------------------------------------------
            // District fields
            // -----------------------------------------------------------------

            if (
                rejected.inspection.districtFields.length > 0
            ) {

                console.log(
                    `      District fields: ${
                        rejected.inspection.districtFields.join(", ")
                    }`
                );
            }


            // -----------------------------------------------------------------
            // Name fields
            // -----------------------------------------------------------------

            if (
                rejected.inspection.nameFields.length > 0
            ) {

                console.log(
                    `      Name fields: ${
                        rejected.inspection.nameFields.join(", ")
                    }`
                );
            }
        }
    }


    console.log(
        `\n  Total rejected candidates: ${totalRejected}`
    );
}


// =============================================================================
// Rejection reasons
// =============================================================================

function getRejectionReasons(
    candidate:
        DiscoveryResult["rejectedCandidates"][number]
): string[] {

    const reasons: string[] = [];


    const classification =
        candidate.classification;


    const inspection =
        candidate.inspection;


    // =========================================================================
    // Geometry
    // =========================================================================

    const isPolygon =
        inspection.geometryType ===
            "esriGeometryPolygon" ||
        inspection.geometryType ===
            "polygon";


    if (
        !isPolygon
    ) {

        reasons.push(
            "not polygon geometry"
        );
    }


    // =========================================================================
    // Census
    // =========================================================================

    if (
        classification.isCensusDataset
    ) {

        reasons.push(
            "census dataset"
        );
    }


    // =========================================================================
    // Parcel
    // =========================================================================

    if (
        classification.isParcelDataset
    ) {

        reasons.push(
            "parcel/property dataset"
        );
    }


    // =========================================================================
    // Housing
    // =========================================================================

    if (
        classification.isHousingDataset &&
        !classification.isPoliticalBoundary
    ) {

        reasons.push(
            "housing dataset"
        );
    }


    // =========================================================================
    // District field
    // =========================================================================

    const hasDistrictField =
        inspection.districtFields.length > 0;


    const politicalDistrictField =
        inspection.districtFields.some(
            field => {

                const normalized =
                    field
                        .toLowerCase()
                        .replace(
                            /[_-]+/g,
                            " "
                        );


                return (
                    /\bward\b/.test(normalized) ||
                    /\bdistrict\b/.test(normalized) ||
                    /\bcouncil\b/.test(normalized) ||
                    /\balderman/.test(normalized)
                );
            }
        );


    if (
        hasDistrictField &&
        !politicalDistrictField &&
        !classification.isPoliticalBoundary
    ) {

        reasons.push(
            "district field does not appear political"
        );
    }


    // =========================================================================
    // Political boundary
    // =========================================================================

    if (
        !classification.isPoliticalBoundary
    ) {

        reasons.push(
            "did not meet political-boundary threshold"
        );
    }


    // =========================================================================
    // Thematic evidence
    // =========================================================================

    if (
        classification.matches.thematic.length > 0
    ) {

        reasons.push(
            `thematic evidence: ${
                classification.matches.thematic.join(", ")
            }`
        );
    }


    // =========================================================================
    // Fallback
    // =========================================================================

    if (
        reasons.length === 0
    ) {

        reasons.push(
            "classification.rejected = true"
        );
    }


    return reasons;
}


// =============================================================================
// CLI options
// =============================================================================

function parseOptions(
    args: string[]
): CliOptions {

    const options:
        CliOptions = {};


    for (
        let i = 0;
        i < args.length;
        i++
    ) {

        const argument =
            args[i];


        switch (argument) {

            // -----------------------------------------------------------------
            // City
            // -----------------------------------------------------------------

            case "--city": {

                const value =
                    args[++i];


                if (!value) {

                    throw new Error(
                        "--city requires a value."
                    );
                }


                options.city =
                    value;

                break;
            }


            // -----------------------------------------------------------------
            // State
            // -----------------------------------------------------------------

            case "--state": {

                const value =
                    args[++i];


                if (!value) {

                    throw new Error(
                        "--state requires a value."
                    );
                }


                options.state =
                    value.toUpperCase();

                break;
            }


            // -----------------------------------------------------------------
            // Place FIPS
            // -----------------------------------------------------------------

            case "--placeFips": {

                const value =
                    args[++i];


                if (!value) {

                    throw new Error(
                        "--placeFips requires a value."
                    );
                }


                options.placeFips =
                    value;

                break;
            }


            // -----------------------------------------------------------------
            // Review
            // -----------------------------------------------------------------

            case "--review": {

                options.review =
                    true;

                break;
            }


            // -----------------------------------------------------------------
            // Verbose
            // -----------------------------------------------------------------

            case "--verbose": {

                options.verbose =
                    true;

                break;
            }


            // -----------------------------------------------------------------
            // Unknown option
            // -----------------------------------------------------------------

            default: {

                throw new Error(
                    `Unknown option: ${argument}`
                );
            }
        }
    }


    return options;
}


// =============================================================================
// Usage
// =============================================================================

function printUsage(): void {

    console.log(`
U.S. Municipal Districts Generator

Usage:

  npm run places

  npm run discover

  npm run discover -- --city Tucson --state AZ

  npm run discover -- --state AZ

  npm run discover -- --placeFips 0477000

  npm run discover -- --placeFips 0477000 --verbose

  npm run build

  npm run validate


Commands:

  places
      Download the Census National Places Gazetteer
      and generate census-places.json.

  discover
      Search ArcGIS, inspect discovered layers,
      classify candidates, detect equivalent layers,
      and select canonical municipal district sources.

  build
      Build the registry.

  validate
      Validate the generated registry.


Discover options:

  --city <city>
      Process only municipalities matching this city name.

  --state <state>
      Process only municipalities in this state.

  --placeFips <fips>
      Process only the specified Census place.

  --review
      Enable manual-review handling.

  --verbose
      Print detailed discovery information.
`);
}


// =============================================================================
// Error handling
// =============================================================================

main().catch(
    error => {

        console.error(
            "\nGenerator failed:\n"
        );


        console.error(
            error
        );


        process.exitCode = 1;
    }
);