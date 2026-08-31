import type {
    ArcGISInspection,
    ArcGISCandidateValidation,
    CandidateClassification,
    DiscoveryCandidate
} from "./types.js";

import {
    queryArcGISLayer
} from "./queryArcGISLayer.js";

// =============================================================================
// Constants
// =============================================================================

const SAMPLE_SIZE = 250;

const MIN_DISTINCT_VALUES = 2;

const MAX_DISTINCT_VALUES = 100;

// =============================================================================
// Public API
// =============================================================================

export async function validateCandidate(
    candidate: DiscoveryCandidate,
    inspection: ArcGISInspection,
    classification: CandidateClassification
): Promise<ArcGISCandidateValidation> {

    const isPolygon =
        inspection.geometryType ===
            "esriGeometryPolygon" ||
        inspection.geometryType ===
            "polygon";

    if (!isPolygon) {
        return {
            isLikelyPoliticalBoundary: false,
            confidence: 0,
            districtField:
                inspection.districtField,
            sampleCount: 0,
            distinctDistrictValues: [],
            districtValuePattern: "unknown",
            geometryType:
                inspection.geometryType,
            evidence: [
                "Layer is not polygon geometry."
            ]
        };
    }

    const candidateFields =
        getCandidateFields(
            inspection,
            classification
        );

    if (
        candidateFields.length === 0
    ) {
        return {
            isLikelyPoliticalBoundary:
                classification.isPoliticalBoundary,

            confidence:
                classification.isPoliticalBoundary
                    ? 55
                    : 0,

            districtField:
                inspection.districtField,

            sampleCount: 0,

            distinctDistrictValues: [],

            districtValuePattern:
                "unknown",

            geometryType:
                inspection.geometryType,

            evidence: [
                "No candidate district field could be identified.",
                classification.isPoliticalBoundary
                    ? "Classification identified political-boundary evidence; validation could not inspect attributes."
                    : "No political-boundary evidence was available."
            ]
        };
    }

    let query;

    try {
        query =
            await queryArcGISLayer(
                inspection.url,
                {
                    resultRecordCount:
                        SAMPLE_SIZE,

                    resultOffset:
                        0,

                    returnGeometry:
                        false,

                    outFields:
                        candidateFields
                }
            );
    } catch (error) {
        return {
            isLikelyPoliticalBoundary:
                classification.isPoliticalBoundary,

            confidence:
                classification.isPoliticalBoundary
                    ? 60
                    : 0,

            districtField:
                inspection.districtField ??
                candidateFields[0],

            sampleCount: 0,

            distinctDistrictValues: [],

            districtValuePattern:
                "unknown",

            geometryType:
                inspection.geometryType,

            evidence: [
                "ArcGIS attribute validation failed.",
                error instanceof Error
                    ? error.message
                    : String(error)
            ]
        };
    }

    if (
        !query.success
    ) {
        return {
            isLikelyPoliticalBoundary:
                classification.isPoliticalBoundary,

            confidence:
                classification.isPoliticalBoundary
                    ? 60
                    : 0,

            districtField:
                inspection.districtField ??
                candidateFields[0],

            sampleCount:
                query.featureCount,

            distinctDistrictValues: [],

            districtValuePattern:
                "unknown",

            geometryType:
                inspection.geometryType,

            evidence: [
                "Unable to query ArcGIS layer.",
                query.error ??
                    "Unknown ArcGIS query error."
            ]
        };
    }

    const analyses =
        candidateFields.map(
            field =>
                analyzeField(
                    query.features,
                    field
                )
        );

    const best =
        selectBestField(
            analyses
        );

    if (!best) {
        return {
            isLikelyPoliticalBoundary:
                classification.isPoliticalBoundary,

            confidence:
                classification.isPoliticalBoundary
                    ? 55
                    : 0,

            districtField:
                inspection.districtField,

            sampleCount:
                query.featureCount,

            distinctDistrictValues: [],

            districtValuePattern:
                "unknown",

            geometryType:
                inspection.geometryType,

            evidence: [
                "No candidate field contained usable values."
            ]
        };
    }

    const confidence =
        calculateConfidence(
            inspection,
            classification,
            best
        );

    const accepted =
        determineAcceptance(
            inspection,
            classification,
            best,
            confidence
        );

    const evidence: string[] = [];

    evidence.push(
        `Queried ${query.featureCount} feature${
            query.featureCount === 1
                ? ""
                : "s"
        }.`
    );

    evidence.push(
        `Best candidate field: "${best.field}".`
    );

    evidence.push(
        `Found ${best.distinctValues.length} distinct value${
            best.distinctValues.length === 1
                ? ""
                : "s"
        }.`
    );

    evidence.push(
        `Value pattern: ${best.pattern}.`
    );

    evidence.push(
        `Field coverage: ${formatPercent(best.coverage)}.`
    );

    evidence.push(
        `Validation confidence: ${confidence}.`
    );

    if (
        classification.officialMunicipalSource
    ) {
        evidence.push(
            "Source appears to be municipal or government GIS."
        );
    }

    if (
        classification.isPoliticalBoundary
    ) {
        evidence.push(
            "Classifier identified political-boundary evidence."
        );
    }

    if (
        accepted
    ) {
        evidence.push(
            "Candidate accepted by attribute validation."
        );
    }

    return {
        isLikelyPoliticalBoundary:
            accepted,

        confidence,

        districtField:
            best.field,

        sampleCount:
            query.featureCount,

        featureCount:
            query.featureCount,

        distinctDistrictValues:
            best.distinctValues,

        districtValuePattern:
            best.pattern,

        geometryType:
            inspection.geometryType,

        evidence
    };
}

// =============================================================================
// Candidate fields
// =============================================================================

function getCandidateFields(
    inspection: ArcGISInspection,
    classification: CandidateClassification
): string[] {

    const fields =
        inspection.fields ?? [];

    const result: string[] = [];

    function add(
        value?: string
    ): void {

        if (
            !value ||
            !value.trim()
        ) {
            return;
        }

        if (
            !result.some(
                existing =>
                    existing.toLowerCase() ===
                    value.toLowerCase()
            )
        ) {
            result.push(
                value
            );
        }
    }

    /*
     * Existing inspector-selected fields first.
     */
    add(
        inspection.districtField
    );

    for (
        const field of
        inspection.districtFields ?? []
    ) {
        add(field);
    }

    /*
     * Political-looking fields.
     */
    for (
        const field of fields
    ) {

        if (
            isPoliticalFieldName(
                field.name
            )
        ) {
            add(field.name);
        }

        if (
            isPoliticalFieldName(
                field.alias
            )
        ) {
            add(field.name);
        }
    }

    /*
     * Name fields can contain:
     *
     * Ward 1
     * Ward 2
     *
     * Council District 1
     *
     * etc.
     */
    for (
        const field of
        inspection.nameFields ?? []
    ) {
        add(field);
    }

    if (
        inspection.nameField
    ) {
        add(
            inspection.nameField
        );
    }

    /*
     * If classification strongly identifies a political layer,
     * also inspect string/integer fields that could contain district
     * identifiers.
     */
    if (
        classification.isPoliticalBoundary
    ) {

        for (
            const field of
            fields
        ) {

            const type =
                (
                    field.type ??
                    ""
                ).toLowerCase();

            const name =
                (
                    field.name ??
                    ""
                ).toLowerCase();

            if (
                type.includes("string") ||
                type.includes("integer") ||
                type.includes("smallinteger") ||
                type.includes("double")
            ) {

                if (
                    !isObjectIdField(
                        name
                    )
                ) {
                    add(
                        field.name
                    );
                }
            }
        }
    }

    return result;
}

// =============================================================================
// Field analysis
// =============================================================================

interface FieldAnalysis {

    field: string;

    values: string[];

    distinctValues: string[];

    pattern:
        | "numeric"
        | "ward-number"
        | "district-number"
        | "named"
        | "unknown";

    coverage: number;

    score: number;
}

function analyzeField(
    features: Array<{
        attributes: Record<string, unknown>;
        geometry?: unknown;
    }>,
    field: string
): FieldAnalysis {

    const values: string[] = [];

    for (
        const feature of features
    ) {

        const actualField =
            findActualField(
                feature.attributes,
                field
            );

        if (
            !actualField
        ) {
            continue;
        }

        const value =
            normalizeValue(
                feature.attributes[
                    actualField
                ]
            );

        if (
            value
        ) {
            values.push(
                value
            );
        }
    }

    const distinctValues =
        uniqueStrings(
            values
        );

    const pattern =
        detectDistrictValuePattern(
            distinctValues
        );

    const coverage =
        features.length === 0
            ? 0
            : values.length /
                features.length;

    const score =
        scoreField(
            field,
            distinctValues,
            pattern,
            coverage
        );

    return {
        field,
        values,
        distinctValues,
        pattern,
        coverage,
        score
    };
}

// =============================================================================
// Field scoring
// =============================================================================

function scoreField(
    field: string,
    distinctValues: string[],
    pattern:
        | "numeric"
        | "ward-number"
        | "district-number"
        | "named"
        | "unknown",
    coverage: number
): number {

    let score = 0;

    const normalized =
        field
            .toLowerCase()
            .replace(/[_-]+/g, " ")
            .trim();

    if (
        /\bward\b/.test(
            normalized
        )
    ) {
        score += 100;
    }

    if (
        /\bcouncil\b/.test(
            normalized
        )
    ) {
        score += 100;
    }

    if (
        /\balderman/.test(
            normalized
        )
    ) {
        score += 100;
    }

    if (
        /\bmunicipal\s+district\b/.test(
            normalized
        )
    ) {
        score += 90;
    }

    if (
        /\bpolitical\s+district\b/.test(
            normalized
        )
    ) {
        score += 90;
    }

    if (
        /\belection\s+district\b/.test(
            normalized
        )
    ) {
        score += 80;
    }

    if (
        /\bvoting\s+district\b/.test(
            normalized
        )
    ) {
        score += 80;
    }

    if (
        /\bdistrict\b/.test(
            normalized
        )
    ) {
        score += 30;
    }

    switch (
        pattern
    ) {

        case "ward-number":
            score += 50;
            break;

        case "district-number":
            score += 50;
            break;

        case "numeric":
            score += 20;
            break;

        case "named":
            score += 10;
            break;
    }

    if (
        distinctValues.length >= 2
    ) {
        score += 10;
    }

    if (
        distinctValues.length >= 3
    ) {
        score += 10;
    }

    if (
        distinctValues.length >= 5
    ) {
        score += 10;
    }

    if (
        coverage >= 0.95
    ) {
        score += 15;
    }
    else if (
        coverage >= 0.75
    ) {
        score += 10;
    }
    else if (
        coverage < 0.25
    ) {
        score -= 20;
    }

    return score;
}

// =============================================================================
// Select best field
// =============================================================================

function selectBestField(
    analyses: FieldAnalysis[]
): FieldAnalysis | undefined {

    return [
        ...analyses
    ]
        .filter(
            analysis =>
                analysis.distinctValues.length > 0
        )
        .sort(
            (a, b) =>
                b.score -
                a.score
        )[0];
}

// =============================================================================
// Acceptance
// =============================================================================

function determineAcceptance(
    inspection: ArcGISInspection,
    classification: CandidateClassification,
    best: FieldAnalysis,
    confidence: number
): boolean {

    const isPolygon =
        inspection.geometryType ===
            "esriGeometryPolygon" ||
        inspection.geometryType ===
            "polygon";

    if (
        !isPolygon
    ) {
        return false;
    }

    if (
        best.distinctValues.length <
        MIN_DISTINCT_VALUES
    ) {
        /*
         * A strongly identified municipal layer may still be useful
         * even when the sample contains only one value.
         *
         * However, it should remain lower confidence.
         */
        return (
            classification.isPoliticalBoundary &&
            classification.officialMunicipalSource &&
            best.coverage >= 0.50
        );
    }

    if (
        best.distinctValues.length >
        MAX_DISTINCT_VALUES
    ) {
        /*
         * A district layer normally has a small number of values.
         * More than 100 is overwhelmingly likely to be another
         * categorical field.
         */
        return false;
    }

    const explicitPoliticalField =
        isPoliticalFieldName(
            best.field
        );

    const wardField =
        /\bward\b/i.test(
            normalizeField(
                best.field
            )
        );

    const genericDistrictField =
        isGenericDistrictField(
            best.field
        );

    const recognizablePattern =
        best.pattern ===
            "ward-number" ||
        best.pattern ===
            "district-number" ||
        best.pattern ===
            "numeric" ||
        best.pattern ===
            "named";

    const populated =
        best.coverage >= 0.50;

    /*
     * Strongest case:
     *
     * WARD / COUNCIL field + multiple values.
     */
    if (
        explicitPoliticalField &&
        recognizablePattern &&
        populated &&
        confidence >= 55
    ) {
        return true;
    }

    /*
     * Tucson-style WARD field.
     */
    if (
        wardField &&
        best.distinctValues.length >= 2 &&
        populated &&
        confidence >= 50
    ) {
        return true;
    }

    /*
     * Explicit political classification plus a numeric/name field.
     */
    if (
        classification.isPoliticalBoundary &&
        recognizablePattern &&
        populated &&
        confidence >= 55
    ) {
        return true;
    }

    /*
     * Generic DISTRICT field requires stronger classification.
     */
    if (
        genericDistrictField &&
        classification.isPoliticalBoundary &&
        best.distinctValues.length >= 2 &&
        populated &&
        confidence >= 65
    ) {
        return true;
    }

    /*
     * Official municipal source is valuable supporting evidence.
     */
    if (
        classification.officialMunicipalSource &&
        classification.isPoliticalBoundary &&
        recognizablePattern &&
        populated &&
        confidence >= 50
    ) {
        return true;
    }

    return false;
}

// =============================================================================
// Confidence
// =============================================================================

function calculateConfidence(
    inspection: ArcGISInspection,
    classification: CandidateClassification,
    best: FieldAnalysis
): number {

    let confidence = 0;

    const isPolygon =
        inspection.geometryType ===
            "esriGeometryPolygon" ||
        inspection.geometryType ===
            "polygon";

    if (
        isPolygon
    ) {
        confidence += 25;
    }

    if (
        classification.isPoliticalBoundary
    ) {
        confidence += 25;
    }

    if (
        classification.officialMunicipalSource
    ) {
        confidence += 20;
    }

    if (
        isPoliticalFieldName(
            best.field
        )
    ) {
        confidence += 20;
    }

    if (
        /\bward\b/i.test(
            normalizeField(
                best.field
            )
        )
    ) {
        confidence += 10;
    }

    if (
        best.distinctValues.length >= 2
    ) {
        confidence += 10;
    }

    if (
        best.distinctValues.length >= 3
    ) {
        confidence += 5;
    }

    if (
        best.distinctValues.length >= 5
    ) {
        confidence += 5;
    }

    switch (
        best.pattern
    ) {

        case "ward-number":
            confidence += 15;
            break;

        case "district-number":
            confidence += 15;
            break;

        case "numeric":
            confidence += 8;
            break;

        case "named":
            confidence += 5;
            break;
    }

    if (
        best.coverage >= 0.95
    ) {
        confidence += 5;
    }
    else if (
        best.coverage >= 0.75
    ) {
        confidence += 3;
    }
    else if (
        best.coverage < 0.50
    ) {
        confidence -= 10;
    }

    return Math.max(
        0,
        Math.min(
            100,
            confidence
        )
    );
}

// =============================================================================
// Field helpers
// =============================================================================

function isPoliticalFieldName(
    value?: string
): boolean {

    const normalized =
        normalizeField(
            value
        );

    return (
        /\bward\b/.test(
            normalized
        ) ||
        /\bcouncil\b/.test(
            normalized
        ) ||
        /\balderman/.test(
            normalized
        ) ||
        /\bmunicipal\s+district\b/.test(
            normalized
        ) ||
        /\bpolitical\s+district\b/.test(
            normalized
        ) ||
        /\belection\s+district\b/.test(
            normalized
        ) ||
        /\belectoral\s+district\b/.test(
            normalized
        ) ||
        /\bvoting\s+district\b/.test(
            normalized
        ) ||
        /\bvoting\s+precinct\b/.test(
            normalized
        )
    );
}

function isGenericDistrictField(
    value?: string
): boolean {

    const normalized =
        normalizeField(
            value
        );

    return (
        /\bdistrict\b/.test(
            normalized
        ) &&
        !isPoliticalFieldName(
            normalized
        )
    );
}

function normalizeField(
    value?: string
): string {

    return (
        value ?? ""
    )
        .toLowerCase()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function isObjectIdField(
    value: string
): boolean {

    const normalized =
        value
            .toLowerCase()
            .replace(/[_-]+/g, "");

    return (
        normalized === "objectid" ||
        normalized === "fid" ||
        normalized === "shape" ||
        normalized === "shapearea" ||
        normalized === "shapelength" ||
        normalized === "globalid"
    );
}

function findActualField(
    attributes: Record<string, unknown>,
    requestedField: string
): string | undefined {

    return Object.keys(
        attributes
    ).find(
        field =>
            field.toLowerCase() ===
            requestedField.toLowerCase()
    );
}

function normalizeValue(
    value: unknown
): string | undefined {

    if (
        value === null ||
        value === undefined
    ) {
        return undefined;
    }

    const normalized =
        String(value)
            .trim()
            .replace(
                /\s+/g,
                " "
            );

    return normalized ||
        undefined;
}

function uniqueStrings(
    values: string[]
): string[] {

    const result: string[] = [];

    const seen =
        new Set<string>();

    for (
        const value of values
    ) {

        const normalized =
            value.trim();

        if (
            !normalized
        ) {
            continue;
        }

        const key =
            normalized.toLowerCase();

        if (
            seen.has(key)
        ) {
            continue;
        }

        seen.add(key);

        result.push(
            normalized
        );
    }

    return result;
}

// =============================================================================
// District value pattern
// =============================================================================

function detectDistrictValuePattern(
    values: string[]
):
    | "numeric"
    | "ward-number"
    | "district-number"
    | "named"
    | "unknown"
{

    if (
        values.length === 0
    ) {
        return "unknown";
    }

    const normalized =
        values.map(
            value =>
                value
                    .trim()
                    .toLowerCase()
        );

    if (
        normalized.every(
            value =>
                /^ward\s*[a-z0-9]+$/i.test(
                    value
                )
        )
    ) {
        return "ward-number";
    }

    if (
        normalized.every(
            value =>
                /^(?:(?:city|council)\s+)?district\s*[a-z0-9]+$/i.test(
                    value
                )
        )
    ) {
        return "district-number";
    }

    if (
        normalized.every(
            value =>
                /^\d+$/.test(
                    value
                )
        )
    ) {
        return "numeric";
    }

    /*
     * Named district values.
     *
     * Examples:
     *
     * North
     * South
     * Central
     * Downtown
     * Ward A
     */
    if (
        normalized.every(
            value =>
                /[a-z]/i.test(
                    value
                )
        )
    ) {
        return "named";
    }

    return "unknown";
}

// =============================================================================
// Formatting
// =============================================================================

function formatPercent(
    value: number
): string {

    return `${Math.round(
        value * 100
    )}%`;
}