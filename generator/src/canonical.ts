import type {
    ArcGISField,
    CanonicalAlternative,
    CanonicalSource,
    CandidateScore,
    DistrictType,
    EquivalentLayerGroup
} from "./types.js";

import {
    scoreCandidate,
    compareCandidateScores
} from "./rank.js";

import {
    validateTemporal
} from "./temporalValidation.js";


// =============================================================================
// Helpers
// =============================================================================

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

function temporalPriority(
    candidate: EquivalentLayerGroup["candidates"][number]
): number {

    const temporal =
        validateTemporal(
            candidate.inspection
        );

    switch (
        temporal.status
    ) {

        case "current":
            return 3;

        case "undated":
            return 2;

        case "historical":
            return 1;

        default:
            return 0;
    }
}


// =============================================================================
// Political field detection
// =============================================================================

function isPoliticalField(
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
        ) ||
        /\bdistrict\s*(?:no|number|num|id)?\b/.test(
            normalized
        )
    );
}


// =============================================================================
// District type field scoring
// =============================================================================

/**
 * Score how strongly a field name/alias suggests that it contains
 * the actual political district identifier.
 *
 * This is deliberately based on the field itself rather than only
 * the dataset title.
 *
 * Examples:
 *
 *   WARD
 *   WARD_ID
 *   COUNCIL_DISTRICT
 *   DISTRICT
 *   DISTRICT_ID
 *
 * Higher scores are stronger.
 */
function districtFieldScore(
    field: ArcGISField,
    districtType?: DistrictType
): number {

    const name =
        normalizeField(
            field.name
        );

    const alias =
        normalizeField(
            field.alias
        );

    const combined =
        `${name} ${alias}`;


    let score = 0;


    // -------------------------------------------------------------------------
    // Exact district-type matches
    // -------------------------------------------------------------------------

    if (
        districtType === "ward"
    ) {

        if (
            /^ward$/.test(
                name
            )
        ) {
            score += 100;
        }

        if (
            /^ward\s*(id|no|number|num)$/.test(
                name
            )
        ) {
            score += 90;
        }

        if (
            /\bward\b/.test(
                combined
            )
        ) {
            score += 50;
        }
    }


    if (
        districtType === "council-district"
    ) {

        if (
            /^council\s+district$/.test(
                combined
            )
        ) {
            score += 100;
        }

        if (
            /\bcouncil\b/.test(
                combined
            ) &&
            /\bdistrict\b/.test(
                combined
            )
        ) {
            score += 60;
        }

        if (
            /\bcouncil\b/.test(
                combined
            )
        ) {
            score += 30;
        }
    }


    if (
        districtType === "aldermanic-district"
    ) {

        if (
            /\balderman/.test(
                combined
            )
        ) {
            score += 100;
        }

        if (
            /\bward\b/.test(
                combined
            )
        ) {
            score += 30;
        }
    }


    if (
        districtType === "municipal-district"
    ) {

        if (
            /\bmunicipal\s+district\b/.test(
                combined
            )
        ) {
            score += 100;
        }

        if (
            /\bdistrict\b/.test(
                combined
            )
        ) {
            score += 50;
        }
    }


    // -------------------------------------------------------------------------
    // Generic political district fields
    // -------------------------------------------------------------------------

    if (
        /^district$/.test(
            name
        )
    ) {
        score += 80;
    }

    if (
        /^district\s*(id|no|number|num)$/.test(
            name
        )
    ) {
        score += 75;
    }

    if (
        /\bdistrict\s*(id|no|number|num)\b/.test(
            combined
        )
    ) {
        score += 60;
    }


    // -------------------------------------------------------------------------
    // ID fields
    // -------------------------------------------------------------------------

    if (
        /\bward\s*(id|no|number|num)\b/.test(
            combined
        )
    ) {
        score += 75;
    }

    if (
        /\bcouncil\s*(district\s*)?(id|no|number|num)\b/.test(
            combined
        )
    ) {
        score += 75;
    }


    // -------------------------------------------------------------------------
    // Common district-number variations
    // -------------------------------------------------------------------------

    if (
        /\bward\s*number\b/.test(
            combined
        )
    ) {
        score += 70;
    }

    if (
        /\bcouncil\s+district\s*number\b/.test(
            combined
        )
    ) {
        score += 70;
    }


    // -------------------------------------------------------------------------
    // Avoid obviously non-district fields
    // -------------------------------------------------------------------------

    if (
        /\bname\b/.test(
            name
        ) &&
        !/\bward\b/.test(
            combined
        ) &&
        !/\bdistrict\b/.test(
            combined
        ) &&
        !/\bcouncil\b/.test(
            combined
        )
    ) {
        score -= 30;
    }

    if (
        /\bdescription\b/.test(
            name
        )
    ) {
        score -= 50;
    }

    if (
        /\bgeometry\b/.test(
            name
        )
    ) {
        score -= 50;
    }


    return score;
}


// =============================================================================
// Canonical source bonus
// =============================================================================

/**
 * Return a moderate adjustment used ONLY when selecting the canonical
 * source.
 *
 * This does not determine whether a candidate is valid.
 *
 * Positive values favor datasets whose primary identity is the political
 * boundary itself.
 *
 * Negative values demote datasets whose political geometry is embedded
 * in a derived analytical or thematic dataset.
 *
 * IMPORTANT:
 *
 * This adjustment is intentionally much smaller than the major ranking
 * signals in rank.ts, especially temporal evidence. Therefore a current
 * versus historical distinction remains much more important than whether
 * the dataset title sounds more boundary-native.
 */
function canonicalSourceBonus(
    candidate: EquivalentLayerGroup["candidates"][number]
): number {

    const identityText =
        [
            candidate.inspection.title,
            candidate.inspection.layerName,
            candidate.inspection.serviceName,
            candidate.candidate.title
        ]
            .filter(
                (
                    value
                ): value is string =>
                    Boolean(
                        value
                    )
            )
            .map(
                value =>
                    normalizeField(
                        value
                    )
            )
            .join(" ");


    let bonus = 0;


    const boundaryNative =
        (
            /\bcouncil\s+districts?\b/.test(
                identityText
            ) &&
            !/\b(eviction|filings?|crime|incidents|complaints)\b/.test(
                identityText
            )
        ) ||
        /\bward\s+boundar(?:y|ies)\b/.test(
            identityText
        ) ||
        /\baldermanic\s+districts?\b/.test(
            identityText
        ) ||
        /\bmunicipal\s+districts?\b/.test(
            identityText
        ) ||
        /\bpolitical\s+districts?\b/.test(
            identityText
        );


    if (
        boundaryNative
    ) {
        bonus += 20;
    }


    const derived =
        /\b(eviction|filings?|crime|incidents|complaints|violations|permits|inspections|parcels|housing|population|demographics)\b/
            .test(
                identityText
            );


    if (
        derived
    ) {
        bonus -= 20;
    }


    if (
        candidate
            .classification
            .officialMunicipalSource
    ) {
        bonus += 5;
    }


    return bonus;
}


// =============================================================================
// Find district field
// =============================================================================

function findDistrictField(
    candidate: EquivalentLayerGroup["candidates"][number]
): string | undefined {

    const districtType =
        candidate
            .classification
            .districtType;


    // -------------------------------------------------------------------------
    // 1. Inspector-selected field
    // -------------------------------------------------------------------------

    if (
        candidate.inspection.districtField
    ) {

        return (
            candidate
                .inspection
                .districtField
        );
    }


    // -------------------------------------------------------------------------
    // 2. Validation-selected field
    // -------------------------------------------------------------------------

    if (
        candidate.validation?.districtField
    ) {

        return (
            candidate
                .validation
                .districtField
        );
    }


    const fields =
        candidate.inspection.fields ?? [];


    // -------------------------------------------------------------------------
    // 3. Rank all inspected fields
    // -------------------------------------------------------------------------

    const rankedFields =
        fields
            .map(
                field => ({
                    field,
                    score:
                        districtFieldScore(
                            field,
                            districtType
                        )
                })
            )
            .filter(
                item =>
                    item.score > 0
            )
            .sort(
                (a, b) =>
                    b.score -
                    a.score
            );


    const bestField =
        rankedFields[0];


    if (
        bestField
    ) {

        return (
            bestField
                .field
                .name
        );
    }


    // -------------------------------------------------------------------------
    // 4. Existing inspector district fields
    // -------------------------------------------------------------------------

    const districtFields =
        candidate
            .inspection
            .districtFields ?? [];


    if (
        districtFields.length > 0
    ) {

        return districtFields[0];
    }


    // -------------------------------------------------------------------------
    // 5. Validation evidence
    // -------------------------------------------------------------------------

    if (
        candidate.validation
    ) {

        const validationField =
            candidate
                .validation
                .districtField;

        if (
            validationField
        ) {

            return validationField;
        }
    }


    // -------------------------------------------------------------------------
    // 6. Last-resort political field search
    // -------------------------------------------------------------------------

    const politicalField =
        fields.find(
            field =>
                isPoliticalField(
                    field.name
                ) ||
                isPoliticalField(
                    field.alias
                )
        );


    if (
        politicalField
    ) {

        return politicalField.name;
    }


    return undefined;
}


// =============================================================================
// Determine whether candidate can be canonical
// =============================================================================

function isCanonicalCandidate(
    candidate: EquivalentLayerGroup["candidates"][number]
): boolean {

    const classification =
        candidate.classification;


    // -------------------------------------------------------------------------
    // Explicitly rejected candidates can never become canonical.
    // -------------------------------------------------------------------------

    if (
        classification.rejected
    ) {
        return false;
    }


    // -------------------------------------------------------------------------
    // Must actually be classified as a political boundary.
    //
    // This is important because many municipal datasets contain fields such
    // as WARD or DISTRICT without actually being boundary datasets.
    //
    // Examples:
    //
    //   parks
    //   businesses
    //   zoning
    //   infrastructure
    //
    // These should remain rejected even if they contain a WARD field.
    // -------------------------------------------------------------------------

    if (
        !classification.isPoliticalBoundary
    ) {
        return false;
    }


    // -------------------------------------------------------------------------
    // Must be classified as a boundary layer.
    // -------------------------------------------------------------------------

    if (
        !classification.isBoundaryLayer
    ) {
        return false;
    }


    // -------------------------------------------------------------------------
    // Must have a known district type.
    // -------------------------------------------------------------------------

    if (
        !classification.districtType
    ) {
        return false;
    }


    // -------------------------------------------------------------------------
    // Canonical lookup requires polygon geometry.
    //
    // Lines and points cannot represent the complete district boundary
    // needed for point-in-polygon lookup.
    // -------------------------------------------------------------------------

    const geometry =
        candidate.inspection.geometryType;


    if (
        !geometry
    ) {
        return false;
    }


    if (
        geometry !== "polygon" &&
        geometry !== "esriGeometryPolygon"
    ) {
        return false;
    }


    // -------------------------------------------------------------------------
    // A canonical source must expose a usable district field.
    // -------------------------------------------------------------------------

    const districtField =
        findDistrictField(
            candidate
        );


    if (
        !districtField
    ) {
        return false;
    }


    return true;
}


// =============================================================================
// Select canonical source within one equivalence group
// =============================================================================

export function selectCanonicalSource(
    group: EquivalentLayerGroup
): CanonicalSource | undefined {

    if (
        group.candidates.length === 0
    ) {
        return undefined;
    }


    // -------------------------------------------------------------------------
    // Only genuine political-boundary candidates can become canonical.
    // -------------------------------------------------------------------------

    const eligibleCandidates =
        group.candidates.filter(
            isCanonicalCandidate
        );


    if (
        eligibleCandidates.length === 0
    ) {
        return undefined;
    }


    // -------------------------------------------------------------------------
    // Calculate the normal candidate scores first.
    //
    // scoreCandidate() remains the underlying scoring system.
    // -------------------------------------------------------------------------

    const ranked =
        eligibleCandidates
            .map(
                candidate => {

                    const candidateScore =
                        scoreCandidate(
                            candidate
                        );

                    return {
                        candidate,
                        candidateScore,
                        temporalPriority:
                            temporalPriority(
                                candidate
                            ),
                        canonicalBonus:
                            canonicalSourceBonus(
                                candidate
                            )
                    };
                }
            )
            .sort(
                (
                    a,
                    b
                ) => {

                    // -------------------------------------------------------------
                    // 1. Temporal status takes precedence.
                    //
                    // Current > undated > historical.
                    // -------------------------------------------------------------

                    if (
                        b.temporalPriority !==
                        a.temporalPriority
                    ) {

                        return (
                            b.temporalPriority -
                            a.temporalPriority
                        );
                    }


                    // -------------------------------------------------------------
                    // 2. Canonical-source preference.
                    //
                    // Among candidates with the same temporal status, prefer
                    // boundary-native sources.
                    // -------------------------------------------------------------

                    if (
                        b.canonicalBonus !==
                        a.canonicalBonus
                    ) {

                        return (
                            b.canonicalBonus -
                            a.canonicalBonus
                        );
                    }


                    // -------------------------------------------------------------
                    // 3. Existing candidate ranking.
                    // -------------------------------------------------------------

                    return compareCandidateScores(
                        a.candidateScore,
                        b.candidateScore
                    );
                }
            );


        const best = ranked[0];


    if (
        !best
    ) {
        return undefined;
    }


    const bestScore =
        best.candidateScore;


    if (
        bestScore.score ===
        Number.NEGATIVE_INFINITY
    ) {
        return undefined;
    }


    const candidate =
        bestScore.candidate;


    const inspection =
        candidate.inspection;


    const classification =
        candidate.classification;


    const districtField =
        findDistrictField(
            candidate
        );


    // -------------------------------------------------------------------------
    // A canonical source must have a district type and usable field.
    // -------------------------------------------------------------------------

    if (
        !classification.districtType
    ) {
        return undefined;
    }


    if (
        !districtField
    ) {

        /*
         * Do not silently create an unusable registry entry.
         *
         * The pipeline should report this group as having no canonical
         * source rather than writing a registry entry that cannot be queried.
         */
        return undefined;
    }


    // -------------------------------------------------------------------------
    // Build alternatives.
    //
    // Only candidates that survived canonical eligibility are considered
    // alternatives.
    // -------------------------------------------------------------------------

    const alternatives:
        CanonicalAlternative[] =
        ranked
            .slice(1)
            .filter(
                item =>
                    item
                        .candidateScore
                        .score !==
                    Number.NEGATIVE_INFINITY
            )
            .map(
                item => {

                    const alternative =
                        item
                            .candidateScore
                            .candidate;


                    return {

                        url:
                            alternative
                                .inspection
                                .url,

                        itemId:
                            alternative
                                .candidate
                                .itemId,

                        title:
                            alternative
                                .inspection
                                .title ??
                            alternative
                                .inspection
                                .layerName ??
                            alternative
                                .candidate
                                .title,

                        serviceType:
                            alternative
                                .inspection
                                .serviceType,

                        officialMunicipalSource:
                            alternative
                                .classification
                                .officialMunicipalSource,

                        score:
                            item
                                .candidateScore
                                .score
                    };
                }
            );


    // -------------------------------------------------------------------------
    // Manual-review determination.
    // -------------------------------------------------------------------------

    const requiresReview =
        Boolean(

            candidate
                .candidate
                .requiresReview ||

            classification
                .requiresReview ||

            (
                candidate
                    .validation
                    ?.confidence !== undefined &&
                candidate
                    .validation
                    .confidence < 0.70
            ) ||

            group.confidence < 0.75
        );


    // -------------------------------------------------------------------------
    // Selection reasons.
    // -------------------------------------------------------------------------

    const selectionReasons =
        [
            ...bestScore.reasons,

            `canonical source bonus: ${
                best.canonicalBonus >= 0
                    ? "+"
                    : ""
            }${best.canonicalBonus}`,

            `canonical candidate score: ${
                bestScore.score
            }`,

            `district type: ${
                classification.districtType
            }`,

            `district field: ${
                districtField
            }`,

            candidate.validation
                ? `validation confidence: ${
                    candidate.validation.confidence
                }`
                : "attribute validation unavailable"
        ];


    // -------------------------------------------------------------------------
    // Construct canonical source.
    // -------------------------------------------------------------------------

    return {

        url:
            inspection.url,

        itemId:
            candidate
                .candidate
                .itemId,

        title:
            inspection.title ??
            inspection.layerName ??
            inspection.serviceName ??
            candidate
                .candidate
                .title ??
            "Municipal district layer",

        city:
            candidate
                .candidate
                .city,

        state:
            candidate
                .candidate
                .state,

        placeFips:
            candidate
                .candidate
                .placeFips,

        districtType:
            classification
                .districtType,

        serviceType:
            inspection
                .serviceType,

        officialMunicipalSource:
            classification
                .officialMunicipalSource,

        districtField,

        nameField:
            inspection
                .nameField,

        geometryType:
            inspection
                .geometryType ??
            "unknown",

        // Keep the original candidate score here.
        // The canonical bonus is a selection mechanism only.
        score:
            bestScore.score,

        alternatives,

        selectionReasons,

        requiresReview
    };
}


// =============================================================================
// Select canonical source from every equivalence group
// =============================================================================

export function selectCanonicalSources(
    groups: EquivalentLayerGroup[]
): CanonicalSource[] {

    const sources:
        CanonicalSource[] = [];


    for (
        const group of groups
    ) {

        const canonical =
            selectCanonicalSource(
                group
            );


        if (
            canonical
        ) {

            sources.push(
                canonical
            );
        }
    }


    return sources;
}


// =============================================================================
// Compare canonical sources
// =============================================================================

export function compareCanonicalSources(
    a: CanonicalSource,
    b: CanonicalSource
): number {

    // -------------------------------------------------------------------------
    // Higher score first.
    // -------------------------------------------------------------------------

    if (
        b.score !==
        a.score
    ) {

        return (
            b.score -
            a.score
        );
    }


    // -------------------------------------------------------------------------
    // Prefer sources that don't require manual review.
    // -------------------------------------------------------------------------

    if (
        a.requiresReview !==
        b.requiresReview
    ) {

        return a.requiresReview
            ? 1
            : -1;
    }


    // -------------------------------------------------------------------------
    // Prefer official municipal sources.
    // -------------------------------------------------------------------------

    if (
        a.officialMunicipalSource !==
        b.officialMunicipalSource
    ) {

        return a.officialMunicipalSource
            ? -1
            : 1;
    }


    // -------------------------------------------------------------------------
    // Prefer FeatureServer over MapServer.
    // -------------------------------------------------------------------------

    if (
        a.serviceType !==
        b.serviceType
    ) {

        return a.serviceType ===
            "FeatureServer"
            ? -1
            : 1;
    }


    // -------------------------------------------------------------------------
    // Deterministic final ordering.
    // -------------------------------------------------------------------------

    return a.url.localeCompare(
        b.url
    );
}

// =============================================================================
// Select one municipality-wide canonical source
// =============================================================================

export function selectMunicipalityCanonicalSource(
    groups: EquivalentLayerGroup[]
): CanonicalSource | undefined {

    if (
        groups.length === 0
    ) {
        return undefined;
    }

    const groupWinners =
        groups
            .map(
                group => {

                    const source =
                        selectCanonicalSource(
                            group
                        );

                    if (!source) {
                        return undefined;
                    }

                    /*
                     * Recover the candidate that produced the canonical
                     * source so municipality-level selection can still use
                     * temporal priority and canonical-source preference.
                     */
                    const candidate =
                        group.candidates.find(
                            item =>
                                item.inspection.url ===
                                source.url
                        );

                    if (!candidate) {
                        return undefined;
                    }

                    return {
                        source,
                        candidate
                    };
                }
            )
            .filter(
                (
                    item
                ): item is {
                    source: CanonicalSource;
                    candidate: EquivalentLayerGroup["candidates"][number];
                } =>
                    item !== undefined
            );

    if (
        groupWinners.length === 0
    ) {
        return undefined;
    }

    groupWinners.sort(
        (
            a,
            b
        ) => {

            // ---------------------------------------------------------------------
            // 1. Prefer a boundary-native source over a derived dataset.
            //
            // The canonical source should represent the political boundary
            // itself, rather than a thematic/analytical dataset that happens
            // to contain the same boundary geometry.
            // ---------------------------------------------------------------------

            const canonicalBonusDifference =
                canonicalSourceBonus(
                    b.candidate
                ) -
                canonicalSourceBonus(
                    a.candidate
                );

            if (
                canonicalBonusDifference !== 0
            ) {
                return canonicalBonusDifference;
            }


            // ---------------------------------------------------------------------
            // 2. Among sources with the same canonical-source quality,
            // prefer current over undated over historical.
            // ---------------------------------------------------------------------

            const temporalDifference =
                temporalPriority(
                    b.candidate
                ) -
                temporalPriority(
                    a.candidate
                );

            if (
                temporalDifference !== 0
            ) {
                return temporalDifference;
            }


            // ---------------------------------------------------------------------
            // 3. Fall back to the existing canonical-source comparison.
            // ---------------------------------------------------------------------

            return compareCanonicalSources(
                a.source,
                b.source
            );
        }
    );

    return groupWinners[0]?.source;
}

