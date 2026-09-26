import path from "node:path";

import { generateCensusPlaces } from "./generateCensusPlaces.js";

import {
    discoverArcGISWithTiming,
    type DiscoveryTiming
} from "./discover.js";

import {
    writeRegistry,
    loadGeneratedRegistry
} from "./registry.js";

import {
    validateRegistry,
    validateRegistryFile
} from "./validate.js";

import {
    generateGeometry
} from "./geometry.js";

import type {
    DiscoveryResult
} from "./types.js";

// =============================================================================
// Commands
// =============================================================================

type Command =
    | "places"
    | "discover"
    | "generate"
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
    registry?: string;
}

// =============================================================================
// Runtime shape guards
// =============================================================================

function isRecord(
    value: unknown
): value is Record<string, unknown> {
    return (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
    );
}

function isString(
    value: unknown
): value is string {
    return typeof value === "string";
}

function isStringArray(
    value: unknown
): value is string[] {
    return (
        Array.isArray(value) &&
        value.every(
            item =>
                typeof item === "string"
        )
    );
}

/**
 * Validate the classification structure actually consumed by
 * the CLI rejection/diagnostic reporting code.
 *
 * This is intentionally narrower than a full runtime validation
 * of CandidateClassification. Its purpose is to prevent malformed
 * discovery data from crashing the CLI while reporting results.
 */
function isClassificationShape(
    value: unknown
): value is {
    isCensusDataset?: boolean;
    isParcelDataset?: boolean;
    isHousingDataset?: boolean;
    isPoliticalBoundary?: boolean;
    rejectionReasons?: string[];
    matches: {
        political?: string[];
        thematic?: string[];
    };
} {
    if (!isRecord(value)) {
        return false;
    }

    if (
        "isCensusDataset" in value &&
        value.isCensusDataset !== undefined &&
        typeof value.isCensusDataset !== "boolean"
    ) {
        return false;
    }

    if (
        "isParcelDataset" in value &&
        value.isParcelDataset !== undefined &&
        typeof value.isParcelDataset !== "boolean"
    ) {
        return false;
    }

    if (
        "isHousingDataset" in value &&
        value.isHousingDataset !== undefined &&
        typeof value.isHousingDataset !== "boolean"
    ) {
        return false;
    }

    if (
        "isPoliticalBoundary" in value &&
        value.isPoliticalBoundary !== undefined &&
        typeof value.isPoliticalBoundary !== "boolean"
    ) {
        return false;
    }

    if (
        "rejectionReasons" in value &&
        value.rejectionReasons !== undefined &&
        !isStringArray(
            value.rejectionReasons
        )
    ) {
        return false;
    }

    if (
        !("matches" in value) ||
        !isRecord(value.matches)
    ) {
        return false;
    }

    if (
        "political" in value.matches &&
        value.matches.political !== undefined &&
        !isStringArray(
            value.matches.political
        )
    ) {
        return false;
    }

    if (
        "thematic" in value.matches &&
        value.matches.thematic !== undefined &&
        !isStringArray(
            value.matches.thematic
        )
    ) {
        return false;
    }

    return true;
}

/**
 * Validate only the runtime shape required by the rejection reporter.
 *
 * This intentionally does not attempt to reproduce every TypeScript
 * interface at runtime. It validates the nested objects and scalar
 * properties that the CLI actually reads.
 */
function isCandidateShape(
    value: unknown
): value is DiscoveryResult["rejectedCandidates"][number] {

    if (!isRecord(value)) {
        return false;
    }

    const candidate =
        value.candidate;

    const inspection =
        value.inspection;

    const classification =
        value.classification;

    if (
        !isRecord(candidate) ||
        !isRecord(inspection) ||
        !isClassificationShape(
            classification
        )
    ) {
        return false;
    }

    /*
     * Candidate identity fields are optional, but when present
     * they must have the expected primitive type.
     */
    if (
        "url" in candidate &&
        candidate.url !== undefined &&
        !isString(candidate.url)
    ) {
        return false;
    }

    if (
        "title" in candidate &&
        candidate.title !== undefined &&
        !isString(candidate.title)
    ) {
        return false;
    }

    /*
     * Inspection identity fields are also optional.
     */
    if (
        "url" in inspection &&
        inspection.url !== undefined &&
        !isString(inspection.url)
    ) {
        return false;
    }

    if (
        "title" in inspection &&
        inspection.title !== undefined &&
        !isString(inspection.title)
    ) {
        return false;
    }

    if (
        "layerName" in inspection &&
        inspection.layerName !== undefined &&
        !isString(inspection.layerName)
    ) {
        return false;
    }

    if (
        "serviceName" in inspection &&
        inspection.serviceName !== undefined &&
        !isString(inspection.serviceName)
    ) {
        return false;
    }

    /*
     * Optional nested structures must be objects when present.
     */
    if (
        "validation" in value &&
        value.validation !== undefined &&
        !isRecord(value.validation)
    ) {
        return false;
    }

    if (
        "municipalityGeographyValidation" in value &&
        value.municipalityGeographyValidation !== undefined &&
        !isRecord(
            value.municipalityGeographyValidation
        )
    ) {
        return false;
    }

    return true;
}

// =============================================================================
// Safe candidate display helpers
// =============================================================================

function getCandidateTitle(
    candidate: unknown
): string {

    if (
        !isCandidateShape(candidate)
    ) {
        return "[malformed candidate]";
    }

    const inspection =
        candidate.inspection;

    const discoveredCandidate =
        candidate.candidate;

    const title =
        inspection.title ??
        inspection.layerName ??
        inspection.serviceName ??
        discoveredCandidate.title;

    return isString(title) &&
        title.trim().length > 0
        ? title
        : "[untitled candidate]";
}

function getCandidateUrl(
    candidate: unknown
): string {

    if (
        !isCandidateShape(candidate)
    ) {
        return "[malformed candidate]";
    }

    const inspection =
        candidate.inspection;

    const discoveredCandidate =
        candidate.candidate;

    const url =
        inspection.url ??
        discoveredCandidate.url;

    return isString(url) &&
        url.trim().length > 0
        ? url
        : "[unknown URL]";
}

// =============================================================================
// Rejection data guards
// =============================================================================

function hasValidationRejectionReasons(
    candidate: unknown
): candidate is
    DiscoveryResult["rejectedCandidates"][number] & {
        validation: NonNullable<
            DiscoveryResult["rejectedCandidates"][number]["validation"]
        >;
    } {

    if (
        !isCandidateShape(candidate)
    ) {
        return false;
    }

    const validation =
        candidate.validation;

    if (
        validation === undefined
    ) {
        return false;
    }

    return (
        isStringArray(
            validation.rejectionReasons
        ) &&
        validation.rejectionReasons.length > 0
    );
}

function hasGeographyRejectionReasons(
    candidate: unknown
): candidate is
    DiscoveryResult["rejectedCandidates"][number] & {
        municipalityGeographyValidation:
            NonNullable<
                DiscoveryResult["rejectedCandidates"][number][
                    "municipalityGeographyValidation"
                ]
            >;
    } {

    if (
        !isCandidateShape(candidate)
    ) {
        return false;
    }

    const geography =
        candidate.municipalityGeographyValidation;

    if (
        geography === undefined
    ) {
        return false;
    }

    return (
        geography.status === "no-match" &&
        isStringArray(
            geography.reasons
        ) &&
        geography.reasons.length > 0
    );
}

function hasClassificationRejectionReasons(
    candidate: unknown
): candidate is
    DiscoveryResult["rejectedCandidates"][number] & {
        classification:
            DiscoveryResult["rejectedCandidates"][number]["classification"] & {
                rejectionReasons: string[];
            };
    } {

    if (
        !isCandidateShape(candidate)
    ) {
        return false;
    }

    const classification =
        candidate.classification;

    if (
        !isClassificationShape(
            classification
        )
    ) {
        return false;
    }

    return (
        isStringArray(
            classification.rejectionReasons
        ) &&
        classification.rejectionReasons.length > 0
    );
}

// =============================================================================
// Rejection reasons
// =============================================================================

function getRejectionReasons(
    candidate: unknown
): string[] {

    if (
        !isCandidateShape(candidate)
    ) {
        return [
            "malformed candidate shape"
        ];
    }

    // -------------------------------------------------------------------------
    // Validation rejection
    // -------------------------------------------------------------------------

    if (
        hasValidationRejectionReasons(
            candidate
        )
    ) {
        const rejectionReasons =
            candidate.validation.rejectionReasons;

        if (
            isStringArray(
                rejectionReasons
            )
        ) {
            return [
                ...rejectionReasons
            ];
        }
    }

    // -------------------------------------------------------------------------
    // Municipality geography rejection
    // -------------------------------------------------------------------------

    if (
        hasGeographyRejectionReasons(
            candidate
        )
    ) {
        const geography =
            candidate.municipalityGeographyValidation;

        const rejectionReasons =
            geography.reasons;

        if (
            isStringArray(
                rejectionReasons
            )
        ) {
            return [
                ...rejectionReasons
            ];
        }
    }

    // -------------------------------------------------------------------------
    // Classification rejection
    // -------------------------------------------------------------------------

    if (
        hasClassificationRejectionReasons(
            candidate
        )
    ) {
        const rejectionReasons =
            candidate
                .classification
                .rejectionReasons;

        if (
            isStringArray(
                rejectionReasons
            )
        ) {
            return [
                ...rejectionReasons
            ];
        }
    }

    // -------------------------------------------------------------------------
    // Fallback diagnostics
    // -------------------------------------------------------------------------

    const inspection =
        candidate.inspection;

    const classification =
        candidate.classification;

    if (
        !isClassificationShape(
            classification
        )
    ) {
        return [
            "malformed classification shape"
        ];
    }

    const reasons: string[] = [];

    const geometryType =
        inspection.geometryType;

    const isPolygon =
        geometryType ===
            "esriGeometryPolygon" ||
        geometryType ===
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

    const districtFields =
        Array.isArray(
            inspection.districtFields
        )
            ? inspection.districtFields.filter(
                isString
            )
            : [];

    const hasDistrictField =
        districtFields.length > 0;

    const politicalDistrictField =
        districtFields.some(
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

    const thematicMatches =
        isStringArray(
            classification.matches.thematic
        )
            ? classification.matches.thematic
            : [];

    if (
        thematicMatches.length > 0
    ) {
        reasons.push(
            `thematic evidence: ${
                thematicMatches.join(", ")
            }`
        );
    }

    if (
        reasons.length === 0
    ) {
        reasons.push(
            "candidate rejected without an explicit rejection reason"
        );
    }

    return reasons;
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

            const {
                results,
                timings
            } =
                await discoverArcGISWithTiming(
                    options
                );

            printDiscoverySummary(
                results
            );

            printDiscoveryTiming(
                timings
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
        // Generate
        // ---------------------------------------------------------------------

        case "generate": {

            await generateRegistryGeometry(
                options
            );

            break;
        }

        // ---------------------------------------------------------------------
        // Build
        // ---------------------------------------------------------------------

        case "build": {

            await generateRegistryGeometry(
                options
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

            if (
                options.registry !== undefined
            ) {
                await validateRegistryFile(
                    options.registry
                );
            } else {
                await validateRegistry();
            }

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

    const outputRoot =
        path.join(
            process.cwd(),
            "data"
        );

    let successful =
        0;

    let failed =
        0;

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
                "    ✗ Geometry generation failed"
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

            if (
                result.error
            ) {

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

    printValidCandidates(
        results
    );

    printRejectionReport(
        results
    );
}

// =============================================================================
// Discovery timing
// =============================================================================

function printDiscoveryTiming(
    timings: DiscoveryTiming[]
): void {

    const totals =
        new Map<
            string,
            {
                runtimeMs: number;
                count: number;
            }
        >();

    for (
        const timing of timings
    ) {

        for (
            const stage of timing.stages
        ) {

            const existing =
                totals.get(
                    stage.name
                );

            if (
                existing
            ) {

                existing.runtimeMs +=
                    stage.runtimeMs;

                existing.count +=
                    stage.count;

            } else {

                totals.set(
                    stage.name,
                    {
                        runtimeMs:
                            stage.runtimeMs,
                        count:
                            stage.count
                    }
                );
            }
        }
    }

    const stages =
        [...totals.entries()]
            .sort(
                (
                    [, a],
                    [, b]
                ) =>
                    b.runtimeMs -
                    a.runtimeMs
            );

    console.log(
        "\nDiscovery timing:"
    );

    if (
        stages.length === 0
    ) {

        console.log(
            "  No timing data recorded."
        );

        return;
    }

    for (
        const [name, timing] of stages
    ) {

        const average =
            timing.count > 0
                ? timing.runtimeMs /
                  timing.count
                : 0;

        console.log(
            `  ${name}: ` +
            `${timing.runtimeMs.toFixed(0)} ms ` +
            `(${timing.count} calls, ` +
            `${average.toFixed(0)} ms avg)`
        );
    }
}

// =============================================================================
// Valid candidates
// =============================================================================

function printValidCandidates(
    results: DiscoveryResult[]
): void {

    const validResults =
        results.filter(
            result =>
                result.validCandidates.length > 0
        );

    if (
        validResults.length === 0
    ) {
        return;
    }

    console.log(
        "\nValid candidates:"
    );

    for (
        const result of validResults
    ) {

        console.log(
            `\n  ${result.place.city}, ${result.place.state}`
        );

        for (
            const valid of
            result.validCandidates
        ) {

            const inspection =
                valid.inspection;

            const classification =
                valid.classification;

            const validation =
                valid.validation;

            console.log(
                `\n    ✓ ${
                    inspection.title ??
                    inspection.layerName ??
                    inspection.serviceName ??
                    "(untitled)"
                }`
            );

            console.log(
                `      ${inspection.url}`
            );

            console.log(
                `      Geometry: ${
                    inspection.geometryType ??
                    "(unknown)"
                }`
            );

            console.log(
                `      District type: ${
                    classification.districtType ??
                    "(unknown)"
                }`
            );

            console.log(
                `      District field: ${
                    validation?.districtField ??
                    inspection.districtField ??
                    "(unknown)"
                }`
            );

            console.log(
                `      Validation confidence: ${
                    validation?.confidence ??
                    "(unknown)"
                }`
            );

            console.log(
                `      Distinct district values: ${
                    validation?.distinctDistrictValues.length ??
                    0
                }`
            );

            if (
                validation &&
                validation.distinctDistrictValues.length > 0
            ) {

                console.log(
                    `      District values: ${
                        validation.distinctDistrictValues.join(
                            ", "
                        )
                    }`
                );
            }

            const politicalMatches =
                isStringArray(
                    classification.matches.political
                )
                    ? classification.matches.political
                    : [];

            console.log(
                `      Political matches: ${
                    politicalMatches.length > 0
                        ? politicalMatches.join(", ")
                        : "(none)"
                }`
            );

            const thematicMatches =
                isStringArray(
                    classification.matches.thematic
                )
                    ? classification.matches.thematic
                    : [];

            console.log(
                `      Thematic matches: ${
                    thematicMatches.length > 0
                        ? thematicMatches.join(", ")
                        : "(none)"
                }`
            );

            console.log(
                `      Official municipal source: ${
                    classification.officialMunicipalSource
                }`
            );

            if (
                valid.municipalityValidation
            ) {

                console.log(
                    `      Municipality validation: ${
                        valid.municipalityValidation.score
                    }`
                );
            }

            if (
                valid.municipalityGeographyValidation
            ) {

                console.log(
                    `      Geography validation: ${
                        valid.municipalityGeographyValidation.status
                    }`
                );
            }
        }
    }
}

// =============================================================================
// Rejection report
// =============================================================================

function printRejectionReport(
    results: DiscoveryResult[]
): void {

    let totalRejected =
        0;

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

            /*
             * A malformed runtime candidate must never
             * crash the rejection report.
             */
            if (
                !isCandidateShape(
                    rejected
                )
            ) {

                console.log(
                    "\n    ✗ [malformed candidate]"
                );

                console.log(
                    "      URL: [unavailable]"
                );

                console.log(
                    "      Reasons: malformed candidate shape"
                );

                continue;
            }

            const title =
                getCandidateTitle(
                    rejected
                );

            const url =
                getCandidateUrl(
                    rejected
                );

            const reasons =
                getRejectionReasons(
                    rejected
                );

            console.log(
                `\n    ✗ ${title}`
            );

            console.log(
                `      ${url}`
            );

            console.log(
                `      Reasons: ${reasons.join("; ")}`
            );

            const classification =
                rejected.classification;

            /*
             * isCandidateShape() already validates this, but
             * retain the explicit guard here so this reporting
             * function never relies on an unsafe nested shape.
             */
            if (
                !isClassificationShape(
                    classification
                )
            ) {
                continue;
            }

            const politicalMatches =
                isStringArray(
                    classification.matches.political
                )
                    ? classification.matches.political
                    : [];

            if (
                politicalMatches.length > 0
            ) {

                console.log(
                    `      Political matches: ${
                        politicalMatches.join(", ")
                    }`
                );
            }

            const thematicMatches =
                isStringArray(
                    classification.matches.thematic
                )
                    ? classification.matches.thematic
                    : [];

            if (
                thematicMatches.length > 0
            ) {

                console.log(
                    `      Thematic matches: ${
                        thematicMatches.join(", ")
                    }`
                );
            }

            const districtFields =
                Array.isArray(
                    rejected
                        .inspection
                        .districtFields
                )
                    ? rejected
                        .inspection
                        .districtFields
                        .filter(
                            isString
                        )
                    : [];

            if (
                districtFields.length > 0
            ) {

                console.log(
                    `      District fields: ${
                        districtFields.join(", ")
                    }`
                );
            }

            const nameFields =
                Array.isArray(
                    rejected
                        .inspection
                        .nameFields
                )
                    ? rejected
                        .inspection
                        .nameFields
                        .filter(
                            isString
                        )
                    : [];

            if (
                nameFields.length > 0
            ) {

                console.log(
                    `      Name fields: ${
                        nameFields.join(", ")
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

            case "--registry": {

                const value =
                    args[++i];

                if (!value) {
                    throw new Error(
                        "--registry requires a value."
                    );
                }

                options.registry =
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

  npm run generate

  npm run generate -- --city Tucson --state AZ

  npm run generate -- --state AZ

  npm run generate -- --placeFips 0477000

  npm run geometry

  npm run geometry -- --city Tucson --state AZ

  npm run validate

  npm run validate -- --registry data/municipalities/registry.json


Commands:

  places
      Download the Census National Places Gazetteer
      and generate census-places.json.

  discover
      Search ArcGIS, inspect discovered layers,
      classify candidates, detect equivalent layers,
      select canonical municipal district sources,
      and write registry.json.

  generate
      Generate normalized GeoJSON geometry for
      the entries currently stored in registry.json.

  build
      Compatibility alias for generate.

  geometry
      Compatibility alias for generate.

  validate
      Validate the generated municipal registry.
      By default, validate data/municipalities/registry.json.
      Use --registry <path> to validate a specific
      registry file.


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


Validate options:

  --registry <path>
      Validate the specified registry file.

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
