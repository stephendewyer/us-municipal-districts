// generator/src/equivalence.ts

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

    return [
        ...new Set(
            values
                .map(normalizeFieldName)
                .filter(
                    (value): value is string =>
                        Boolean(value)
                )
        )
    ].sort();
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
 * The ID is based on the first candidate's normalized layer URL.
 */
function createGroupId(
    candidate: InspectedCandidate
): string {

    const url =
        normalizeUrl(
            candidate.inspection.url ||
            candidate.candidate.url
        );

    return (
        `group-${encodeURIComponent(url)}`
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
 * Only genuine political boundary polygon layers participate in
 * equivalence detection.
 *
 * This is intentionally stricter than merely looking for fields such as
 * WARD or DISTRICT. The discovery pipeline frequently encounters thematic
 * datasets that contain political-looking fields but are not actually
 * political boundaries.
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

        classification.isPoliticalBoundary === true &&

        classification.isBoundaryLayer === true &&

        Boolean(
            classification.districtType
        ) &&

        geometry === "polygon"
    );
}


// =============================================================================
// Fingerprint
// =============================================================================

/**
 * Create a normalized structural fingerprint for a candidate.
 *
 * This is the single fingerprint implementation used by the project.
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

const IGNORED_TITLE_TOKENS =
    new Set([

        "city",
        "county",
        "town",
        "village",
        "borough",
        "municipality",

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
        "maps",
        "service",
        "services",

        "feature",
        "features",
        "server",

        "boundary",
        "boundaries",

        "district",
        "districts",

        "ward",
        "wards",

        "council"
    ]);


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
        normalize(
            a.inspection.serviceName
        );

    const serviceB =
        normalize(
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
        normalize(
            a.inspection.layerName
        );

    const layerB =
        normalize(
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
 * The comparison is intentionally conservative.
 *
 * The purpose of equivalence is not to decide whether two layers are
 * "similar." It is to decide whether two sources probably represent the
 * same political district system.
 */
export function compareCandidates(
    a: InspectedCandidate,
    b: InspectedCandidate,
    threshold = DEFAULT_EQUIVALENCE_THRESHOLD
): EquivalenceResult {

    const reasons: string[] = [];

    let score = 0;


    // -------------------------------------------------------------------------
    // Basic eligibility
    // -------------------------------------------------------------------------

    if (
        !isEligibleForEquivalence(a) ||
        !isEligibleForEquivalence(b)
    ) {

        return {

            equivalent: false,

            confidence: 0,

            reasons: [
                "one or both candidates are not eligible political boundaries"
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
        geometryA === geometryB
    ) {

        score += 0.15;

        reasons.push(
            "same geometry type"
        );

    } else {

        return {

            equivalent: false,

            confidence: score,

            reasons: [
                ...reasons,
                "different geometry types"
            ]
        };
    }


    // -------------------------------------------------------------------------
    // ArcGIS service
    // -------------------------------------------------------------------------

    const serviceMatch =
        sameService(a, b);

    if (
        serviceMatch
    ) {

        score += 0.15;

        reasons.push(
            "same ArcGIS service"
        );
    }


    // -------------------------------------------------------------------------
    // Layer name
    // -------------------------------------------------------------------------

    const layerMatch =
        sameLayerName(a, b);

    if (
        layerMatch
    ) {

        score += 0.20;

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
        titles >= 0.80
    ) {

        score += 0.15;

        reasons.push(
            `highly similar layer titles (${titles.toFixed(2)})`
        );

    } else if (
        titles >= 0.60
    ) {

        score += 0.10;

        reasons.push(
            `similar layer titles (${titles.toFixed(2)})`
        );

    } else if (
        titles >= 0.40
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

    } else if (
        fieldSimilarity >= 0.60
    ) {

        score += 0.05;

        reasons.push(
            "moderate field similarity"
        );
    }


    // -------------------------------------------------------------------------
    // Important safeguards
    // -------------------------------------------------------------------------

    /**
     * Two layers from the same ArcGIS service are not automatically
     * equivalent.
     *
     * For example:
     *
     *   FeatureServer/0 = council districts
     *   FeatureServer/1 = neighborhoods
     *
     * They may share the same service and municipality, but they represent
     * different geographic systems.
     *
     * Therefore a same-service match without either a same layer name,
     * strong title similarity, or strong field similarity is deliberately
     * capped.
     */
    if (
        serviceMatch &&
        !layerMatch &&
        titles < 0.60 &&
        districtSimilarity < 0.50 &&
        fieldSimilarity < 0.80
    ) {

        return {

            equivalent: false,

            confidence: Math.min(
                score,
                threshold - 0.01
            ),

            reasons: [
                ...reasons,
                "same service but insufficient evidence that layers represent the same district system"
            ]
        };
    }


    /**
     * Different ArcGIS services require stronger structural evidence.
     *
     * This prevents a generic "Ward" or "District" layer from one provider
     * from being merged with an unrelated "Ward" or "District" layer from
     * another provider merely because their titles happen to look similar.
     */
    if (
        !serviceMatch &&
        !layerMatch &&
        titles < 0.80 &&
        districtSimilarity < 1 &&
        fieldSimilarity < 0.80
    ) {

        return {

            equivalent: false,

            confidence: Math.min(
                score,
                threshold - 0.01
            ),

            reasons: [
                ...reasons,
                "different services require stronger structural evidence"
            ]
        };
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
 * The supplied threshold is passed into compareCandidates(), so callers
 * can tune the grouping behavior.
 *
 * Groups are built deterministically in candidate order.
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

        groups.push({

            id:
                createGroupId(
                    candidate
                ),

            candidates: [
                candidate
            ],

            confidence:
                1,

            reasons: [
                "initial candidate group"
            ]
        });
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