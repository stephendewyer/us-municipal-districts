// generator/src/dedupe.ts

import type {
    ArcGISField,
    ArcGISGeometryType,
    EquivalentLayerGroup,
    InspectedCandidate,
    LayerFingerprint
} from "./types.js";


// =============================================================================
// Constants
// =============================================================================

const DISTRICT_FIELD_TERMS = [
    "ward",
    "wards",
    "ward_no",
    "ward_num",
    "ward_number",
    "district",
    "districts",
    "district_no",
    "district_num",
    "district_number",
    "council",
    "council_district",
    "councildistrict"
];

const NAME_FIELD_TERMS = [
    "name",
    "ward_name",
    "district_name",
    "council_name",
    "label",
    "description"
];

const IGNORED_TITLE_TOKENS = new Set([
    "city",
    "county",
    "of",
    "the",
    "and",
    "open",
    "data",
    "gis",
    "arcgis",
    "layer",
    "layers",
    "map",
    "service",
    "services",
    "boundary",
    "boundaries"
]);


// =============================================================================
// Normalization
// =============================================================================

function normalize(value?: string): string {
    return (value ?? "")
        .toLowerCase()
        .replace(/[_-]+/g, " ")
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}


function normalizeFieldName(value?: string): string {
    return (value ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
}


// =============================================================================
// URL normalization
// =============================================================================

/**
 * Normalize an ArcGIS URL for comparison.
 *
 * Query parameters are removed because parameters such as
 * f=json, token, outFields, etc. do not identify the layer itself.
 */
function normalizeUrl(url: string): string {
    try {
        const parsed = new URL(url);

        parsed.hash = "";
        parsed.search = "";

        return parsed.toString().replace(/\/$/, "");
    } catch {
        return normalize(url);
    }
}


// =============================================================================
// Field detection
// =============================================================================

function matchesFieldTerm(
    field: ArcGISField,
    terms: string[]
): boolean {

    const name =
        normalizeFieldName(field.name);

    const alias =
        normalizeFieldName(field.alias);

    return terms.some(term => {

        const normalizedTerm =
            normalizeFieldName(term);

        return (
            name === normalizedTerm ||
            alias === normalizedTerm ||
            name.includes(normalizedTerm) ||
            alias.includes(normalizedTerm)
        );
    });
}


function isDistrictField(
    field: ArcGISField
): boolean {

    return matchesFieldTerm(
        field,
        DISTRICT_FIELD_TERMS
    );
}


function isNameField(
    field: ArcGISField
): boolean {

    return matchesFieldTerm(
        field,
        NAME_FIELD_TERMS
    );
}


// =============================================================================
// Fingerprints
// =============================================================================

/**
 * Create a normalized fingerprint describing the structure of an
 * ArcGIS layer.
 *
 * The fingerprint is used to determine whether two inspected candidates
 * are likely to represent the same underlying dataset.
 */
export function createLayerFingerprint(
    candidate: InspectedCandidate
): LayerFingerprint {

    const inspection =
        candidate.inspection;

    const fields =
        inspection.fields ?? [];

    return {
        title: normalize(
            inspection.title ??
            candidate.candidate.title
        ),

        serviceName: normalize(
            inspection.serviceName
        ),

        layerName: normalize(
            inspection.layerName
        ),

        geometryType:
            inspection.geometryType,

        fields: fields
            .map(field =>
                normalizeFieldName(field.name)
            )
            .filter(Boolean)
            .sort(),

        districtFields: fields
            .filter(isDistrictField)
            .map(field =>
                normalizeFieldName(field.name)
            )
            .filter(Boolean)
            .sort(),

        nameFields: fields
            .filter(isNameField)
            .map(field =>
                normalizeFieldName(field.name)
            )
            .filter(Boolean)
            .sort()
    };
}


// =============================================================================
// Title similarity
// =============================================================================

function titleTokens(
    value?: string
): Set<string> {

    if (!value) {
        return new Set();
    }

    return new Set(
        normalize(value)
            .split(" ")
            .filter(token =>
                token.length > 1 &&
                !IGNORED_TITLE_TOKENS.has(token)
            )
    );
}


function tokenSimilarity(
    a?: string,
    b?: string
): number {

    const aTokens =
        titleTokens(a);

    const bTokens =
        titleTokens(b);

    if (
        aTokens.size === 0 ||
        bTokens.size === 0
    ) {
        return 0;
    }

    let intersection = 0;

    for (const token of aTokens) {
        if (bTokens.has(token)) {
            intersection++;
        }
    }

    const union =
        new Set([
            ...aTokens,
            ...bTokens
        ]).size;

    return union === 0
        ? 0
        : intersection / union;
}


// =============================================================================
// Geometry
// =============================================================================

function normalizeGeometry(
    geometry?: ArcGISGeometryType
): string | undefined {

    if (!geometry) {
        return undefined;
    }

    switch (geometry) {

        case "polygon":
        case "esriGeometryPolygon":
            return "polygon";

        case "point":
        case "esriGeometryPoint":
            return "point";

        case "polyline":
        case "esriGeometryPolyline":
            return "polyline";

        case "multipoint":
        case "esriGeometryMultipoint":
            return "multipoint";

        case "esriGeometryEnvelope":
            return "envelope";

        default:
            return normalize(geometry);
    }
}


function sameGeometry(
    a: InspectedCandidate,
    b: InspectedCandidate
): boolean {

    const geometryA =
        normalizeGeometry(
            a.inspection.geometryType
        );

    const geometryB =
        normalizeGeometry(
            b.inspection.geometryType
        );

    /*
     * Missing geometry information should not automatically prevent
     * a match.
     */
    if (!geometryA || !geometryB) {
        return true;
    }

    return geometryA === geometryB;
}


// =============================================================================
// District type
// =============================================================================

function sameDistrictType(
    a: InspectedCandidate,
    b: InspectedCandidate
): boolean {

    const typeA =
        a.classification.districtType;

    const typeB =
        b.classification.districtType;

    /*
     * If either candidate has not been classified with a district type,
     * we cannot use this criterion.
     */
    if (!typeA || !typeB) {
        return false;
    }

    return typeA === typeB;
}


// =============================================================================
// Field similarity
// =============================================================================

function fieldSimilarity(
    a: LayerFingerprint,
    b: LayerFingerprint
): number {

    const aFields =
        new Set(a.fields);

    const bFields =
        new Set(b.fields);

    if (
        aFields.size === 0 ||
        bFields.size === 0
    ) {
        return 0;
    }

    let shared = 0;

    for (const field of aFields) {
        if (bFields.has(field)) {
            shared++;
        }
    }

    const union =
        new Set([
            ...aFields,
            ...bFields
        ]).size;

    return union === 0
        ? 0
        : shared / union;
}


// =============================================================================
// District field similarity
// =============================================================================

function districtFieldSimilarity(
    a: LayerFingerprint,
    b: LayerFingerprint
): number {

    const aFields =
        new Set(a.districtFields);

    const bFields =
        new Set(b.districtFields);

    if (
        aFields.size === 0 ||
        bFields.size === 0
    ) {
        return 0;
    }

    let shared = 0;

    for (const field of aFields) {
        if (bFields.has(field)) {
            shared++;
        }
    }

    const union =
        new Set([
            ...aFields,
            ...bFields
        ]).size;

    return union === 0
        ? 0
        : shared / union;
}


// =============================================================================
// URL equivalence
// =============================================================================

function sameUrl(
    a: InspectedCandidate,
    b: InspectedCandidate
): boolean {

    const urlA =
        a.inspection.url ||
        a.candidate.url;

    const urlB =
        b.inspection.url ||
        b.candidate.url;

    return (
        normalizeUrl(urlA) ===
        normalizeUrl(urlB)
    );
}


// =============================================================================
// ArcGIS service equivalence
// =============================================================================

function sameService(
    a: InspectedCandidate,
    b: InspectedCandidate
): boolean {

    const serviceA =
        normalize(a.inspection.serviceName);

    const serviceB =
        normalize(b.inspection.serviceName);

    if (
        !serviceA ||
        !serviceB
    ) {
        return false;
    }

    return serviceA === serviceB;
}


// =============================================================================
// Layer name equivalence
// =============================================================================

function sameLayerName(
    a: InspectedCandidate,
    b: InspectedCandidate
): boolean {

    const layerA =
        normalize(a.inspection.layerName);

    const layerB =
        normalize(b.inspection.layerName);

    if (
        !layerA ||
        !layerB
    ) {
        return false;
    }

    return layerA === layerB;
}


// =============================================================================
// Equivalence result
// =============================================================================

export interface EquivalenceResult {

    /**
     * Whether the two candidates should be treated as equivalent.
     */
    equivalent: boolean;

    /**
     * Confidence from 0 to 1.
     */
    confidence: number;

    /**
     * Evidence supporting the determination.
     */
    reasons: string[];
}


// =============================================================================
// Candidate comparison
// =============================================================================

/**
 * Compare two inspected ArcGIS candidates.
 *
 * This deliberately uses conservative rules. We would rather leave
 * two equivalent sources in separate groups than incorrectly merge
 * two different political boundary datasets.
 */
export function compareCandidates(
    a: InspectedCandidate,
    b: InspectedCandidate
): EquivalenceResult {

    const reasons: string[] = [];

    let score = 0;

    const fingerprintA =
        createLayerFingerprint(a);

    const fingerprintB =
        createLayerFingerprint(b);


    // -------------------------------------------------------------------------
    // Same URL
    // -------------------------------------------------------------------------

    if (sameUrl(a, b)) {

        return {
            equivalent: true,
            confidence: 1,
            reasons: [
                "same ArcGIS layer URL"
            ]
        };
    }


    // -------------------------------------------------------------------------
    // District type
    // -------------------------------------------------------------------------

    if (
        !sameDistrictType(a, b)
    ) {

        return {
            equivalent: false,
            confidence: 0,
            reasons: [
                "different political district types"
            ]
        };
    }

    score += 0.20;

    reasons.push(
        "same political district type"
    );


    // -------------------------------------------------------------------------
    // Geometry
    // -------------------------------------------------------------------------

    if (
        sameGeometry(a, b)
    ) {

        score += 0.15;

        reasons.push(
            "same geometry type"
        );
    }


    // -------------------------------------------------------------------------
    // Same ArcGIS service
    // -------------------------------------------------------------------------

    if (
        sameService(a, b)
    ) {

        score += 0.20;

        reasons.push(
            "same ArcGIS service"
        );
    }


    // -------------------------------------------------------------------------
    // Same layer name
    // -------------------------------------------------------------------------

    if (
        sameLayerName(a, b)
    ) {

        score += 0.15;

        reasons.push(
            "same ArcGIS layer name"
        );
    }


    // -------------------------------------------------------------------------
    // Title similarity
    // -------------------------------------------------------------------------

    const titleSimilarity =
        tokenSimilarity(
            fingerprintA.title,
            fingerprintB.title
        );

    if (
        titleSimilarity >= 0.75
    ) {

        score += 0.20;

        reasons.push(
            `highly similar layer titles (${titleSimilarity.toFixed(2)})`
        );

    } else if (
        titleSimilarity >= 0.50
    ) {

        score += 0.15;

        reasons.push(
            `similar layer titles (${titleSimilarity.toFixed(2)})`
        );

    } else if (
        titleSimilarity >= 0.30
    ) {

        score += 0.05;

        reasons.push(
            `partially similar layer titles (${titleSimilarity.toFixed(2)})`
        );
    }


    // -------------------------------------------------------------------------
    // District fields
    // -------------------------------------------------------------------------

    const districtSimilarity =
        districtFieldSimilarity(
            fingerprintA,
            fingerprintB
        );

    if (
        districtSimilarity >= 0.75
    ) {

        score += 0.20;

        reasons.push(
            `strong district-field similarity (${districtSimilarity.toFixed(2)})`
        );

    } else if (
        districtSimilarity > 0
    ) {

        score += 0.10;

        reasons.push(
            `partial district-field similarity (${districtSimilarity.toFixed(2)})`
        );
    }


    // -------------------------------------------------------------------------
    // General field structure
    // -------------------------------------------------------------------------

    const fields =
        fieldSimilarity(
            fingerprintA,
            fingerprintB
        );

    if (
        fields >= 0.75
    ) {

        score += 0.10;

        reasons.push(
            `highly similar field structure (${fields.toFixed(2)})`
        );

    } else if (
        fields >= 0.50
    ) {

        score += 0.05;

        reasons.push(
            `similar field structure (${fields.toFixed(2)})`
        );
    }


    // -------------------------------------------------------------------------
    // Final determination
    // -------------------------------------------------------------------------

    /*
     * A score of 0.70 or higher means there is substantial evidence
     * that the layers represent the same underlying dataset.
     *
     * This is intentionally conservative.
     */
    const equivalent =
        score >= 0.70;

    return {
        equivalent,
        confidence: Math.min(score, 1),
        reasons
    };
}


// =============================================================================
// Grouping
// =============================================================================

/**
 * Group equivalent candidates.
 *
 * Candidates are processed into connected groups, but a candidate must
 * actually match an existing member of the group.
 */
export function groupEquivalentCandidates(
    candidates: InspectedCandidate[]
): EquivalentLayerGroup[] {

    const groups: EquivalentLayerGroup[] = [];

    for (const candidate of candidates) {

        let matchedGroup:
            EquivalentLayerGroup | undefined;

        let bestConfidence = 0;

        let bestReasons: string[] = [];


        // ---------------------------------------------------------------------
        // Find strongest matching group
        // ---------------------------------------------------------------------

        for (const group of groups) {

            for (const existing of group.candidates) {

                const comparison =
                    compareCandidates(
                        candidate,
                        existing
                    );

                if (
                    comparison.equivalent &&
                    comparison.confidence > bestConfidence
                ) {

                    matchedGroup =
                        group;

                    bestConfidence =
                        comparison.confidence;

                    bestReasons =
                        comparison.reasons;
                }
            }
        }


        // ---------------------------------------------------------------------
        // Add to existing group
        // ---------------------------------------------------------------------

        if (matchedGroup) {

            matchedGroup.candidates.push(
                candidate
            );

            matchedGroup.confidence =
                Math.max(
                    matchedGroup.confidence,
                    bestConfidence
                );

            matchedGroup.reasons = [
                ...new Set([
                    ...matchedGroup.reasons,
                    ...bestReasons
                ])
            ];

            continue;
        }


        // ---------------------------------------------------------------------
        // Create new group
        // ---------------------------------------------------------------------

        groups.push({
            candidates: [
                candidate
            ],

            confidence: 1,

            reasons: [
                "initial candidate group"
            ]
        });
    }

    return groups;
}


// =============================================================================
// Defensive filtering
// =============================================================================

/**
 * Remove candidates that should not participate in deduplication.
 *
 * classify.ts should already perform this filtering, but keeping the
 * check here prevents rejected thematic, Census, parcel, or housing
 * datasets from accidentally entering the canonical selection process.
 */
function filterValidCandidates(
    candidates: InspectedCandidate[]
): InspectedCandidate[] {

    return candidates.filter(candidate => {

        const classification =
            candidate.classification;

        return (
            !classification.rejected &&
            classification.isPoliticalBoundary &&
            classification.isBoundaryLayer
        );
    });
}


// =============================================================================
// Public deduplication API
// =============================================================================

/**
 * Deduplicate a collection of inspected candidates.
 *
 * Only valid political boundary layers are considered.
 */
export function dedupeCandidates(
    candidates: InspectedCandidate[]
): EquivalentLayerGroup[] {

    const valid =
        filterValidCandidates(candidates);

    return groupEquivalentCandidates(
        valid
    );
}