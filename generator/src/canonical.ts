import type {
    CanonicalAlternative,
    CanonicalSource,
    CandidateScore,
    EquivalentLayerGroup,
    InspectedCandidate
} from "./types.js";


// =============================================================================
// Candidate scoring
// =============================================================================

/**
 * Score an inspected candidate for canonical-source selection.
 *
 * Higher scores represent stronger municipal political-boundary sources.
 *
 * This function intentionally does not perform equivalence detection.
 * Equivalence detection happens separately in equivalence.ts.
 */
export function scoreCandidate(
    candidate: InspectedCandidate
): CandidateScore {

    const inspection =
        candidate.inspection;

    const classification =
        candidate.classification;

    let score = 0;

    const reasons: string[] = [];


    // -------------------------------------------------------------------------
    // Rejected candidate
    // -------------------------------------------------------------------------

    if (classification.rejected) {

        return {
            candidate,

            score:
                Number.NEGATIVE_INFINITY,

            reasons: [
                "rejected candidate"
            ]
        };
    }


    // -------------------------------------------------------------------------
    // Official municipal source
    // -------------------------------------------------------------------------

    if (
        classification.officialMunicipalSource
    ) {

        score += 100;

        reasons.push(
            "official municipal source"
        );
    }


    // -------------------------------------------------------------------------
    // Political boundary
    // -------------------------------------------------------------------------

    if (
        classification.isPoliticalBoundary
    ) {

        score += 100;

        reasons.push(
            "appears to represent a political boundary"
        );
    }


    // -------------------------------------------------------------------------
    // Boundary layer
    // -------------------------------------------------------------------------

    if (
        classification.isBoundaryLayer
    ) {

        score += 40;

        reasons.push(
            "boundary layer"
        );
    }


    // -------------------------------------------------------------------------
    // District type
    // -------------------------------------------------------------------------

    if (
        classification.districtType
    ) {

        score += 40;

        reasons.push(
            `identified as ${classification.districtType}`
        );
    }


    // -------------------------------------------------------------------------
    // Polygon geometry
    // -------------------------------------------------------------------------

    if (
        inspection.geometryType ===
            "esriGeometryPolygon" ||

        inspection.geometryType ===
            "polygon"
    ) {

        score += 30;

        reasons.push(
            "polygon geometry"
        );
    }


    // -------------------------------------------------------------------------
    // District field
    // -------------------------------------------------------------------------

    if (
        inspection.districtField
    ) {

        score += 25;

        reasons.push(
            `district field: ${inspection.districtField}`
        );
    }


    // -------------------------------------------------------------------------
    // Name field
    // -------------------------------------------------------------------------

    if (
        inspection.nameField
    ) {

        score += 10;

        reasons.push(
            `name field: ${inspection.nameField}`
        );
    }


    // -------------------------------------------------------------------------
    // FeatureServer preference
    // -------------------------------------------------------------------------

    if (
        inspection.serviceType ===
        "FeatureServer"
    ) {

        score += 10;

        reasons.push(
            "FeatureServer"
        );
    }


    // -------------------------------------------------------------------------
    // Query support
    // -------------------------------------------------------------------------

    if (
        inspection.supportsQuery
    ) {

        score += 5;

        reasons.push(
            "supports querying"
        );
    }


    // -------------------------------------------------------------------------
    // GeoJSON support
    // -------------------------------------------------------------------------

    if (
        inspection.supportsGeoJSON
    ) {

        score += 5;

        reasons.push(
            "supports GeoJSON"
        );
    }


    // -------------------------------------------------------------------------
    // Pagination
    // -------------------------------------------------------------------------

    if (
        inspection.supportsPagination
    ) {

        score += 2;

        reasons.push(
            "supports pagination"
        );
    }


    // -------------------------------------------------------------------------
    // Thematic dataset penalty
    // -------------------------------------------------------------------------

    if (
        classification.isThematicDataset
    ) {

        score -= 100;

        reasons.push(
            "thematic dataset"
        );
    }


    // -------------------------------------------------------------------------
    // Non-polygon penalty
    // -------------------------------------------------------------------------

    if (
        inspection.geometryType &&
        inspection.geometryType !==
            "esriGeometryPolygon" &&
        inspection.geometryType !==
            "polygon"
    ) {

        score -= 50;

        reasons.push(
            "non-polygon geometry"
        );
    }


    return {
        candidate,
        score,
        reasons
    };
}


// =============================================================================
// Select canonical source within an equivalence group
// =============================================================================

/**
 * Select the strongest source from one equivalence group.
 *
 * Example:
 *
 * TucsonWards2022
 * COT_wards
 *
 * may be determined to represent the same underlying ward dataset.
 *
 * This function selects the best of those equivalent sources.
 */
export function selectCanonicalSource(
    group: EquivalentLayerGroup
): CanonicalSource | undefined {

    if (
        group.candidates.length === 0
    ) {
        return undefined;
    }


    // -------------------------------------------------------------------------
    // Rank candidates
    // -------------------------------------------------------------------------

    const ranked =
        group.candidates
            .map(scoreCandidate)
            .sort(compareCandidateScores);


    const best =
        ranked[0];


    if (!best) {
        return undefined;
    }


    // -------------------------------------------------------------------------
    // Never select a rejected candidate
    // -------------------------------------------------------------------------

    if (
        best.score ===
        Number.NEGATIVE_INFINITY
    ) {

        return undefined;
    }


    const candidate =
        best.candidate;

    const inspection =
        candidate.inspection;

    const classification =
        candidate.classification;


    // -------------------------------------------------------------------------
    // Required canonical information
    // -------------------------------------------------------------------------

    if (
        !inspection.districtField ||
        !classification.districtType
    ) {

        return undefined;
    }


    // -------------------------------------------------------------------------
    // Alternatives
    // -------------------------------------------------------------------------

    const alternatives:
        CanonicalAlternative[] =

        ranked
            .slice(1)

            .filter(
                item =>
                    item.score !==
                    Number.NEGATIVE_INFINITY
            )

            .map(
                item => ({
                    url:
                        item.candidate
                            .inspection
                            .url,

                    title:
                        item.candidate
                            .inspection
                            .title,

                    serviceType:
                        item.candidate
                            .inspection
                            .serviceType,

                    officialMunicipalSource:
                        item.candidate
                            .classification
                            .officialMunicipalSource,

                    score:
                        item.score
                })
            );


    // -------------------------------------------------------------------------
    // Canonical source
    // -------------------------------------------------------------------------

    return {

        url:
            inspection.url,

        title:
            inspection.title ??
            inspection.layerName ??
            inspection.serviceName ??
            "Municipal district layer",

        city:
            candidate.candidate.city,

        state:
            candidate.candidate.state,

        placeFips:
            candidate.candidate.placeFips,

        districtType:
            classification.districtType,

        serviceType:
            inspection.serviceType,

        officialMunicipalSource:
            classification
                .officialMunicipalSource,

        districtField:
            inspection.districtField,

        nameField:
            inspection.nameField,

        geometryType:
            inspection.geometryType ??
            "unknown",

        score:
            best.score,

        alternatives,

        selectionReasons:
            best.reasons,

        requiresReview:
            Boolean(
                candidate.candidate.requiresReview ||
                classification.requiresReview ||
                group.confidence < 0.75
            )
    };
}


// =============================================================================
// Candidate score comparison
// =============================================================================

/**
 * Deterministic comparison of candidate scores.
 */
function compareCandidateScores(
    a: CandidateScore,
    b: CandidateScore
): number {

    // -------------------------------------------------------------------------
    // Highest score first
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
    // Prefer candidates that do not require review
    // -------------------------------------------------------------------------

    const aReview =
        Boolean(
            a.candidate.candidate.requiresReview ||
            a.candidate.classification.requiresReview
        );

    const bReview =
        Boolean(
            b.candidate.candidate.requiresReview ||
            b.candidate.classification.requiresReview
        );


    if (
        aReview !==
        bReview
    ) {

        return aReview
            ? 1
            : -1;
    }


    // -------------------------------------------------------------------------
    // Prefer official municipal sources
    // -------------------------------------------------------------------------

    const aOfficial =
        a.candidate
            .classification
            .officialMunicipalSource;

    const bOfficial =
        b.candidate
            .classification
            .officialMunicipalSource;


    if (
        aOfficial !==
        bOfficial
    ) {

        return aOfficial
            ? -1
            : 1;
    }


    // -------------------------------------------------------------------------
    // Prefer FeatureServer
    // -------------------------------------------------------------------------

    const aFeatureServer =
        a.candidate
            .inspection
            .serviceType ===
        "FeatureServer";

    const bFeatureServer =
        b.candidate
            .inspection
            .serviceType ===
        "FeatureServer";


    if (
        aFeatureServer !==
        bFeatureServer
    ) {

        return aFeatureServer
            ? -1
            : 1;
    }


    // -------------------------------------------------------------------------
    // Deterministic URL ordering
    // -------------------------------------------------------------------------

    return a.candidate.inspection.url
        .localeCompare(
            b.candidate.inspection.url
        );
}


// =============================================================================
// Select ONE canonical source for a municipality
// =============================================================================

/**
 * Select exactly one canonical source from all equivalence groups
 * belonging to a municipality.
 *
 * This is the function that enforces the important architectural rule:
 *
 *      one municipality → one canonical source
 */
export function selectMunicipalityCanonicalSource(
    groups: EquivalentLayerGroup[]
): CanonicalSource | undefined {

    if (
        groups.length === 0
    ) {
        return undefined;
    }


    // -------------------------------------------------------------------------
    // Select the winner from each equivalence group
    // -------------------------------------------------------------------------

    const groupWinners =
        groups
            .map(
                group =>
                    selectCanonicalSource(
                        group
                    )
            )
            .filter(
                (
                    source
                ): source is CanonicalSource =>
                    source !== undefined
            );


    if (
        groupWinners.length === 0
    ) {

        return undefined;
    }


    // -------------------------------------------------------------------------
    // Select one municipality-wide winner
    // -------------------------------------------------------------------------

    groupWinners.sort(
        compareCanonicalSources
    );


    return groupWinners[0];
}


// =============================================================================
// Municipality canonical-source comparison
// =============================================================================

/**
 * Compare canonical winners from different equivalence groups.
 *
 * Example:
 *
 * Group A → TucsonWards2022
 * Group B → some other official ward dataset
 *
 * Only one ultimately becomes the municipality's canonical source.
 */
function compareCanonicalSources(
    a: CanonicalSource,
    b: CanonicalSource
): number {

    // -------------------------------------------------------------------------
    // Highest score first
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
    // Prefer sources that do not require review
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
    // Prefer official municipal sources
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
    // Prefer FeatureServer
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
    // Deterministic fallback
    // -------------------------------------------------------------------------

    return a.url.localeCompare(
        b.url
    );
}


// =============================================================================
// Select canonical source from every equivalence group
// =============================================================================

/**
 * Select one canonical source for every equivalence group.
 *
 * This is useful for diagnostics and review.
 *
 * It does NOT enforce the one-source-per-municipality rule.
 *
 * Use selectMunicipalityCanonicalSource() for that.
 */
export function selectCanonicalSources(
    groups: EquivalentLayerGroup[]
): CanonicalSource[] {

    const sources: CanonicalSource[] = [];


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