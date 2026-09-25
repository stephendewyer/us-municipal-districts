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

    /*
     * District identifiers actually observed in the layer.
     */
    distinctValues: string[];

    /*
     * Number of distinct district identifiers actually observed.
     *
     * This is intentionally different from featureCount because
     * multiple polygon features may belong to the same district.
     */
    observedDistrictCount: number;

    /*
     * Independently established expected district count.
     *
     * This MUST NOT be inferred from the observed values.
     */
    expectedDistrictCount?: number;

    /*
     * Provenance for the expected district count, when available.
     */
    expectedDistrictSource?:
        ExpectedDistrictCount["source"];

    /*
     * Confidence in the expected district count.
     */
    expectedDistrictConfidence?: number;

    /*
     * observedDistrictCount / expectedDistrictCount.
     *
     * Undefined means the expected district count is unknown.
     */
    observedCoverage?: number;

    unexpectedDistrictValueCount: number;

    districtCountConsistent?: boolean;

    /*
     * True only when the authoritative expectation is satisfied.
     *
     * Undefined means completeness cannot be established.
     */
    completeDistrictCoverage?: boolean;

    /*
     * Missing district values can only be established when the
     * expected values are themselves known or can safely be represented
     * numerically from an authoritative expected count.
     */
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
                !/^\d+[a-z]?$/i.test(value)
        );

    if (namedPattern) {
        return "named";
    }

    /*
     * Values contain more than one semantic pattern.
     *
     * Example:
     *
     *     1, 2, 3, 4, 5, 6, 7, 8,
     *     ACACIA, BARREL, CACTUS
     *
     * This is strong evidence that the selected field is not
     * actually a clean district identifier field.
     */
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

    /*
     * Missing values may only be inferred safely for numeric
     * district identifiers in the conventional 1..N form.
     *
     * This function does NOT establish the expected count.
     *
     * The expected count must already have been established
     * independently by the caller.
     */
    const normalizedValues =
        values.map(
            value =>
                normalizeField(value)
        );

    let numericValues:
        number[] = [];

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
                /^ward\s+\d+[a-z]?$/i.test(value)
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
        /*
         * Named districts cannot be reconstructed from a count alone.
         *
         * Example:
         *
         *     observed: North, Central, South
         *     expected: 5
         *
         * We know that two districts are missing, but we do not know
         * their names.
         */
        return [];
    }

    const observed =
        new Set(
            numericValues
                .filter(
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
    expectedDistrictCount?:
        ExpectedDistrictCount
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
            observedDistrictCount: 0,
            expectedDistrictCount: expectedDistrictCount?.count,
            expectedDistrictSource: expectedDistrictCount?.source,
            expectedDistrictConfidence: expectedDistrictCount?.confidence,
            observedCoverage: undefined,
            unexpectedDistrictValueCount: 0,
            completeDistrictCoverage: undefined,
            missingDistrictValues: [],
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

    /*
     * ArcGISInspection does not necessarily contain sampled field
     * values directly. The caller may provide them through the
     * district field metadata.
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
     * If inspection already exposes distinct district values,
     * prefer those.
     *
     * These values come from the dedicated district-value query
     * performed by inspectArcGIS().
     */
    const inspectionValues =
        inspection.distinctDistrictValues;

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

    const distinctDistrictValues =
        [...new Set(
            finalValues
                .map(
                    value =>
                        value.trim()
                )
                .filter(Boolean)
        )];

    const observedDistrictCount =
        distinctDistrictValues.length;

    /*
    * IMPORTANT:
    *
    * We do NOT infer expectedDistrictCount from observed values.
    *
    * The expected count must come from independent authoritative
    * evidence.
    */
    const expectedCount =
        expectedDistrictCount?.count;

    /*
    * Coverage is only calculated when an independently established
    * expected count is available.
    */
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

    /*
    * Complete district coverage means the observed number of
    * distinct district identifiers exactly matches the
    * independently established expected count.
    */
    const completeDistrictCoverage =
        expectedCount !== undefined
            ? observedDistrictCount === expectedCount
            : undefined;

    const missingDistrictValues =
        inferMissingDistrictValues(
            distinctDistrictValues,
            expectedCount
        );

    return {
        field,

        distinctValues:
            distinctDistrictValues,

        observedDistrictCount,

        expectedDistrictCount:
            expectedCount,

        expectedDistrictSource:
            expectedDistrictCount?.source,

        expectedDistrictConfidence:
            expectedDistrictCount?.confidence,

        observedCoverage,

        unexpectedDistrictValueCount,

        completeDistrictCoverage,

        missingDistrictValues,

        pattern:
            classifyValuePattern(
                distinctDistrictValues
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

    /*
     * Expected district evidence contributes confidence independently
     * from observed coverage.
     *
     * This rewards the existence of authoritative expectation evidence
     * without treating that evidence as observed geometry.
     */
    if (
        best.expectedDistrictCount !==
        undefined
    ) {
        confidence += 5;
    }

    /*
     * Only award coverage confidence when coverage is actually known.
     */
    if (
        best.observedCoverage !== undefined &&
        best.observedCoverage >=
            MIN_COVERAGE
    ) {
        confidence += 5;
    }

    /*
     * Complete district coverage is stronger evidence than merely
     * meeting the 50% threshold.
     */
    if (
        best.completeDistrictCoverage === true
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

    if (
        best.pattern === "mixed" &&
        best.expectedDistrictCount !== undefined
    ) {
        return false;
    }

    // =========================================================================
    // Strong semantic political-boundary path
    // =========================================================================

    /*
     * Accept a polygon when:
     *
     *   - the classifier identifies it as a political boundary,
     *   - boundary semantics are stronger than thematic semantics, and
     *   - confidence is already high.
     *
     * This allows a legitimate municipal boundary layer to remain valid
     * even when district-value inspection is incomplete or unavailable.
     */
    if (
        isPolygon &&
        classification.isPoliticalBoundary &&
        semanticEvidence.boundaryScore >
            semanticEvidence.thematicScore &&
        confidence >= 70
    ) {
        return true;
    }

    // -------------------------------------------------------------------------
    // Basic distinct-value guard
    // -------------------------------------------------------------------------

    if (
        best.distinctValues.length <
        MIN_DISTINCT_VALUES
    ) {
        /*
         * If coverage is unknown, do not treat it as zero.
         *
         * A boundary-native official layer may still be valid through
         * the strong semantic path above, but this structural path
         * requires enough observed district values.
         */
        return (
            classification.isPoliticalBoundary &&
            classification.officialMunicipalSource &&
            best.observedCoverage !== undefined &&
            best.observedCoverage >=
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

    /*
     * Coverage is populated only when an authoritative expected
     * district count is available.
     *
     * Unknown coverage is not interpreted as zero coverage.
     */
    const populated =
        best.observedCoverage !== undefined &&
        best.observedCoverage >=
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

    const best =
        analyzeDistrictField(
            inspection,
            expectedDistrictCount
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
            best.pattern === "mixed" &&
            best.expectedDistrictCount !== undefined
        ) {
            rejectionReasons.push(
                "district field contains mixed numeric and named values"
            );
        }

        /*
         * Only report insufficient coverage when an expected district
         * count is known.
         */
        if (
            best.observedCoverage !== undefined &&
            best.observedCoverage <
                MIN_COVERAGE
        ) {
            rejectionReasons.push(
                "insufficient district-field coverage"
            );
        }

        /*
         * Unknown coverage is diagnostic information, not automatically
         * a rejection reason.
         *
         * The strong semantic path can still accept a boundary-native
         * political layer when expected district count is unavailable.
         */
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

    /*
     * Report feature count separately from district count.
     *
     * Feature count describes polygon records.
     * Observed district count describes unique district identifiers.
     */
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