import type {
    EquivalentLayerGroup,
    InspectedCandidate,
    LayerFingerprint
} from "./types.js";


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
        .replace(/[^a-z0-9]+/g, "")
        .trim();
}


function normalizeArray(
    values: string[] = []
): string[] {

    return values
        .map(normalize)
        .filter(
            (value): value is string =>
                Boolean(value)
        )
        .sort();
}


// =============================================================================
// Candidate eligibility
// =============================================================================

/**
 * Only genuine political boundary candidates should participate in
 * equivalence detection.
 *
 * This prevents thematic datasets such as:
 *
 *   TPRD_GOLF
 *   TPRD_EXERCISE_COURSES
 *   Tree Equity Score
 *
 * from being grouped with the actual ward boundary dataset simply
 * because they contain a WARD field.
 */

function isEligibleForEquivalence(
    candidate: InspectedCandidate
): boolean {

    const classification =
        candidate.classification;

    const geometry =
        candidate.inspection.geometryType;


    const isPolygon =
        geometry === "esriGeometryPolygon" ||
        geometry === "polygon";


    return (
        classification.isPoliticalBoundary === true &&
        classification.isBoundaryLayer === true &&
        Boolean(classification.districtType) &&
        isPolygon
    );
}

// =============================================================================
// Fingerprint
// =============================================================================

export function createLayerFingerprint(
    candidate: InspectedCandidate
): LayerFingerprint {

    const inspection =
        candidate.inspection;


    return {

        title:
            normalize(
                inspection.title
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
                    field => field.name
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
        new Set(
            [
                ...setA,
                ...setB
            ]
        ).size;


    return union === 0
        ? 0
        : intersection / union;
}


// =============================================================================
// Similarity
// =============================================================================

interface SimilarityResult {
    score: number;
    reasons: string[];
}


/**
 * Compare two political boundary fingerprints.
 *
 * The scoring intentionally gives much more importance to:
 *
 *   - district type
 *   - district fields
 *   - geometry
 *   - layer/service identity
 *
 * than to generic fields.
 */
function compareFingerprints(
    a: LayerFingerprint,
    b: LayerFingerprint
): SimilarityResult {

    let score = 0;

    const reasons: string[] = [];


    // -------------------------------------------------------------------------
    // Service name
    // -------------------------------------------------------------------------

    if (
        a.serviceName &&
        b.serviceName &&
        a.serviceName === b.serviceName
    ) {

        score += 0.25;

        reasons.push(
            "same service name"
        );
    }


    // -------------------------------------------------------------------------
    // Layer name
    // -------------------------------------------------------------------------

    if (
        a.layerName &&
        b.layerName &&
        a.layerName === b.layerName
    ) {

        score += 0.20;

        reasons.push(
            "same layer name"
        );
    }


    // -------------------------------------------------------------------------
    // Geometry
    // -------------------------------------------------------------------------

    if (
        a.geometryType &&
        b.geometryType &&
        a.geometryType === b.geometryType
    ) {

        score += 0.15;

        reasons.push(
            "same geometry type"
        );
    }


    // -------------------------------------------------------------------------
    // District fields
    // -------------------------------------------------------------------------

    const districtSimilarity =
        compareArrays(
            a.districtFields,
            b.districtFields
        );


    if (
        districtSimilarity === 1 &&
        a.districtFields.length > 0
    ) {

        score += 0.25;

        reasons.push(
            "same district fields"
        );

    } else if (
        districtSimilarity >= 0.5
    ) {

        score += 0.15;

        reasons.push(
            "similar district fields"
        );
    }


    // -------------------------------------------------------------------------
    // Name fields
    // -------------------------------------------------------------------------

    const nameSimilarity =
        compareArrays(
            a.nameFields,
            b.nameFields
        );


    if (
        nameSimilarity === 1 &&
        a.nameFields.length > 0
    ) {

        score += 0.10;

        reasons.push(
            "same name fields"
        );

    } else if (
        nameSimilarity >= 0.5
    ) {

        score += 0.05;

        reasons.push(
            "similar name fields"
        );
    }


    // -------------------------------------------------------------------------
    // All fields
    // -------------------------------------------------------------------------

    const fieldSimilarity =
        compareArrays(
            a.fields,
            b.fields
        );


    if (
        fieldSimilarity >= 0.8
    ) {

        score += 0.10;

        reasons.push(
            "high field similarity"
        );
    }


    return {
        score:
            Math.min(
                score,
                1
            ),

        reasons
    };
}


// =============================================================================
// Grouping
// =============================================================================

export function detectEquivalentLayers(
    candidates: InspectedCandidate[],
    threshold = 0.60
): EquivalentLayerGroup[] {

    /*
     * Only compare candidates that classification has identified as actual
     * political boundary datasets.
     */
    const eligibleCandidates =
        candidates.filter(
            isEligibleForEquivalence
        );


    const groups:
        EquivalentLayerGroup[] = [];


    const fingerprints =
        new Map<
            InspectedCandidate,
            LayerFingerprint
        >();


    for (
        const candidate of eligibleCandidates
    ) {

        fingerprints.set(
            candidate,
            createLayerFingerprint(
                candidate
            )
        );
    }


    // -------------------------------------------------------------------------
    // Group candidates
    // -------------------------------------------------------------------------

    for (
        const candidate of eligibleCandidates
    ) {

        let matchedGroup:
            EquivalentLayerGroup | undefined;


        for (
            const group of groups
        ) {

            const representative =
                group.candidates[0];


            if (
                !representative
            ) {
                continue;
            }


            const candidateFingerprint =
                fingerprints.get(
                    candidate
                );


            const representativeFingerprint =
                fingerprints.get(
                    representative
                );


            if (
                !candidateFingerprint ||
                !representativeFingerprint
            ) {

                continue;
            }


            const similarity =
                compareFingerprints(
                    candidateFingerprint,
                    representativeFingerprint
                );


            if (
                similarity.score >=
                threshold
            ) {

                matchedGroup =
                    group;


                group.candidates.push(
                    candidate
                );


                group.confidence =
                    Math.max(
                        group.confidence,
                        similarity.score
                    );


                for (
                    const reason of
                    similarity.reasons
                ) {

                    if (
                        !group.reasons.includes(
                            reason
                        )
                    ) {

                        group.reasons.push(
                            reason
                        );
                    }
                }


                break;
            }
        }


        // ---------------------------------------------------------------------
        // No existing equivalent group
        // ---------------------------------------------------------------------

        if (
            !matchedGroup
        ) {

            groups.push({

                candidates: [
                    candidate
                ],

                confidence:
                    1,

                reasons: [
                    "initial candidate"
                ]
            });
        }
    }


    return groups;
}
