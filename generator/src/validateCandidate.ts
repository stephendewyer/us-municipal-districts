import type {
    ArcGISInspection,
    ArcGISCandidateValidation,
    CandidateClassification,
    DiscoveryCandidate,
    LayerSemanticEvidence,
    ExpectedDistrictCount
} from "./types.js";

// =============================================================================
// Constants
// =============================================================================

const MIN_DISTINCT_VALUES = 2;

const MAX_DISTINCT_VALUES = 100;

const MAX_UNEXPECTED_DISTRICT_VALUES = 10;

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

// =============================================================================
// Political field detection
// =============================================================================

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
        /\bcouncil\s+district\b/i.test(normalized) ||
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
// District-field scoring
// =============================================================================

function scoreDistrictFieldName(
    value?: string
): number {
    const normalized =
        normalizeField(value);

    if (!normalized) {
        return 0;
    }

    /*
     * Exact district identifiers are strongest.
     */
    if (
        normalized === "district" ||
        normalized === "district id" ||
        normalized === "district number" ||
        normalized === "district no" ||
        normalized === "district num"
    ) {
        return 100;
    }

    if (
        normalized === "ward" ||
        normalized === "ward id" ||
        normalized === "ward number" ||
        normalized === "ward no" ||
        normalized === "ward num"
    ) {
        return 95;
    }

    if (
        normalized === "council district" ||
        normalized === "council district id" ||
        normalized === "council district number"
    ) {
        return 100;
    }

    if (
        normalized.includes("district")
    ) {
        return 75;
    }

    if (
        normalized.includes("ward")
    ) {
        return 75;
    }

    if (
        normalized.includes("council")
    ) {
        return 70;
    }

    if (
        normalized.includes("alderman")
    ) {
        return 70;
    }

    /*
     * Generic political fields.
     */
    if (
        isPoliticalFieldName(normalized)
    ) {
        return 60;
    }

    return 0;
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

    fieldScore: number;

    distinctValues: string[];

    observedDistrictCount: number;

    expectedDistrictCount?: number;

    expectedDistrictSource?:
        ExpectedDistrictCount["source"];

    expectedDistrictConfidence?: number;

    observedCoverage?: number;

    unexpectedDistrictValueCount: number;

    districtCountConsistent?: boolean;

    completeDistrictCoverage?: boolean;

    missingDistrictValues: string[];

    pattern:
        | "numeric"
        | "ward-number"
        | "district-number"
        | "named"
        | "mixed"
        | "unknown";
}

// =============================================================================
// Candidate district fields
// =============================================================================

function getCandidateDistrictFields(
    inspection: ArcGISInspection
): string[] {
    const fields =
        inspection.fields ?? [];

    /*
     * Start with fields explicitly identified by inspection.
     */
    const explicitFields =
        inspection.districtFields ?? [];

    /*
     * Then identify fields whose names/aliases actually look like
     * district identifiers.
     *
     * IMPORTANT:
     *
     * Do not consider every field in the layer.
     *
     * REP_NAME, REP_URL, EMAIL, etc. are attributes associated with
     * districts, but they are not district identifiers.
     */
    const semanticFields =
        fields
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
            );

    return unique([
        ...explicitFields,
        ...semanticFields
    ]);
}

// =============================================================================
// District-value pattern
// =============================================================================

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

    const namedPattern =
        normalized.every(
            value =>
                value.length > 0 &&
                !/^\d+[a-z]?$/i.test(
                    value
                )
        );

    if (namedPattern) {
        return "named";
    }

    return "mixed";
}

// =============================================================================
// Missing district values
// =============================================================================

function inferMissingDistrictValues(
    values: string[],
    expectedDistrictCount:
        number | undefined
): string[] {
    if (
        expectedDistrictCount === undefined ||
        expectedDistrictCount <= 0
    ) {
        return [];
    }

    const normalizedValues =
        values.map(
            value =>
                normalizeField(value)
        );

    let numericValues: number[] = [];

    if (
        normalizedValues.every(
            value =>
                /^\d+$/.test(value)
        )
    ) {
        numericValues =
            normalizedValues.map(
                value =>
                    Number(value)
            );
    } else if (
        normalizedValues.every(
            value =>
                /^ward\s+\d+[a-z]?$/i.test(
                    value
                )
        )
    ) {
        numericValues =
            normalizedValues.map(
                value =>
                    Number(
                        value
                            .replace(
                                /^ward\s+/i,
                                ""
                            )
                            .replace(
                                /[a-z]$/i,
                                ""
                            )
                    )
            );
    } else if (
        normalizedValues.every(
            value =>
                /^(?:district|council\s+district)\s+\d+[a-z]?$/i.test(
                    value
                )
        )
    ) {
        numericValues =
            normalizedValues.map(
                value =>
                    Number(
                        value
                            .replace(
                                /^(?:district|council\s+district)\s+/i,
                                ""
                            )
                            .replace(
                                /[a-z]$/i,
                                ""
                            )
                    )
            );
    } else {
        return [];
    }

    const observed =
        new Set(
            numericValues.filter(
                value =>
                    Number.isInteger(value) &&
                    value >= 1
            )
        );

    const missing: string[] = [];

    for (
        let district = 1;
        district <= expectedDistrictCount;
        district += 1
    ) {
        if (
            !observed.has(
                district
            )
        ) {
            missing.push(
                String(district)
            );
        }
    }

    return missing;
}

// =============================================================================
// District field analysis
// =============================================================================

function analyzeDistrictField(
    inspection: ArcGISInspection,
    field: string,
    expectedDistrictCount?:
        ExpectedDistrictCount
): FieldAnalysis {
    const fields =
        inspection.fields ?? [];

    const fieldMetadata =
        fields.find(
            candidate =>
                normalizeField(
                    candidate.name
                ) ===
                normalizeField(field)
        );

    const fieldValues =
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

    const inspectionValues =
        inspection.distinctDistrictValues;

    /*
     * The inspection-level distinct values belong to the district field
     * selected by the inspection stage. Therefore they should only be
     * used for the field explicitly reported by inspection.
     */
    const useInspectionValues =
        inspectionValues &&
        inspectionValues.length > 0 &&
        (
            !inspection.districtFields ||
            inspection.districtFields.length === 0 ||
            inspection.districtFields.some(
                candidate =>
                    normalizeField(candidate) ===
                    normalizeField(field)
            )
        );

    const values =
        useInspectionValues
            ? inspectionValues
            : fieldValues;

    const distinctValues =
        unique(
            values.map(
                value =>
                    String(value).trim()
            )
        );

    const observedDistrictCount =
        distinctValues.length;

    const expectedCount =
        expectedDistrictCount?.count;

    const observedCoverage =
        expectedCount !== undefined &&
        expectedCount > 0
            ? Math.min(
                1,
                observedDistrictCount /
                    expectedCount
            )
            : undefined;

    const unexpectedDistrictValueCount =
        expectedCount !== undefined
            ? Math.max(
                0,
                observedDistrictCount -
                    expectedCount
            )
            : 0;

    const completeDistrictCoverage =
        expectedCount !== undefined
            ? observedDistrictCount ===
                expectedCount
            : undefined;

    const missingDistrictValues =
        inferMissingDistrictValues(
            distinctValues,
            expectedCount
        );

    let fieldScore =
        scoreDistrictFieldName(field);

    /*
     * A field with no observed values should not receive the same
     * district-field confidence as a populated district identifier.
     */
    if (
        observedDistrictCount === 0
    ) {
        fieldScore =
            Math.min(
                fieldScore,
                25
            );
    }

    /*
     * A populated field with a recognizable district pattern receives
     * additional confidence.
     */
    const pattern =
        classifyValuePattern(
            distinctValues
        );

    if (
        pattern === "numeric" ||
        pattern === "ward-number" ||
        pattern === "district-number"
    ) {
        fieldScore += 15;
    } else if (
        pattern === "named"
    ) {
        fieldScore += 5;
    } else if (
        pattern === "mixed"
    ) {
        fieldScore -= 10;
    }

    /*
     * Complete authoritative coverage is strong evidence.
     */
    if (
        completeDistrictCoverage === true
    ) {
        fieldScore += 25;
    }

    /*
     * Excess distinct values relative to the independently established
     * expectation are strong negative evidence.
     */
    if (
        expectedCount !== undefined &&
        observedDistrictCount >
            expectedCount
    ) {
        fieldScore -=
            Math.min(
                30,
                (
                    observedDistrictCount -
                    expectedCount
                ) * 2
            );
    }

    return {
        field,

        fieldScore,

        distinctValues,

        observedDistrictCount,

        expectedDistrictCount:
            expectedCount,

        expectedDistrictSource:
            expectedDistrictCount?.source,

        expectedDistrictConfidence:
            expectedDistrictCount?.confidence,

        observedCoverage,

        unexpectedDistrictValueCount,

        districtCountConsistent:
            expectedCount !== undefined
                ? observedDistrictCount <=
                    expectedCount +
                        MAX_UNEXPECTED_DISTRICT_VALUES
                : undefined,

        completeDistrictCoverage,

        missingDistrictValues,

        pattern
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
        geometryType ===
            "esri geometry polygon" ||
        geometryType ===
            "polygon";

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
        best.expectedDistrictCount !==
        undefined
    ) {
        confidence += 5;
    }

    if (
        best.observedCoverage !== undefined &&
        best.observedCoverage >=
            MIN_COVERAGE
    ) {
        confidence += 5;
    }

    if (
        best.completeDistrictCoverage === true
    ) {
        confidence += 5;
    }

    if (
        semanticEvidence.boundaryScore >
        semanticEvidence.thematicScore
    ) {
        confidence += 10;
    } else if (
        semanticEvidence.thematicScore >=
            semanticEvidence.boundaryScore &&
        semanticEvidence.thematicScore > 0
    ) {
        confidence -= 15;
    }

    /*
     * A mixed district field is a major negative signal.
     *
     * This is particularly important for the Phoenix
     * Maricopa_County_City_Council_Districts layer, whose Ward field
     * contains:
     *
     *     1 ... 8
     *     ACACIA
     *     BARREL
     *     CACTUS
     *     ...
     *
     * It must not receive high confidence simply because it is named
     * Ward and contains the expected numeric district values.
     */
    if (
        best.pattern === "mixed"
    ) {
        confidence -= 25;
    }

    /*
     * Excess distinct values relative to the authoritative expectation
     * are also a strong negative signal.
     */
    if (
        best.expectedDistrictCount !== undefined &&
        best.observedDistrictCount >
            best.expectedDistrictCount
    ) {
        confidence -= Math.min(
            25,
            (
                best.observedDistrictCount -
                best.expectedDistrictCount
            ) * 2
        );
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

    // =========================================================================
    // Semantic rejection
    // =========================================================================

    if (
        semanticEvidence.thematicScore > 0 &&
        semanticEvidence.thematicScore >=
            semanticEvidence.boundaryScore
    ) {
        return false;
    }

    // =========================================================================
    // Derived dataset rejection
    // =========================================================================

    if (
        classification.sourceRole ===
        "derived"
    ) {
        return false;
    }

    // =========================================================================
    // Geometry
    // =========================================================================

    if (!isPolygon) {
        return false;
    }

    // =========================================================================
    // Distinct-value guard
    // =========================================================================

    if (
        best.observedDistrictCount <
        MIN_DISTINCT_VALUES
    ) {
        return false;
    }

    // =========================================================================
    // Cardinality guard
    // =========================================================================

    if (
        best.expectedDistrictCount !== undefined
    ) {
        if (
            best.observedDistrictCount >
            best.expectedDistrictCount +
                MAX_UNEXPECTED_DISTRICT_VALUES
        ) {
            return false;
        }
    } else if (
        best.observedDistrictCount >
        MAX_DISTINCT_VALUES
    ) {
        return false;
    }

    // =========================================================================
    // Mixed-value rejection
    // =========================================================================

    if (
        best.pattern === "mixed"
    ) {
        return false;
    }

    // =========================================================================
    // Strong semantic boundary path
    // =========================================================================

    const expectedCountKnown =
        best.expectedDistrictCount !==
        undefined;

    const completeCoverage =
        best.completeDistrictCoverage ===
        true;

    const coverageSufficient =
        !expectedCountKnown ||
        completeCoverage;

    if (
        isPolygon &&
        classification.isPoliticalBoundary &&
        semanticEvidence.boundaryScore >
            semanticEvidence.thematicScore &&
        confidence >= 70 &&
        coverageSufficient
    ) {
        return true;
    }

    // =========================================================================
    // Structural validation
    // =========================================================================

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
        best.observedCoverage !== undefined &&
        best.observedCoverage >=
            MIN_COVERAGE;

    // =========================================================================
    // Strong political field
    // =========================================================================

    if (
        explicitPoliticalField &&
        recognizablePattern &&
        populated &&
        confidence >= 55
    ) {
        return true;
    }

    // =========================================================================
    // Ward field
    // =========================================================================

    if (
        wardField &&
        best.observedDistrictCount >=
            MIN_DISTINCT_VALUES &&
        populated &&
        confidence >= 50
    ) {
        return true;
    }

    // =========================================================================
    // Explicit political identity
    // =========================================================================

    if (
        classification.isPoliticalBoundary &&
        recognizablePattern &&
        populated &&
        confidence >= 55
    ) {
        return true;
    }

    // =========================================================================
    // Generic district field
    // =========================================================================

    if (
        genericDistrictField &&
        classification.isPoliticalBoundary &&
        best.observedDistrictCount >=
            MIN_DISTINCT_VALUES &&
        populated &&
        confidence >= 65
    ) {
        return true;
    }

    // =========================================================================
    // Official municipal source
    // =========================================================================

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
    classification: CandidateClassification,
    expectedDistrictCount?:
        ExpectedDistrictCount
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

    const candidateFields =
        getCandidateDistrictFields(
            inspection
        );

    const fieldAnalyses =
        candidateFields.map(
            field =>
                analyzeDistrictField(
                    inspection,
                    field,
                    expectedDistrictCount
                )
        );

    const best =
        fieldAnalyses
            .sort(
                (a, b) =>
                    b.fieldScore -
                    a.fieldScore
            )[0] ?? {
                field: "",
                fieldScore: 0,
                distinctValues: [],
                observedDistrictCount: 0,
                expectedDistrictCount:
                    expectedDistrictCount?.count,
                expectedDistrictSource:
                    expectedDistrictCount?.source,
                expectedDistrictConfidence:
                    expectedDistrictCount?.confidence,
                observedCoverage:
                    undefined,
                unexpectedDistrictValueCount:
                    0,
                districtCountConsistent:
                    undefined,
                completeDistrictCoverage:
                    undefined,
                missingDistrictValues: [],
                pattern:
                    "unknown" as const
            };

    console.log(
        "DISTRICT FIELD DEBUG:",
        {
            title:
                inspection.title,

            fields:
                fieldAnalyses.map(
                    analysis => ({
                        field:
                            analysis.field,

                        fieldScore:
                            analysis.fieldScore,

                        observedDistrictCount:
                            analysis.observedDistrictCount,

                        expectedDistrictCount:
                            analysis.expectedDistrictCount,

                        coverage:
                            analysis.observedCoverage,

                        pattern:
                            analysis.pattern,

                        completeDistrictCoverage:
                            analysis.completeDistrictCoverage
                    })
                ),

            selectedField:
                best.field,

            selectedFieldScore:
                best.fieldScore
        }
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

            districtField:
                best.field,

            districtFieldScore:
                best.fieldScore,

            distinctDistrictValues:
                best.distinctValues,

            observedDistrictCount:
                best.observedDistrictCount,

            expectedDistrictCount:
                best.expectedDistrictCount,

            unexpectedDistrictValueCount:
                best.unexpectedDistrictValueCount,

            expectedDistrictSource:
                best.expectedDistrictSource,

            expectedDistrictConfidence:
                best.expectedDistrictConfidence,

            coverage:
                best.observedCoverage,

            completeDistrictCoverage:
                best.completeDistrictCoverage,

            missingDistrictValues:
                best.missingDistrictValues,

            featureCount:
                inspection.featureCount,

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
            semanticEvidence.thematicScore > 0 &&
            semanticEvidence.thematicScore >=
                semanticEvidence.boundaryScore
        ) {
            rejectionReasons.push(
                "thematic dataset semantics are as strong as or stronger than boundary semantics"
            );
        }

        if (
            classification.sourceRole ===
            "derived"
        ) {
            rejectionReasons.push(
                "derived dataset uses municipal districts as an analytical or aggregation dimension rather than representing the district boundaries themselves"
            );
        }

        if (
            best.expectedDistrictCount !== undefined &&
            best.observedDistrictCount >
                best.expectedDistrictCount +
                    MAX_UNEXPECTED_DISTRICT_VALUES
        ) {
            rejectionReasons.push(
                "too many distinct district values for expected district count"
            );
        } else if (
            best.expectedDistrictCount === undefined &&
            best.observedDistrictCount >
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
            best.pattern === "mixed"
        ) {
            rejectionReasons.push(
                "district field contains mixed numeric and named values"
            );
        }

        if (
            best.observedCoverage !== undefined &&
            best.observedCoverage <
                MIN_COVERAGE
        ) {
            rejectionReasons.push(
                "insufficient district-field coverage"
            );
        }

        if (
            best.observedCoverage === undefined &&
            best.distinctValues.length > 0 &&
            !(
                classification.isPoliticalBoundary &&
                semanticEvidence.boundaryScore >
                    semanticEvidence.thematicScore
            )
        ) {
            rejectionReasons.push(
                "district-field coverage could not be established"
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
            `Distinct district values observed: ${best.distinctValues.length}.`
        );
    }

    if (
        inspection.featureCount !== undefined
    ) {
        evidence.push(
            `ArcGIS feature count: ${inspection.featureCount}.`
        );
    }

    if (
        best.expectedDistrictCount !==
        undefined
    ) {
        evidence.push(
            `Expected district count: ${best.expectedDistrictCount}.`
        );
    } else {
        evidence.push(
            "Expected district count: unknown."
        );
    }

    if (
        best.expectedDistrictSource !==
        undefined
    ) {
        evidence.push(
            `Expected district count source: ${best.expectedDistrictSource}.`
        );
    }

    if (
        best.expectedDistrictConfidence !==
        undefined
    ) {
        evidence.push(
            `Expected district count confidence: ${best.expectedDistrictConfidence}.`
        );
    }

    if (
        best.observedCoverage !== undefined
    ) {
        evidence.push(
            `District-field coverage: ${(best.observedCoverage * 100).toFixed(1)}%.`
        );
    } else {
        evidence.push(
            "District-field coverage: unknown."
        );
    }

    if (
        best.completeDistrictCoverage !==
        undefined
    ) {
        evidence.push(
            `Complete district coverage: ${best.completeDistrictCoverage}.`
        );
    } else {
        evidence.push(
            "Complete district coverage: unknown."
        );
    }

    if (
        best.missingDistrictValues.length >
        0
    ) {
        evidence.push(
            `Missing district values: ${best.missingDistrictValues.join(", ")}.`
        );
    }

    evidence.push(
        `District value pattern: ${best.pattern}.`
    );

    evidence.push(
        `District field score: ${best.fieldScore}.`
    );

    evidence.push(
        `Validation confidence: ${confidence}.`
    );

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

        /*
         * sampleCount historically represented the number of distinct
         * district values. Preserve that behavior for compatibility.
         */
        sampleCount:
            best.distinctValues.length,

        featureCount:
            inspection.featureCount,

        distinctDistrictValues:
            best.distinctValues,

        districtValuePattern:
            best.pattern,

        geometryType:
            inspection.geometryType,

        municipalityOverlap:
            undefined,

        evidence,

        expectedDistrictCount:
            best.expectedDistrictCount,

        completeDistrictCoverage:
            best.completeDistrictCoverage,

        missingDistrictValues:
            best.missingDistrictValues,

        rejectionReasons
    };
}