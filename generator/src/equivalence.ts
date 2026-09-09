import type {
    ArcGISGeometryType,
    EquivalentLayerGroup,
    InspectedCandidate,
    LayerFingerprint
} from "./types.js";


// =============================================================================
// Constants
// =============================================================================

const DEFAULT_EQUIVALENCE_THRESHOLD = 0.60;

/**
 * Four-digit years are intentionally ignored when comparing titles.
 *
 * Example:
 *   "Chicago Wards (2015)"
 *   "Chicago Wards (2023)"
 *
 * These should be considered versions of the same underlying dataset family.
 * Temporal ranking is handled separately by temporalValidation.ts / rank.ts.
 */
const TEMPORAL_TITLE_TOKEN_PATTERN = /^\d{4}$/;

const IGNORED_TITLE_TOKENS =
    new Set([
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

function normalize(
    value?: string
): string | undefined {

    if (!value) {
        return undefined;
    }

    return value
        .toLowerCase()
        .replace(/[_-]+/g, " ")
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim() || undefined;
}

function normalizeTemporalName(
    value?: string
): string | undefined {

    const normalized =
        normalize(value);

    if (!normalized) {
        return undefined;
    }

    return normalized
        .split(/\s+/)
        .filter(
            token =>
                !TEMPORAL_TITLE_TOKEN_PATTERN.test(
                    token
                )
        )
        .join(" ")
        .trim() || undefined;
}

function normalizeFieldName(
    value?: string
): string | undefined {

    if (!value) {
        return undefined;
    }

    return value
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .trim() || undefined;
}


function normalizeArray(
    values: string[] = []
): string[] {

    return values
        .map(normalizeFieldName)
        .filter(
            (value): value is string =>
                Boolean(value)
        )
        .sort();
}


// =============================================================================
// URL normalization
// =============================================================================

/**
 * Normalize an ArcGIS layer URL.
 *
 * Query parameters and fragments are removed because they generally
 * do not identify the underlying ArcGIS layer.
 */
function normalizeUrl(
    url: string
): string {

    try {

        const parsed =
            new URL(
                url.trim()
            );

        parsed.hash = "";
        parsed.search = "";

        parsed.hostname =
            parsed.hostname.toLowerCase();

        return parsed
            .toString()
            .replace(/\/+$/, "");

    } catch {

        return url
            .trim()
            .replace(/\/+$/, "")
            .toLowerCase();
    }
}


// =============================================================================
// Group ID
// =============================================================================

/**
 * Create a deterministic ID for an equivalence group.
 *
 * The ID is based on the complete normalized set of member URLs rather than
 * the first candidate encountered during discovery. This makes the group ID
 * independent of discovery order.
 */
function createGroupId(
    candidates: InspectedCandidate[]
): string {

    const urls =
        candidates
            .map(
                candidate =>
                    normalizeUrl(
                        candidate.inspection.url ||
                        candidate.candidate.url
                    )
            )
            .sort();

    return (
        `group-${encodeURIComponent(
            urls.join("|")
        )}`
    );
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
            return normalize(
                geometry
            );
    }
}


// =============================================================================
// Candidate eligibility
// =============================================================================

/**
 * Only genuine political boundary layers participate in equivalence
 * detection.
 *
 * This prevents thematic datasets containing fields such as WARD or
 * DISTRICT from being grouped with actual political boundary layers.
 */
function isEligibleForEquivalence(
    candidate: InspectedCandidate
): boolean {

    const classification =
        candidate.classification;

    const geometry =
        normalizeGeometry(
            candidate.inspection.geometryType
        );

    return (

        classification.rejected !== true &&

        classification.isPoliticalBoundary === true &&

        classification.isBoundaryLayer === true &&

        Boolean(
            classification.districtType
        ) &&

        geometry === "polygon"
    );
}


// =============================================================================
// Municipality equivalence
// =============================================================================

/**
 * Candidates from different municipalities must never be considered
 * equivalent, even if they happen to use the same URL or otherwise have
 * identical metadata.
 */
function sameMunicipality(
    a: InspectedCandidate,
    b: InspectedCandidate
): boolean {

    const placeFipsA =
        a.candidate.placeFips;

    const placeFipsB =
        b.candidate.placeFips;

    if (
        !placeFipsA ||
        !placeFipsB
    ) {
        return false;
    }

    return (
        placeFipsA ===
        placeFipsB
    );
}


// =============================================================================
// Fingerprint
// =============================================================================

/**
 * Create a normalized structural fingerprint for a candidate.
 *
 * This is the only fingerprint implementation used by the project.
 */
export function createLayerFingerprint(
    candidate: InspectedCandidate
): LayerFingerprint {

    const inspection =
        candidate.inspection;

    return {

        title:
            normalize(
                inspection.title ??
                candidate.candidate.title
            ),

        serviceName:
            normalize(
                inspection.serviceName
            ),

        layerName:
            normalize(
                inspection.layerName
            ),

        geometryType:
            inspection.geometryType,

        fields:
            normalizeArray(
                inspection.fields?.map(
                    field =>
                        field.name
                ) ?? []
            ),

        districtFields:
            normalizeArray(
                inspection.districtFields
            ),

        nameFields:
            normalizeArray(
                inspection.nameFields
            )
    };
}


// =============================================================================
// Array similarity
// =============================================================================

function compareArrays(
    a: string[],
    b: string[]
): number {

    if (
        a.length === 0 ||
        b.length === 0
    ) {
        return 0;
    }

    const setA =
        new Set(a);

    const setB =
        new Set(b);

    let intersection = 0;

    for (
        const value of setA
    ) {

        if (
            setB.has(value)
        ) {
            intersection++;
        }
    }

    const union =
        new Set([
            ...setA,
            ...setB
        ]).size;

    return union === 0
        ? 0
        : intersection / union;
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

        value
            .split(/\s+/)
            .map(
                token =>
                    token.trim()
            )
            .filter(
                token =>

                    token.length > 1 &&

                    !TEMPORAL_TITLE_TOKEN_PATTERN.test(
                        token
                    ) &&

                    !IGNORED_TITLE_TOKENS.has(
                        token
                    )
            )
    );
}


function titleSimilarity(
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

    for (
        const token of aTokens
    ) {

        if (
            bTokens.has(token)
        ) {
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

        Boolean(urlA) &&

        Boolean(urlB) &&

        normalizeUrl(urlA) ===
        normalizeUrl(urlB)
    );
}


// =============================================================================
// Service equivalence
// =============================================================================

function sameService(
    a: InspectedCandidate,
    b: InspectedCandidate
): boolean {

    const serviceA =
        normalizeTemporalName(
            a.inspection.serviceName
        );

    const serviceB =
        normalizeTemporalName(
            b.inspection.serviceName
        );

    if (
        !serviceA ||
        !serviceB
    ) {
        return false;
    }

    return (
        serviceA ===
        serviceB
    );
}


// =============================================================================
// Layer equivalence
// =============================================================================

function sameLayerName(
    a: InspectedCandidate,
    b: InspectedCandidate
): boolean {

    const layerA =
        normalizeTemporalName(
            a.inspection.layerName
        );

    const layerB =
        normalizeTemporalName(
            b.inspection.layerName
        );

    if (
        !layerA ||
        !layerB
    ) {
        return false;
    }

    return (
        layerA ===
        layerB
    );
}


// =============================================================================
// District type equivalence
// =============================================================================

function sameDistrictType(
    a: InspectedCandidate,
    b: InspectedCandidate
): boolean {

    const typeA =
        a.classification.districtType;

    const typeB =
        b.classification.districtType;

    if (
        !typeA ||
        !typeB
    ) {
        return false;
    }

    return (
        typeA ===
        typeB
    );
}


// =============================================================================
// Candidate comparison
// =============================================================================

export interface EquivalenceResult {

    equivalent: boolean;

    confidence: number;

    reasons: string[];
}


/**
 * Compare two inspected candidates.
 *
 * The optional threshold controls whether the calculated confidence is
 * sufficient for equivalence. Temporal status is deliberately NOT part of
 * this comparison; temporal ranking determines which equivalent version
 * should become canonical.
 */
export function compareCandidates(
    a: InspectedCandidate,
    b: InspectedCandidate,
    threshold = DEFAULT_EQUIVALENCE_THRESHOLD
): EquivalenceResult {

    const reasons: string[] = [];

    let score = 0;


    // -------------------------------------------------------------------------
    // Municipality
    // -------------------------------------------------------------------------

    if (
        !sameMunicipality(a, b)
    ) {

        return {

            equivalent: false,

            confidence: 0,

            reasons: [
                "different municipalities"
            ]
        };
    }


    // -------------------------------------------------------------------------
    // Exact URL match
    // -------------------------------------------------------------------------

    if (
        sameUrl(a, b)
    ) {

        return {

            equivalent: true,

            confidence: 1,

            reasons: [
                "same ArcGIS layer URL"
            ]
        };
    }


    // -------------------------------------------------------------------------
    // Political district type
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

    const geometryA =
        normalizeGeometry(
            a.inspection.geometryType
        );

    const geometryB =
        normalizeGeometry(
            b.inspection.geometryType
        );

    if (

        geometryA &&

        geometryB &&

        geometryA ===
        geometryB
    ) {

        score += 0.15;

        reasons.push(
            "same geometry type"
        );
    }


    // -------------------------------------------------------------------------
    // ArcGIS service
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
    // Layer name
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

    const titles =
        titleSimilarity(

            normalize(
                a.inspection.title ??
                a.candidate.title
            ),

            normalize(
                b.inspection.title ??
                b.candidate.title
            )
        );

    if (
        titles >= 0.75
    ) {

        score += 0.20;

        reasons.push(
            `highly similar layer titles (${titles.toFixed(2)})`
        );

    } else if (
        titles >= 0.50
    ) {

        score += 0.15;

        reasons.push(
            `similar layer titles (${titles.toFixed(2)})`
        );

    } else if (
        titles >= 0.30
    ) {

        score += 0.05;

        reasons.push(
            `partially similar layer titles (${titles.toFixed(2)})`
        );
    }


    // -------------------------------------------------------------------------
    // Fingerprints
    // -------------------------------------------------------------------------

    const fingerprintA =
        createLayerFingerprint(a);

    const fingerprintB =
        createLayerFingerprint(b);


    // -------------------------------------------------------------------------
    // District fields
    // -------------------------------------------------------------------------

    const districtSimilarity =
        compareArrays(

            fingerprintA.districtFields,

            fingerprintB.districtFields
        );

    if (

        districtSimilarity === 1 &&

        fingerprintA.districtFields.length > 0
    ) {

        score += 0.20;

        reasons.push(
            "same district fields"
        );

    } else if (
        districtSimilarity >= 0.50
    ) {

        score += 0.10;

        reasons.push(
            "similar district fields"
        );
    }


    // -------------------------------------------------------------------------
    // Name fields
    // -------------------------------------------------------------------------

    const nameSimilarity =
        compareArrays(

            fingerprintA.nameFields,

            fingerprintB.nameFields
        );

    if (

        nameSimilarity === 1 &&

        fingerprintA.nameFields.length > 0
    ) {

        score += 0.05;

        reasons.push(
            "same name fields"
        );

    } else if (
        nameSimilarity >= 0.50
    ) {

        score += 0.025;

        reasons.push(
            "similar name fields"
        );
    }


    // -------------------------------------------------------------------------
    // General field structure
    // -------------------------------------------------------------------------

    const fieldSimilarity =
        compareArrays(

            fingerprintA.fields,

            fingerprintB.fields
        );

    if (
        fieldSimilarity >= 0.80
    ) {

        score += 0.10;

        reasons.push(
            "high field similarity"
        );
    }


    // -------------------------------------------------------------------------
    // Final result
    // -------------------------------------------------------------------------

    const confidence =
        Math.min(
            score,
            1
        );

    return {

        equivalent:
            confidence >= threshold,

        confidence,

        reasons
    };
}


// =============================================================================
// Grouping
// =============================================================================

/**
 * Group equivalent political-boundary candidates.
 *
 * Only eligible candidates participate.
 *
 * Temporal versions of the same dataset are intentionally grouped together.
 * The canonical-selection stage is responsible for choosing the current
 * version from within the group.
 *
 * Every group receives a deterministic ID based on its complete membership.
 */
export function detectEquivalentLayers(
    candidates: InspectedCandidate[],
    threshold = DEFAULT_EQUIVALENCE_THRESHOLD
): EquivalentLayerGroup[] {

    const eligibleCandidates =
        candidates.filter(
            isEligibleForEquivalence
        );

    const groups:
        EquivalentLayerGroup[] = [];


    for (
        const candidate of
        eligibleCandidates
    ) {

        let matchedGroup:
            EquivalentLayerGroup |
            undefined;

        let bestConfidence =
            0;

        let bestReasons:
            string[] = [];


        // ---------------------------------------------------------------------
        // Find strongest matching group
        // ---------------------------------------------------------------------

        for (
            const group of groups
        ) {

            for (
                const existing of
                group.candidates
            ) {

                const comparison =
                    compareCandidates(

                        candidate,

                        existing,

                        threshold
                    );

                if (

                    comparison.equivalent &&

                    comparison.confidence >
                    bestConfidence
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

        if (
            matchedGroup
        ) {

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

        const newGroup:
            EquivalentLayerGroup = {

            id:
                createGroupId([
                    candidate
                ]),

            candidates: [
                candidate
            ],

            confidence:
                1,

            reasons: [
                "initial candidate group"
            ]
        };

        groups.push(
            newGroup
        );
    }


    // -------------------------------------------------------------------------
    // Rebuild deterministic group IDs after membership is finalized
    // -------------------------------------------------------------------------

    for (
        const group of groups
    ) {

        group.id =
            createGroupId(
                group.candidates
            );
    }


    return groups;
}


// =============================================================================
// Compatibility aliases
// =============================================================================

/**
 * Backwards-compatible alias.
 *
 * New code should use detectEquivalentLayers().
 */
export const groupEquivalentCandidates =
    detectEquivalentLayers;