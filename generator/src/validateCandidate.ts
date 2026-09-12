import type {
    ArcGISInspection,
    ArcGISCandidateValidation,
    CandidateClassification,
    DiscoveryCandidate,
    LayerSemanticEvidence
} from "./types.js";

// =============================================================================
// Constants
// =============================================================================

const MIN_DISTINCT_VALUES = 2;
const MAX_DISTINCT_VALUES = 100;
const MIN_COVERAGE = 0.50;

// =============================================================================
// Helpers
// =============================================================================

function normalizeField(
    value: string | undefined
): string {
    return (value ?? "")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/([a-zA-Z])(\d+)/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .toLowerCase()
        .trim();
}

function unique(
    values: string[]
): string[] {
    return [
        ...new Set(
            values.filter(Boolean)
        )
    ];
}

function isPoliticalFieldName(
    value?: string
): boolean {
    const normalized =
        normalizeField(value);

    if (!normalized) {
        return false;
    }

    return (
        /\bwards?\b/i.test(normalized) ||
        /\bcouncil\b/i.test(normalized) ||
        /\balderman/i.test(normalized) ||
        /\bmunicipal\s+district\b/i.test(normalized) ||
        /\bpolitical\s+district\b/i.test(normalized) ||
        /\belection\s+district\b/i.test(normalized) ||
        /\belectoral\s+district\b/i.test(normalized) ||
        /\bvoting\s+district\b/i.test(normalized) ||
        /\bvoting\s+precinct\b/i.test(normalized)
    );
}

function isGenericDistrictField(
    value?: string
): boolean {
    const normalized =
        normalizeField(value);

    return (
        /\bdistrict\b/i.test(normalized) &&
        !isPoliticalFieldName(normalized)
    );
}

function isWardField(
    value?: string
): boolean {
    return /\bward\b/i.test(
        normalizeField(value)
    );
}

// =============================================================================
// Semantic identity
// =============================================================================

const BOUNDARY_IDENTITY_PATTERNS = [
    /\bward\s+boundar(?:y|ies)\b/i,
    /\bward\s+maps?\b/i,
    /\bwards?\b/i,
    /\bcouncil\s+districts?\b/i,
    /\bcouncil\s+boundar(?:y|ies)\b/i,
    /\bcouncil\s+maps?\b/i,
    /\baldermanic\s+districts?\b/i,
    /\bmunicipal\s+districts?\b/i,
    /\bpolitical\s+districts?\b/i
];

const THEMATIC_IDENTITY_PATTERNS = [
    /\bevictions?\b/i,
    /\bcrimes?\b/i,
    /\bincidents?\b/i,
    /\bcomplaints?\b/i,
    /\binspections?\b/i,
    /\bpermits?\b/i,
    /\bfilings?\b/i,
    /\bproperties?\b/i,
    /\bhousing\b/i,
    /\bbusiness(?:es)?\b/i,
    /\blicenses?\b/i,
    /\bassessments?\b/i,
    /\btaxes\b/i,
    /\bsales\b/i,
    /\bemployment\b/i,
    /\bpopulation\b/i,
    /\bdemographics?\b/i
];

const BOUNDARY_METADATA_PATTERNS = [
    /\bward\s+boundar(?:y|ies)\b/i,
    /\bward\s+maps?\b/i,
    /\bcouncil\s+district\s+boundar(?:y|ies)\b/i,
    /\bcouncil\s+district\s+maps?\b/i,
    /\baldermanic\s+district\s+boundar(?:y|ies)\b/i,
    /\bmunicipal\s+district\s+boundar(?:y|ies)\b/i,
    /\bpolitical\s+district\s+boundar(?:y|ies)\b/i
];

const THEMATIC_METADATA_PATTERNS = [
    /\bevictions?\b/i,
    /\bcrimes?\b/i,
    /\bincidents?\b/i,
    /\bcomplaints?\b/i,
    /\binspections?\b/i,
    /\bpermits?\b/i,
    /\bfilings?\b/i,
    /\bproperties?\b/i,
    /\bhousing\b/i,
    /\bbusiness(?:es)?\b/i,
    /\blicenses?\b/i,
    /\bassessments?\b/i,
    /\btaxes\b/i,
    /\bsales\b/i,
    /\bemployment\b/i,
    /\bpopulation\b/i,
    /\bdemographics?\b/i
];

const THEMATIC_GROUPING_PATTERNS = [
    /\bby\s+(?:ward|wards)\b/i,
    /\bby\s+(?:council\s+)?districts?\b/i,
    /\bby\s+(?:council\s+)?district\b/i,
    /\bby\s+(?:political\s+)?districts?\b/i,
    /\bgrouped\s+by\b/i,
    /\baggregated\s+by\b/i,
    /\bsummarized\s+by\b/i,
    /\bsummarised\s+by\b/i
];

export function scoreLayerSemantics(
    candidate: DiscoveryCandidate,
    inspection: ArcGISInspection
): LayerSemanticEvidence {
    const identityText = [
        candidate.title,
        inspection.title,
        inspection.serviceName,
        inspection.layerName
    ]
        .filter(Boolean)
        .map(normalizeField)
        .join(" ");

    const metadataText = [
        inspection.description,
        inspection.serviceDescription
    ]
        .filter(Boolean)
        .map(normalizeField)
        .join(" ");

    let boundaryScore = 0;
    let thematicScore = 0;

    const evidence: string[] = [];

    // -------------------------------------------------------------------------
    // Boundary identity
    // -------------------------------------------------------------------------

    for (
        const pattern of BOUNDARY_IDENTITY_PATTERNS
    ) {
        if (pattern.test(identityText)) {
            boundaryScore += 20;

            evidence.push(
                `Boundary identity pattern matched: "${pattern.source}".`
            );
        }
    }

    // -------------------------------------------------------------------------
    // Thematic identity
    // -------------------------------------------------------------------------

    for (
        const pattern of THEMATIC_IDENTITY_PATTERNS
    ) {
        if (pattern.test(identityText)) {
            thematicScore += 20;

            evidence.push(
                `Thematic identity pattern matched: "${pattern.source}".`
            );
        }
    }

    // -------------------------------------------------------------------------
    // Boundary metadata
    // -------------------------------------------------------------------------

    for (
        const pattern of BOUNDARY_METADATA_PATTERNS
    ) {
        if (pattern.test(metadataText)) {
            boundaryScore += 2;

            evidence.push(
                `Boundary metadata pattern matched: "${pattern.source}".`
            );
        }
    }

    // -------------------------------------------------------------------------
    // Thematic metadata
    // -------------------------------------------------------------------------

    for (
        const pattern of THEMATIC_METADATA_PATTERNS
    ) {
        if (pattern.test(metadataText)) {
            thematicScore += 2;

            evidence.push(
                `Thematic metadata pattern matched: "${pattern.source}".`
            );
        }
    }

    // -------------------------------------------------------------------------
    // Thematic grouping
    // -------------------------------------------------------------------------

    /*
     * A phrase such as:
     *
     *     "Eviction Filings by Council Districts"
     *
     * should be treated as a thematic dataset organized by political
     * district rather than as a political boundary dataset.
     *
     * Grouping evidence is only meaningful when thematic identity
     * evidence already exists.
     */
    if (thematicScore > 0) {
        for (
            const pattern of THEMATIC_GROUPING_PATTERNS
        ) {
            if (pattern.test(identityText)) {
                thematicScore += 15;

                evidence.push(
                    `Thematic grouping pattern matched: "${pattern.source}".`
                );
            }
        }
    }

    return {
        boundaryScore,
        thematicScore,
        evidence
    };
}

// =============================================================================
// Field analysis
// =============================================================================

interface FieldAnalysis {
    field: string;
    distinctValues: string[];
    coverage: number;
    pattern:
        | "numeric"
        | "ward-number"
        | "district-number"
        | "named"
        | "unknown";
}

function classifyValuePattern(
    values: string[]
): FieldAnalysis["pattern"] {
    if (values.length === 0) {
        return "unknown";
    }

    const normalized =
        values.map(
            value =>
                normalizeField(value)
        );

    const wardNumberPattern =
        normalized.every(
            value =>
                /^ward\s+\d+[a-z]?$/i.test(
                    value
                )
        );

    if (wardNumberPattern) {
        return "ward-number";
    }

    const districtNumberPattern =
        normalized.every(
            value =>
                /^(?:district|council\s+district)\s+\d+[a-z]?$/i.test(
                    value
                )
        );

    if (districtNumberPattern) {
        return "district-number";
    }

    const numericPattern =
        normalized.every(
            value =>
                /^\d+[a-z]?$/i.test(
                    value
                )
        );

    if (numericPattern) {
        return "numeric";
    }

    /*
     * A named political district is still legitimate.
     *
     * Examples:
     *
     *     Central
     *     North
     *     Downtown
     *     Ward A
     */
    const namedPattern =
        normalized.every(
            value =>
                value.length > 0 &&
                !/^\d+$/.test(value)
        );

    if (namedPattern) {
        return "named";
    }

    return "unknown";
}

function analyzeDistrictField(
    inspection: ArcGISInspection
): FieldAnalysis {
    const fields =
        inspection.fields ?? [];

    const candidateFields =
        unique([
            ...(inspection.districtFields ?? []),
            ...fields
                .filter(
                    field =>
                        isPoliticalFieldName(
                            field.name
                        ) ||
                        isPoliticalFieldName(
                            field.alias
                        ) ||
                        isGenericDistrictField(
                            field.name
                        ) ||
                        isGenericDistrictField(
                            field.alias
                        )
                )
                .map(
                    field =>
                        field.name
                )
        ]);

    if (
        candidateFields.length === 0
    ) {
        return {
            field: "",
            distinctValues: [],
            coverage: 0,
            pattern: "unknown"
        };
    }

    /*
     * The inspection interface normally provides district field
     * information. This function uses the first strongest candidate
     * field supplied by inspection.
     */
    const field =
        candidateFields[0];

    const inspectionDistrictFields =
        inspection.districtFields ?? [];

    /*
     * ArcGISInspection does not necessarily contain sampled field
     * values directly. The caller may provide them through the
     * district field metadata.
     *
     * For the current architecture, use the known district values
     * supplied by inspection when available.
     */
    const fieldMetadata =
        fields.find(
            candidate =>
                normalizeField(
                    candidate.name
                ) ===
                normalizeField(field)
        );

    const values =
        (
            fieldMetadata as
            {
                values?: string[];
                sampleValues?: string[];
            } | undefined
        )?.values ??
        (
            fieldMetadata as
            {
                values?: string[];
                sampleValues?: string[];
            } | undefined
        )?.sampleValues ??
        [];

    const distinctValues =
        unique(
            values.map(
                value =>
                    String(value).trim()
            )
        );

    /*
     * If the inspection layer already exposes distinct district values,
     * prefer those.
     */
    const inspectionValues =
        (
            inspection as
            ArcGISInspection & {
                distinctDistrictValues?: string[];
            }
        ).distinctDistrictValues;

    const finalValues =
        inspectionValues &&
        inspectionValues.length > 0
            ? unique(
                inspectionValues.map(
                    value =>
                        String(value).trim()
                )
            )
            : distinctValues;

    const featureCount =
        (
            inspection as
            ArcGISInspection & {
                featureCount?: number;
            }
        ).featureCount;

    const sampledCount =
        finalValues.length;

    const coverage =
        featureCount &&
        featureCount > 0
            ? Math.min(
                1,
                sampledCount /
                featureCount
            )
            : sampledCount > 0
                ? 1
                : 0;

    return {
        field,
        distinctValues:
            finalValues,
        coverage,
        pattern:
            classifyValuePattern(
                finalValues
            )
    };
}

// =============================================================================
// Confidence
// =============================================================================

function calculateConfidence(
    inspection: ArcGISInspection,
    classification: CandidateClassification,
    best: FieldAnalysis,
    semanticEvidence: LayerSemanticEvidence
): number {
    let confidence = 0;

    const geometryType =
        normalizeField(
            inspection.geometryType
        );

    const isPolygon =
        geometryType === "esri geometry polygon" ||
        geometryType === "polygon";

    if (isPolygon) {
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
        confidence += 15;
    }

    if (
        isPoliticalFieldName(
            best.field
        )
    ) {
        confidence += 15;
    }

    if (
        best.pattern ===
            "ward-number" ||
        best.pattern ===
            "district-number"
    ) {
        confidence += 15;
    } else if (
        best.pattern ===
            "numeric" ||
        best.pattern ===
            "named"
    ) {
        confidence += 10;
    }

    if (
        best.coverage >=
        MIN_COVERAGE
    ) {
        confidence += 5;
    }

    /*
     * Semantic evidence is an important supporting signal.
     *
     * Boundary-native identity receives a modest boost.
     * Thematic identity receives a stronger penalty because a dataset
     * such as "Eviction Filings by Council Districts" can otherwise
     * look structurally similar to a true district boundary layer.
     */
    if (
        semanticEvidence.boundaryScore >
        semanticEvidence.thematicScore
    ) {
        confidence += 10;
    } else if (
        semanticEvidence.thematicScore >
        semanticEvidence.boundaryScore
    ) {
        confidence -= 15;
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
// Acceptance
// =============================================================================

function determineAcceptance(
    inspection: ArcGISInspection,
    classification: CandidateClassification,
    best: FieldAnalysis,
    confidence: number,
    semanticEvidence: LayerSemanticEvidence
): boolean {
    const geometryType =
        normalizeField(
            inspection.geometryType
        );

    const isPolygon =
        geometryType ===
            "esri geometry polygon" ||
        geometryType ===
            "polygon";

    /*
     * =========================================================================
     * Semantic rejection
     * =========================================================================
     *
     * This must happen before the structural field checks.
     *
     * A thematic dataset can contain:
     *
     *     DISTRICT
     *     WARD
     *     COUNCIL_DISTRICT
     *
     * and even contain polygon geometry.
     *
     * Therefore field evidence alone must not allow something like:
     *
     *     "Eviction Filings by Council Districts"
     *
     * through validation.
     */
    if (
        semanticEvidence.thematicScore >
        semanticEvidence.boundaryScore
    ) {
        return false;
    }

    // -------------------------------------------------------------------------
    // Basic distinct-value guard
    // -------------------------------------------------------------------------

    if (
        best.distinctValues.length <
        MIN_DISTINCT_VALUES
    ) {
        return (
            classification.isPoliticalBoundary &&
            classification.officialMunicipalSource &&
            best.coverage >=
                MIN_COVERAGE
        );
    }

    if (
        best.distinctValues.length >
        MAX_DISTINCT_VALUES
    ) {
        return false;
    }

    if (!isPolygon) {
        return false;
    }

    const explicitPoliticalField =
        isPoliticalFieldName(
            best.field
        );

    const wardField =
        isWardField(
            best.field
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
        best.coverage >=
        MIN_COVERAGE;

    // -------------------------------------------------------------------------
    // Strong political field
    // -------------------------------------------------------------------------

    if (
        explicitPoliticalField &&
        recognizablePattern &&
        populated &&
        confidence >= 55
    ) {
        return true;
    }

    // -------------------------------------------------------------------------
    // Ward field
    // -------------------------------------------------------------------------

    if (
        wardField &&
        best.distinctValues.length >=
            MIN_DISTINCT_VALUES &&
        populated &&
        confidence >= 50
    ) {
        return true;
    }

    // -------------------------------------------------------------------------
    // Explicit political identity
    // -------------------------------------------------------------------------

    if (
        classification.isPoliticalBoundary &&
        recognizablePattern &&
        populated &&
        confidence >= 55
    ) {
        return true;
    }

    // -------------------------------------------------------------------------
    // Generic district field
    // -------------------------------------------------------------------------

    if (
        genericDistrictField &&
        classification.isPoliticalBoundary &&
        best.distinctValues.length >=
            MIN_DISTINCT_VALUES &&
        populated &&
        confidence >= 65
    ) {
        return true;
    }

    // -------------------------------------------------------------------------
    // Official municipal source
    // -------------------------------------------------------------------------

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
// Main validation function
// =============================================================================

export function validateCandidate(
    candidate: DiscoveryCandidate,
    inspection: ArcGISInspection,
    classification: CandidateClassification
): ArcGISCandidateValidation {
    // =========================================================================
    // Semantic analysis
    // =========================================================================

    const semanticEvidence =
        scoreLayerSemantics(
            candidate,
            inspection
        );

    console.log(
        "SEMANTIC DEBUG:",
        {
            title:
                inspection.title,
            serviceName:
                inspection.serviceName,
            layerName:
                inspection.layerName,
            boundaryScore:
                semanticEvidence.boundaryScore,
            thematicScore:
                semanticEvidence.thematicScore,
            evidence:
                semanticEvidence.evidence
        }
    );

    // =========================================================================
    // District field analysis
    // =========================================================================

    const best =
        analyzeDistrictField(
            inspection
        );

    // =========================================================================
    // Confidence
    // =========================================================================

    const confidence =
        calculateConfidence(
            inspection,
            classification,
            best,
            semanticEvidence
        );

    // =========================================================================
    // Acceptance
    // =========================================================================

    const accepted =
        determineAcceptance(
            inspection,
            classification,
            best,
            confidence,
            semanticEvidence
        );

    console.log(
        "ACCEPTANCE DEBUG:",
        {
            title:
                inspection.title,
            boundaryScore:
                semanticEvidence.boundaryScore,
            thematicScore:
                semanticEvidence.thematicScore,
            confidence,
            classificationPolitical:
                classification.isPoliticalBoundary,
            accepted
        }
    );

    // =========================================================================
    // Rejection reasons
    // =========================================================================

    const rejectionReasons:
        string[] = [];

    if (!accepted) {
        if (
            semanticEvidence.thematicScore >
            semanticEvidence.boundaryScore
        ) {
            rejectionReasons.push(
                "thematic dataset grouped by political district"
            );
        }

        if (
            best.distinctValues.length >
            MAX_DISTINCT_VALUES
        ) {
            rejectionReasons.push(
                "too many distinct district values"
            );
        }

        if (
            best.distinctValues.length <
            MIN_DISTINCT_VALUES
        ) {
            rejectionReasons.push(
                "insufficient distinct district values"
            );
        }

        if (
            best.coverage <
            MIN_COVERAGE
        ) {
            rejectionReasons.push(
                "insufficient district-field coverage"
            );
        }

        if (!classification.isPoliticalBoundary) {
            rejectionReasons.push(
                "classifier did not identify a political boundary"
            );
        }

        const geometryType =
            normalizeField(
                inspection.geometryType
            );

        const isPolygon =
            geometryType ===
                "esri geometry polygon" ||
            geometryType ===
                "polygon";

        if (!isPolygon) {
            rejectionReasons.push(
                "not polygon geometry"
            );
        }

        if (
            rejectionReasons.length ===
            0
        ) {
            rejectionReasons.push(
                "failed political-boundary validation"
            );
        }
    }

    // =========================================================================
    // Evidence
    // =========================================================================

    const evidence =
        [
            ...semanticEvidence.evidence
        ];

    if (best.field) {
        evidence.push(
            `District field: ${best.field}.`
        );
    }

    if (
        best.distinctValues.length > 0
    ) {
        evidence.push(
            `Distinct district values: ${best.distinctValues.length}.`
        );
    }

    if (best.coverage > 0) {
        evidence.push(
            `District-field coverage: ${(best.coverage * 100).toFixed(1)}%.`
        );
    }

    evidence.push(
        `District value pattern: ${best.pattern}.`
    );

    evidence.push(
        `Validation confidence: ${confidence}.`
    );

    // =========================================================================
    // Expected district count
    // =========================================================================

    const expectedDistrictCount =
        (
            inspection as
            ArcGISInspection & {
                expectedDistrictCount?: number;
            }
        ).expectedDistrictCount;

    const distinctDistrictValues =
        best.distinctValues;

    const completeDistrictCoverage =
        expectedDistrictCount !== undefined
            ? distinctDistrictValues.length >=
                expectedDistrictCount
            : undefined;

    const missingDistrictValues:
        string[] = [];

    // =========================================================================
    // Return
    // =========================================================================

    return {
        isLikelyPoliticalBoundary:
            accepted,

        confidence,

        districtField:
            best.field ||
            undefined,

        sampleCount:
            best.distinctValues.length,

        featureCount:
            (
                inspection as
                ArcGISInspection & {
                    featureCount?: number;
                }
            ).featureCount,

        distinctDistrictValues,

        districtValuePattern:
            best.pattern,

        geometryType:
            inspection.geometryType,

        municipalityOverlap:
            undefined,

        evidence,

        expectedDistrictCount,

        completeDistrictCoverage,

        missingDistrictValues,

        rejectionReasons
    };
}