import { generateCensusPlaces } from "./generateCensusPlaces.js";
import { discoverArcGIS } from "./discover.js";
import {
    buildRegistry,
    writeRegistry
} from "./registry.js";
import { validateRegistry } from "./validate.js";
import {
    loadGeneratedRegistry
} from "./registry.js";
import {
    generateGeometry
} from "./geometry.js";

import type {
    DiscoveryResult,
    MunicipalDistrictRegistryEntry
} from "./types.js";


// =============================================================================
// Commands
// =============================================================================

type Command =
    | "places"
    | "discover"
    | "build"
    | "geometry"
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
             * Build is currently retained as a compatibility command.
             *
             * Discovery is responsible for producing the registry.
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
        // Geometry
        // ---------------------------------------------------------------------

        case "geometry": {

            await generateRegistryGeometry(
                options
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
// Generate geometry from registry
// =============================================================================

async function generateRegistryGeometry(
    options: CliOptions
): Promise<void> {

    const registry =
        loadGeneratedRegistry();


    let entries =
        registry.entries;


    // =========================================================================
    // Filter
    // =========================================================================

    if (
        options.city !== undefined
    ) {

        const city =
            normalizeName(
                options.city
            );

        entries =
            entries.filter(
                entry =>
                    normalizeName(
                        entry.city
                    ) === city
            );
    }


    if (
        options.state !== undefined
    ) {

        const state =
            options.state.toUpperCase();

        entries =
            entries.filter(
                entry =>
                    entry.state.toUpperCase() ===
                    state
            );
    }


    if (
        options.placeFips !== undefined
    ) {

        entries =
            entries.filter(
                entry =>
                    entry.placeFips ===
                    options.placeFips
            );
    }


    // =========================================================================
    // Nothing found
    // =========================================================================

    if (
        entries.length === 0
    ) {

        console.log(
            "\nNo registry entries matched the supplied options."
        );

        return;
    }


    console.log(
        `\nGenerating geometry for ${entries.length} registry entr${
            entries.length === 1
                ? "y"
                : "ies"
        }...`
    );


    // =========================================================================
    // Output root
    // =========================================================================

    const outputRoot =
        process.cwd();


    let successful = 0;

    let failed = 0;


    // =========================================================================
    // Generate each geometry file
    // =========================================================================

    for (
        const entry of entries
    ) {

        console.log(
            `\n  ${entry.city}, ${entry.state} — ${entry.boundaryType}`
        );

        console.log(
            `    Source: ${entry.source.url}`
        );


        try {

            const outputPath =
                await generateGeometry(
                    entry,
                    outputRoot
                );


            console.log(
                `    ✓ ${outputPath}`
            );


            successful++;

        } catch (error) {

            failed++;


            console.error(
                `    ✗ Geometry generation failed`
            );


            if (
                error instanceof Error
            ) {

                console.error(
                    `      ${error.message}`
                );

            } else {

                console.error(
                    `      ${String(error)}`
                );
            }
        }
    }


    // =========================================================================
    // Summary
    // =========================================================================

    console.log(
        "\nGeometry generation complete."
    );

    console.log(
        `  Requested: ${entries.length}`
    );

    console.log(
        `  Successful: ${successful}`
    );

    console.log(
        `  Failed: ${failed}`
    );


    if (
        failed > 0
    ) {

        process.exitCode = 1;
    }
}


// =============================================================================
// Name normalization
// =============================================================================

function normalizeName(
    value: string
): string {

    return value
        .normalize("NFKD")
        .replace(
            /[\u0300-\u036f]/g,
            ""
        )
        .toLowerCase()
        .replace(
            /['’]/g,
            ""
        )
        .replace(
            /[-]/g,
            " "
        )
        .replace(
            /[^\p{L}\p{N}\s]/gu,
            " "
        )
        .replace(
            /\s+/g,
            " "
        )
        .trim();
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


            if (
                rejected.classification.matches.political.length > 0
            ) {

                console.log(
                    `      Political matches: ${
                        rejected.classification.matches.political.join(", ")
                    }`
                );
            }


            if (
                rejected.classification.matches.thematic.length > 0
            ) {

                console.log(
                    `      Thematic matches: ${
                        rejected.classification.matches.thematic.join(", ")
                    }`
                );
            }


            if (
                rejected.inspection.districtFields.length > 0
            ) {

                console.log(
                    `      District fields: ${
                        rejected.inspection.districtFields.join(", ")
                    }`
                );
            }


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


    if (
        classification.isCensusDataset
    ) {

        reasons.push(
            "census dataset"
        );
    }


    if (
        classification.isParcelDataset
    ) {

        reasons.push(
            "parcel/property dataset"
        );
    }


    if (
        classification.isHousingDataset &&
        !classification.isPoliticalBoundary
    ) {

        reasons.push(
            "housing dataset"
        );
    }


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


    if (
        !classification.isPoliticalBoundary
    ) {

        reasons.push(
            "did not meet political-boundary threshold"
        );
    }


    if (
        classification.matches.thematic.length > 0
    ) {

        reasons.push(
            `thematic evidence: ${
                classification.matches.thematic.join(", ")
            }`
        );
    }


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


            case "--review": {

                options.review =
                    true;

                break;
            }


            case "--verbose": {

                options.verbose =
                    true;

                break;
            }


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

  npm run geometry

  npm run geometry -- --city Tucson --state AZ

  npm run geometry -- --state AZ

  npm run geometry -- --placeFips 0477000

  npm run validate


Commands:

  places
      Download the Census National Places Gazetteer
      and generate census-places.json.

  discover
      Search ArcGIS, inspect discovered layers,
      classify candidates, detect equivalent layers,
      select canonical municipal district sources,
      and write registry.json.

  build
      Build the registry.
      Retained as a compatibility command.

  geometry
      Download GeoJSON geometry for registry entries
      and write the normalized geometry files.

  validate
      Validate the generated municipal registry.


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