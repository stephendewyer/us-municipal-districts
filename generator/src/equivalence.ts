import type {
    DiscoveryCandidate,
    DistrictType,
    EquivalentLayerGroup,
    ExpectedDistrictCount,
    InspectedCandidate,
    LayerFingerprint
} from "./types.js";

// =============================================================================
// Expected district counts
// =============================================================================

interface DistrictCountEntry {
    city: string;
    state: string;
    districtType: DistrictType;
    expected: ExpectedDistrictCount;
}

const EXPECTED_DISTRICT_COUNTS: DistrictCountEntry[] = [
    {
        city: "phoenix",
        state: "az",
        districtType: "council-district",
        expected: {
            count: 8,
            source: "municipal-source",
            confidence: 100
        }
    },
    {
        city: "phoenix",
        state: "az",
        districtType: "city-council-district",
        expected: {
            count: 8,
            source: "municipal-source",
            confidence: 100
        }
    },
    {
        city: "tucson",
        state: "az",
        districtType: "ward",
        expected: {
            count: 6,
            source: "municipal-source",
            confidence: 100
        }
    }
];

// =============================================================================
// Helpers
// =============================================================================

function normalize(
    value: string | undefined
): string {
    return (value ?? "")
        .replace(
            /([a-z])([A-Z])/g,
            "$1 $2"
        )
        .replace(
            /([a-zA-Z])(\d+)/g,
            "$1 $2"
        )
        .replace(
            /[_-]+/g,
            " "
        )
        .replace(
            /\s+/g,
            " "
        )
        .toLowerCase()
        .trim();
}

function escapeRegex(
    value: string
): string {
    return value.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );
}

function normalizeTemporalName(
    value?: string,
    candidate?: InspectedCandidate
): string | undefined {
    const normalized =
        normalize(value);

    if (!normalized) {
        return undefined;
    }

    let result =
        normalized
            .replace(
                /[\(\[\{]?\b(?:19|20)\d{2}\b[\)\]\}]?/g,
                ""
            );

    // Remove municipality identity because municipalityKey()
    // already provides the hard municipality constraint.
    if (candidate) {
        const city =
            normalize(
                candidate.candidate.city
            );

        if (city) {
            result =
                result.replace(
                    new RegExp(
                        `\\b${escapeRegex(city)}\\b`,
                        "gi"
                    ),
                    ""
                );
            }
        }

    return result
        .replace(
            /\b(city|town|village|municipality)\s+of\b/g,
            ""
        )
        .replace(
            /\b(city|town|village)\b/g,
            ""
        )
        .replace(
            /\s+/g,
            " "
        )
        .trim() || undefined;
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

function normalizeList(
    values: string[] | undefined
): string[] {
    return unique(
        (values ?? [])
            .map(normalize)
            .filter(Boolean)
    ).sort();
}

function getDistinctDistrictValues(
    candidate: InspectedCandidate
): string[] {
    const inspectionValues =
        normalizeList(
            candidate.inspection.distinctDistrictValues
        );

    if (
        inspectionValues.length > 0
    ) {
        return inspectionValues;
    }

    return normalizeList(
        candidate.validation?.distinctDistrictValues
    );
}

function jaccardSimilarity(
    left: string[],
    right: string[]
): number {
    const a = new Set(left);
    const b = new Set(right);

    if (
        a.size === 0 &&
        b.size === 0
    ) {
        return 1;
    }

    if (
        a.size === 0 ||
        b.size === 0
    ) {
        return 0;
    }

    const intersection =
        [...a].filter(
            value => b.has(value)
        ).length;

    const union =
        new Set([
            ...a,
            ...b
        ]).size;

    return union === 0
        ? 0
        : intersection / union;
}

function districtValueSimilarity(
    a: InspectedCandidate,
    b: InspectedCandidate
): number {
    return jaccardSimilarity(
        getDistinctDistrictValues(a),
        getDistinctDistrictValues(b)
    );
}

function stringSimilarity(
    left: string | undefined,
    right: string | undefined
): number {
    const a = normalize(left);
    const b = normalize(right);

    if (!a && !b) {
        return 1;
    }

    if (!a || !b) {
        return 0;
    }

    if (a === b) {
        return 1;
    }

    /*
     * Token-based similarity is intentionally simple and deterministic.
     */
    const aTokens =
        a.split(" ").filter(Boolean);

    const bTokens =
        b.split(" ").filter(Boolean);

    return jaccardSimilarity(
        aTokens,
        bTokens
    );
}

function isPolygon(
    candidate: InspectedCandidate
): boolean {
    const geometry =
        normalize(
            candidate.inspection.geometryType
        );

    return (
        geometry === "polygon" ||
        geometry === "esri geometry polygon"
    );
}

function municipalityKey(
    candidate: InspectedCandidate
): string {
    return [
        normalize(candidate.candidate.city),
        normalize(candidate.candidate.state),
        candidate.candidate.placeFips ?? ""
    ].join("|");
}

function districtTypeKey(
    candidate: InspectedCandidate
): string {
    return normalize(
        candidate.classification.districtType
    );
}

function getFieldNames(
    candidate: InspectedCandidate
): string[] {
    return normalizeList(
        (candidate.inspection.fields ?? [])
            .map(field => field.name)
    );
}

function getDistrictFields(
    candidate: InspectedCandidate
): string[] {
    return normalizeList([
        ...(candidate.inspection.districtFields ?? []),
        candidate.inspection.districtField ?? "",
        ...(candidate.validation?.districtField
            ? [candidate.validation.districtField]
            : [])
    ]);
}

function getNameFields(
    candidate: InspectedCandidate
): string[] {
    return normalizeList([
        ...(candidate.inspection.nameFields ?? []),
        candidate.inspection.nameField ?? ""
    ]);
}

function stripYear(
    value: string
): string {
    return value
        .replace(
            /\b(?:19|20)\d{2}\b/g,
            ""
        )
        .replace(
            /\s+/g,
            " "
        )
        .trim();
}

function datasetIdentity(
    candidate: InspectedCandidate
): string {
    return stripYear(
        normalize(
            [
                candidate.inspection.title,
                candidate.candidate.title,
                candidate.inspection.serviceName,
                candidate.inspection.layerName
            ]
                .filter(Boolean)
                .join(" ")
        )
    );
}

function serviceIdentity(
    candidate: InspectedCandidate
): string {
    return normalize(
        candidate.inspection.serviceName
    );
}

function layerIdentity(
    candidate: InspectedCandidate
): string {
    return normalize(
        candidate.inspection.layerName ??
        candidate.inspection.title
    );
}

function districtFieldIdentity(
    candidate: InspectedCandidate
): string {
    return normalize(
        candidate.inspection.districtField ??
        candidate.validation?.districtField
    );
}

function nameFieldIdentity(
    candidate: InspectedCandidate
): string {
    return normalize(
        candidate.inspection.nameField
    );
}

function temporalFamily(
    candidate: InspectedCandidate
): string {
    const familyName =
        normalizeTemporalName(
            candidate.inspection.title ??
            candidate.candidate.title ??
            candidate.inspection.layerName,
            candidate
        ) ?? "";

    return [
        municipalityKey(candidate),
        districtTypeKey(candidate),
        familyName
    ].join("|");
}

// =============================================================================
// Expected district count
// =============================================================================

export function getExpectedDistrictCount(
    candidate: DiscoveryCandidate,
    districtType: DistrictType | undefined
): ExpectedDistrictCount | undefined {
    if (!districtType) {
        return undefined;
    }

    const city =
        normalize(candidate.city);

    const state =
        normalize(candidate.state);

    if (!city || !state) {
        return undefined;
    }

    const entry =
        EXPECTED_DISTRICT_COUNTS.find(
            item =>
                item.city === city &&
                item.state === state &&
                item.districtType === districtType
        );

    if (!entry) {
        return undefined;
    }

    return {
        ...entry.expected
    };
}

// =============================================================================
// Layer fingerprint
// =============================================================================

/**
 * Create a normalized structural fingerprint for an inspected candidate.
 *
 * The fingerprint intentionally excludes:
 *
 * - URL
 * - item ID
 * - place-specific search metadata
 *
 * Those values identify a resource, but do not establish whether two
 * layers represent the same underlying dataset.
 */
export function createLayerFingerprint(
    candidate: InspectedCandidate
): LayerFingerprint {
    return {
        title:
            candidate.inspection.title ??
            candidate.candidate.title,

        serviceName:
            candidate.inspection.serviceName,

        layerName:
            candidate.inspection.layerName,

        geometryType:
            candidate.inspection.geometryType,

        fields:
            getFieldNames(candidate),

        districtFields:
            getDistrictFields(candidate),

        nameFields:
            getNameFields(candidate),

        featureCount:
            candidate.inspection.featureCount
    };
}

// =============================================================================
// Candidate comparison
// =============================================================================

export interface CandidateComparison {
    equivalent: boolean;
    confidence: number;
    reasons: string[];
}

/**
 * Compare two inspected candidates for structural equivalence.
 *
 * The comparison is deliberately independent of:
 *
 * - ArcGIS URL
 * - ArcGIS item ID
 * - temporal status
 *
 * This allows current and historical versions of the same municipal
 * boundary dataset to be grouped together.
 */

export function compareCandidates(
    a: InspectedCandidate,
    b: InspectedCandidate,
    threshold = 0.60
): CandidateComparison {
    const reasons: string[] = [];

    // =========================================================================
    // Hard exclusions
    // =========================================================================

    if (
        a.classification.rejected ||
        b.classification.rejected
    ) {
        return {
            equivalent: false,
            confidence: 0,
            reasons: [
                "rejected candidate"
            ]
        };
    }

    if (
        !a.classification.isPoliticalBoundary ||
        !b.classification.isPoliticalBoundary
    ) {
        return {
            equivalent: false,
            confidence: 0,
            reasons: [
                "non-political candidate"
            ]
        };
    }

    if (
        a.classification.sourceRole === "derived" ||
        b.classification.sourceRole === "derived"
    ) {
        return {
            equivalent: false,
            confidence: 0,
            reasons: [
                "derived dataset excluded from equivalence"
            ]
        };
    }

    if (
        municipalityKey(a) !==
        municipalityKey(b)
    ) {
        return {
            equivalent: false,
            confidence: 0,
            reasons: [
                "different municipalities"
            ]
        };
    }

    if (
        districtTypeKey(a) !==
        districtTypeKey(b)
    ) {
        return {
            equivalent: false,
            confidence: 0,
            reasons: [
                "different political district types"
            ]
        };
    }

    if (
        !isPolygon(a) ||
        !isPolygon(b)
    ) {
        return {
            equivalent: false,
            confidence: 0,
            reasons: [
                "different geometry types"
            ]
        };
    }

    // =========================================================================
    // Fingerprints
    // =========================================================================

    const fingerprintA =
        createLayerFingerprint(a);

    const fingerprintB =
        createLayerFingerprint(b);

    // =========================================================================
    // Identity similarity
    // =========================================================================

    const identityA =
        datasetIdentity(a);

    const identityB =
        datasetIdentity(b);

    const identitySimilarity =
        stringSimilarity(
            identityA,
            identityB
        );

    if (identitySimilarity >= 0.90) {
        reasons.push(
            "strong dataset identity match"
        );
    } else if (
        identitySimilarity >= 0.70
    ) {
        reasons.push(
            "dataset identity match"
        );
    }

    // =========================================================================
    // Service similarity
    // =========================================================================

    const serviceSimilarity =
        stringSimilarity(
            serviceIdentity(a),
            serviceIdentity(b)
        );

    if (serviceSimilarity >= 0.90) {
        reasons.push(
            "same service identity"
        );
    } else if (
        serviceSimilarity >= 0.70
    ) {
        reasons.push(
            "similar service identity"
        );
    }

    // =========================================================================
    // Layer similarity
    // =========================================================================

    const layerSimilarity =
        stringSimilarity(
            layerIdentity(a),
            layerIdentity(b)
        );

    if (layerSimilarity >= 0.90) {
        reasons.push(
            "same layer identity"
        );
    } else if (
        layerSimilarity >= 0.70
    ) {
        reasons.push(
            "similar layer identity"
        );
    }

    // =========================================================================
    // Temporal dataset family similarity
    // =========================================================================

    /*
     * Compare the dataset titles after removing explicit year tokens.
     *
     * This allows:
     *
     *     Chicago Wards (2015)
     *
     * and:
     *
     *     Chicago Wards
     *
     * to be recognized as the same underlying dataset family.
     *
     * Temporal status itself is intentionally NOT used as an exclusion.
     */
    const temporalTitleA =
        normalizeTemporalName(
            a.inspection.title ??
            a.candidate.title ??
            a.inspection.layerName,
            a
        );

    const temporalTitleB =
        normalizeTemporalName(
            b.inspection.title ??
            b.candidate.title ??
            b.inspection.layerName,
            b
        );

    const temporalTitles =
        stringSimilarity(
            temporalTitleA ?? "",
            temporalTitleB ?? ""
        );

    if (
        temporalTitles >= 0.90
    ) {
        reasons.push(
            "strong temporal dataset family match"
        );
    } else if (
        temporalTitles >= 0.70
    ) {
        reasons.push(
            "temporal dataset family match"
        );
    }

    // =========================================================================
    // Field similarity
    // =========================================================================

    const fieldSimilarity =
        jaccardSimilarity(
            fingerprintA.fields,
            fingerprintB.fields
        );

    const districtFieldSimilarity =
        jaccardSimilarity(
            fingerprintA.districtFields,
            fingerprintB.districtFields
        );

    const nameFieldSimilarity =
        jaccardSimilarity(
            fingerprintA.nameFields,
            fingerprintB.nameFields
        );

    if (
        fieldSimilarity >= 0.75
    ) {
        reasons.push(
            "strong field structure match"
        );
    } else if (
        fieldSimilarity >= 0.50
    ) {
        reasons.push(
            "similar field structure"
        );
    }

    if (
        districtFieldSimilarity >= 0.75
    ) {
        reasons.push(
            "same district field structure"
        );
    }

    if (
        nameFieldSimilarity >= 0.75
    ) {
        reasons.push(
            "same name field structure"
        );
    }

    const districtValueSimilarityScore =
        districtValueSimilarity(
            a,
            b
        );

    if (
        districtValueSimilarityScore >= 0.95
    ) {
        reasons.push(
            "same district value signature"
        );
    } else if (
        districtValueSimilarityScore >= 0.75
    ) {
        reasons.push(
            "similar district value signature"
        );
    }

    // =========================================================================
    // Individual field identities
    // =========================================================================

    const districtFieldA =
        districtFieldIdentity(a);

    const districtFieldB =
        districtFieldIdentity(b);

    const districtFieldIdentitySimilarity =
        stringSimilarity(
            districtFieldA,
            districtFieldB
        );

    const nameFieldA =
        nameFieldIdentity(a);

    const nameFieldB =
        nameFieldIdentity(b);

    const nameFieldIdentitySimilarity =
        stringSimilarity(
            nameFieldA,
            nameFieldB
        );

    // =========================================================================
    // Weighted confidence
    // =========================================================================

    let confidence =
        (
            identitySimilarity * 0.55
        ) +
        (
            serviceSimilarity * 0.15
        ) +
        (
            layerSimilarity * 0.10
        ) +
        (
            fieldSimilarity * 0.10
        ) +
        (
            districtFieldIdentitySimilarity * 0.05
        ) +
        (
            nameFieldIdentitySimilarity * 0.05
        );

    // =========================================================================
    // Strong structural floors
    // =========================================================================

    /*
     * Exact service identity plus compatible field structure is strong
     * evidence even when titles differ because of temporal suffixes,
     * ArcGIS naming differences, or minor title changes.
     */
    if (
        serviceSimilarity === 1 &&
        fieldSimilarity >= 0.50 &&
        districtFieldSimilarity >= 0.50
    ) {
        confidence =
            Math.max(
                confidence,
                0.70
            );

        reasons.push(
            "same service with compatible field structure"
        );
    }

    /*
     * Very strong normalized dataset identity should survive modest
     * differences in service/layer naming.
     */
    if (
        identitySimilarity >= 0.90
    ) {
        confidence =
            Math.max(
                confidence,
                0.75
            );
    }

    /*
     * Existing temporal-family floor.
     */
    if (
        temporalFamily(a) ===
        temporalFamily(b)
    ) {
        confidence =
            Math.max(
                confidence,
                0.75
            );

        reasons.push(
            "same temporal dataset family"
        );
    }

    /*
    * Matching district identifiers are strong evidence that two
    * layers represent the same municipal district system.
    *
    * This is intentionally subject to the hard requirements above:
    *
    *     - same municipality
    *     - same political district type
    *     - political boundaries
    *     - polygon geometry
    *
    * Exact district-value agreement allows different ArcGIS services,
    * titles, field names, and publishers to represent the same system.
    */
    if (
        districtValueSimilarityScore === 1 &&
        getDistinctDistrictValues(a).length >= 2 &&
        getDistinctDistrictValues(b).length >= 2
    ) {
        confidence =
            Math.max(
                confidence,
                0.70
            );

        reasons.push(
            "exact district value signature"
        );
    }

    // =========================================================================
    // Strong temporal family override
    // =========================================================================

    /*
     * Chicago-style temporal versions can legitimately have:
     *
     *     - different ArcGIS services
     *     - different layer names
     *     - different field names
     *     - different service URLs
     *     - different temporal status
     *
     * The combination of:
     *
     *     same municipality
     *     same political district type
     *     polygon geometry
     *     strong year-stripped title similarity
     *
     * is sufficient to establish equivalence.
     *
     * The municipality, district type, political-boundary, and polygon
     * checks above remain hard requirements.
     */
    if (
        temporalTitles >= 0.90 &&
        a.classification.districtType ===
            b.classification.districtType &&
        isPolygon(a) &&
        isPolygon(b)
    ) {
        confidence =
            Math.max(
                confidence,
                0.80
            );

        reasons.push(
            "strong temporal dataset family match"
        );
    }

    // =========================================================================
    // Clamp confidence
    // =========================================================================

    confidence =
        Math.max(
            0,
            Math.min(
                1,
                confidence
            )
        );

    // =========================================================================
    // Return
    // =========================================================================

    return {
        equivalent:
            confidence >= threshold,

        confidence,

        reasons:
            unique(reasons)
    };
}

// =============================================================================
// Grouping
// =============================================================================

interface CandidateGroup {
    candidates: InspectedCandidate[];
    confidence: number;
    reasons: string[];
}

/**
 * Group equivalent candidates.
 *
 * This function is retained as a public compatibility API for dedupe.ts.
 */

export function groupEquivalentCandidates(
    candidates: InspectedCandidate[],
    threshold = 0.60
): EquivalentLayerGroup[] {
    const eligible = candidates.filter(
        candidate =>
            !candidate.classification.rejected &&
            candidate.classification.isPoliticalBoundary &&
            candidate.classification.isBoundaryLayer &&
            candidate.classification.sourceRole !== "derived" &&
            isPolygon(candidate)
    );

    if (eligible.length === 0) {
        return [];
    }

    const sorted = [...eligible].sort(
        (a, b) =>
            candidateSortKey(a).localeCompare(
                candidateSortKey(b)
            )
    );

    const parent = sorted.map(
        (_, index) => index
    );

    function find(index: number): number {
        let root = index;

        while (
            parent[root] !== root
        ) {
            root = parent[root];
        }

        while (
            parent[index] !== index
        ) {
            const next = parent[index];
            parent[index] = root;
            index = next;
        }

        return root;
    }

    function union(
        left: number,
        right: number
    ): boolean {
        const leftRoot = find(left);
        const rightRoot = find(right);

        if (
            leftRoot === rightRoot
        ) {
            return false;
        }

        if (
            leftRoot < rightRoot
        ) {
            parent[rightRoot] = leftRoot;
        } else {
            parent[leftRoot] = rightRoot;
        }

        return true;
    }

    /*
     * These are the equivalence edges that actually connected
     * candidates into a union-find component.
     *
     * Because only successful union() operations are recorded,
     * these edges form a spanning forest. The confidence of a
     * group is therefore based only on evidence that was actually
     * required to connect its candidates.
     */
    const acceptedEdges:
        Array<{
            left: number;
            right: number;
            comparison: CandidateComparison;
        }> = [];

    for (
        let i = 0;
        i < sorted.length;
        i++
    ) {
        for (
            let j = i + 1;
            j < sorted.length;
            j++
        ) {
            const comparison =
                compareCandidates(
                    sorted[i],
                    sorted[j],
                    threshold
                );

            if (
                comparison.equivalent &&
                union(i, j)
            ) {
                acceptedEdges.push({
                    left: i,
                    right: j,
                    comparison
                });
            }
        }
    }

    const groups =
        new Map<
            number,
            CandidateGroup
        >();

    for (
        let index = 0;
        index < sorted.length;
        index++
    ) {
        const root =
            find(index);

        const group =
            groups.get(root);

        if (
            group
        ) {
            group.candidates.push(
                sorted[index]
            );
        } else {
            groups.set(
                root,
                {
                    candidates: [
                        sorted[index]
                    ],
                    confidence: 1,
                    reasons: []
                }
            );
        }
    }

    const result:
        EquivalentLayerGroup[] =
        [...groups.values()]
            .map(
                group => {
                    const reasons =
                        new Set<string>();

                    let minimumConfidence =
                        1;

                    /*
                     * Map the candidates in this component back to
                     * their sorted indices.
                     */
                    const memberIndices =
                        new Set(
                            group.candidates.map(
                                candidate =>
                                    sorted.indexOf(
                                        candidate
                                    )
                            )
                        );

                    /*
                     * Group confidence is the weakest confidence
                     * among the edges that actually connected this
                     * component.
                     *
                     * We deliberately do NOT inspect every possible
                     * candidate pair here. Two candidates can have
                     * low pairwise similarity while still belonging
                     * to the same equivalence group through a valid
                     * chain of stronger equivalence relationships.
                     */
                    const groupEdges =
                        acceptedEdges.filter(
                            edge =>
                                memberIndices.has(
                                    edge.left
                                ) &&
                                memberIndices.has(
                                    edge.right
                                )
                        );

                    if (
                        groupEdges.length > 0
                    ) {
                        for (
                            const edge of
                            groupEdges
                        ) {
                            minimumConfidence =
                                Math.min(
                                    minimumConfidence,
                                    edge
                                        .comparison
                                        .confidence
                                );

                            for (
                                const reason of
                                edge
                                    .comparison
                                    .reasons
                            ) {
                                reasons.add(
                                    reason
                                );
                            }
                        }
                    }

                    /*
                     * A singleton does not require any equivalence
                     * evidence because it is already its own group.
                     */
                    if (
                        group.candidates.length ===
                        1
                    ) {
                        minimumConfidence = 1;

                        reasons.add(
                            "single eligible candidate"
                        );
                    }

                    return {
                        id:
                            createGroupId(
                                group.candidates
                            ),

                        candidates:
                            group.candidates,

                        confidence:
                            minimumConfidence,

                        reasons:
                            [...reasons]
                    };
                }
            );

    return result.sort(
        (a, b) =>
            a.id.localeCompare(
                b.id
            )
    );
}


/**
 * Primary equivalence-grouping API.
 *
 * Kept separate from groupEquivalentCandidates() because this is the
 * API used by pipeline.ts.
 */
export function detectEquivalentLayers(
    candidates: InspectedCandidate[],
    threshold = 0.60
): EquivalentLayerGroup[] {
    return groupEquivalentCandidates(
        candidates,
        threshold
    );
}

// =============================================================================
// Deterministic identifiers
// =============================================================================

function candidateSortKey(
    candidate: InspectedCandidate
): string {
    return [
        municipalityKey(candidate),
        districtTypeKey(candidate),
        datasetIdentity(candidate),
        serviceIdentity(candidate),
        layerIdentity(candidate),
        districtFieldIdentity(candidate),
        nameFieldIdentity(candidate),
        normalize(candidate.candidate.url),
        normalize(candidate.inspection.url)
    ].join("|");
}

function createGroupId(
    candidates: InspectedCandidate[]
): string {
    const identity =
        [...candidates]
            .sort(
                (a, b) =>
                    candidateSortKey(a)
                        .localeCompare(
                            candidateSortKey(b)
                        )
            )
            .map(
                candidate =>
                    candidateSortKey(candidate)
            )
            .join("||");

    return `equivalent-${hashString(identity)}`;
}

function hashString(
    value: string
): string {
    /*
     * Small deterministic non-cryptographic hash.
     *
     * Group IDs only need to be stable; they do not provide security.
     */
    let hash = 2166136261;

    for (
        let index = 0;
        index < value.length;
        index++
    ) {
        hash ^=
            value.charCodeAt(index);

        hash =
            Math.imul(
                hash,
                16777619
            );
    }

    return (
        hash >>> 0
    )
        .toString(16)
        .padStart(8, "0");
}