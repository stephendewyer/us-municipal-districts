import type {
    CandidateScore,
    CanonicalAlternative,
    CanonicalSource,
    DistrictType,
    InspectedCandidate,
    EquivalentLayerGroup,
    RegistryEntry
} from "./types.js";


// =============================================================================
// Candidate scoring
// =============================================================================

export function scoreCandidate(
    candidate: InspectedCandidate
): CandidateScore {

    const inspection = candidate.inspection;
    const classification = candidate.classification;

    let score = 0;
    const reasons: string[] = [];


    // -------------------------------------------------------------------------
    // Official municipal source
    // -------------------------------------------------------------------------

    if (classification.officialMunicipalSource) {
        score += 30;
        reasons.push("official municipal source");
    }


    // -------------------------------------------------------------------------
    // Political boundary
    // -------------------------------------------------------------------------

    if (classification.isPoliticalBoundary) {
        score += 50;
        reasons.push("political boundary");
    }


    // -------------------------------------------------------------------------
    // Actual boundary layer
    // -------------------------------------------------------------------------

    if (classification.isBoundaryLayer) {
        score += 25;
        reasons.push("boundary layer");
    }


    // -------------------------------------------------------------------------
    // Reject thematic datasets
    // -------------------------------------------------------------------------

    if (classification.isThematicDataset) {
        score -= 50;
        reasons.push("thematic dataset");
    }


    // -------------------------------------------------------------------------
    // Reject Census datasets
    // -------------------------------------------------------------------------

    if (classification.isCensusDataset) {
        score -= 50;
        reasons.push("Census dataset");
    }


    // -------------------------------------------------------------------------
    // Polygon
    // -------------------------------------------------------------------------

    if (
        inspection.geometryType ===
            "esriGeometryPolygon" ||
        inspection.geometryType === "polygon"
    ) {
        score += 20;
        reasons.push("polygon geometry");
    }
    else {
        score -= 30;
        reasons.push("non-polygon geometry");
    }


    // -------------------------------------------------------------------------
    // District type
    // -------------------------------------------------------------------------

    if (classification.districtType) {
        score += 20;

        reasons.push(
            `identified as ${classification.districtType}`
        );
    }


    // -------------------------------------------------------------------------
    // District field
    // -------------------------------------------------------------------------

    if (inspection.districtField) {
        score += 20;

        reasons.push(
            `district field: ${inspection.districtField}`
        );
    }


    // -------------------------------------------------------------------------
    // Name field
    // -------------------------------------------------------------------------

    if (inspection.nameField) {
        score += 10;

        reasons.push(
            `name field: ${inspection.nameField}`
        );
    }


    // -------------------------------------------------------------------------
    // Service capabilities
    // -------------------------------------------------------------------------

    if (inspection.supportsQuery) {
        score += 5;
        reasons.push("supports querying");
    }

    if (inspection.supportsGeoJSON) {
        score += 5;
        reasons.push("supports GeoJSON");
    }

    if (inspection.supportsPagination) {
        score += 3;
        reasons.push("supports pagination");
    }


    // -------------------------------------------------------------------------
    // FeatureServer preference
    // -------------------------------------------------------------------------

    if (
        inspection.serviceType ===
        "FeatureServer"
    ) {
        score += 5;
        reasons.push("FeatureServer");
    }


    // -------------------------------------------------------------------------
    // Title
    // -------------------------------------------------------------------------

    const title =
        (
            inspection.title ??
            inspection.layerName ??
            inspection.serviceName ??
            ""
        ).toLowerCase();


    if (
        /\bward(s)?\b/.test(title) ||
        /\bcouncil\b/.test(title) ||
        /\bdistrict(s)?\b/.test(title)
    ) {
        score += 15;
        reasons.push(
            "title contains political district terminology"
        );
    }


    // -------------------------------------------------------------------------
    // Field names
    // -------------------------------------------------------------------------

    const districtFields =
        inspection.districtFields
            .map(field => field.toLowerCase());


    if (
        districtFields.some(field =>
            /ward|council|district|alderman/.test(field)
        )
    ) {
        score += 10;
        reasons.push(
            "field names strongly indicate political district"
        );
    }


    return {
        candidate,
        score,
        reasons
    };
}


// =============================================================================
// Rank candidates
// =============================================================================

export function rankCandidates(
    candidates: InspectedCandidate[]
): CandidateScore[] {

    return candidates
        .map(scoreCandidate)
        .sort((a, b) => b.score - a.score);
}


// =============================================================================
// Canonical source
// =============================================================================

export function selectCanonicalSource(
    group: EquivalentLayerGroup
): CanonicalSource | undefined {

    if (group.candidates.length === 0) {
        return undefined;
    }


    const ranked =
        rankCandidates(group.candidates);


    const best =
        ranked[0];


    if (!best) {
        return undefined;
    }


    const candidate =
        best.candidate;


    const inspection =
        candidate.inspection;

    const classification =
        candidate.classification;


    if (
        !inspection.districtField ||
        !classification.districtType ||
        !inspection.geometryType
    ) {
        return undefined;
    }


    const alternatives: CanonicalAlternative[] =
        ranked
            .slice(1)
            .map(item => ({
                url: item.candidate.inspection.url,

                title:
                    item.candidate.inspection.title ??
                    item.candidate.inspection.layerName ??
                    item.candidate.inspection.serviceName,

                serviceType:
                    item.candidate.inspection.serviceType,

                officialMunicipalSource:
                    item.candidate.classification
                        .officialMunicipalSource,

                score: item.score
            }));


    /*
     * Require a meaningful lead before automatically
     * selecting a canonical source.
     */
    const second =
        ranked[1];

    const scoreGap =
        second
            ? best.score - second.score
            : best.score;


    const requiresReview =
        group.confidence < 0.8 ||
        scoreGap < 10;


    return {
        url: inspection.url,

        title:
            inspection.title ??
            inspection.layerName ??
            inspection.serviceName ??
            `${candidate.candidate.city} ${classification.districtType}`,

        city: candidate.candidate.city,

        state: candidate.candidate.state,

        placeFips: candidate.candidate.placeFips,

        districtType:
            classification.districtType,

        serviceType:
            inspection.serviceType,

        officialMunicipalSource:
            classification.officialMunicipalSource,

        districtField:
            inspection.districtField,

        nameField:
            inspection.nameField,

        geometryType:
            inspection.geometryType,

        score:
            best.score,

        alternatives,

        selectionReasons:
            best.reasons,

        requiresReview
    };
}