// =============================================================================
// Types
// =============================================================================

export interface ScoreCandidateInput {
    placeFips: string;

    city: string;

    state: string;

    title?: string;

    url: string;

    serviceType?:
        | "FeatureServer"
        | "MapServer"
        | "unknown";

    geometryType?: string;

    fields?: string[];

    hasDistrictField?: boolean;

    hasNameField?: boolean;

    isFeatureServer?: boolean;

    isMapServer?: boolean;

    isPolygonLayer?: boolean;

    isLikelyBoundaryLayer?: boolean;

    isHousingDataset?: boolean;

    isCensusDataset?: boolean;

    isThematicDataset?: boolean;

    isOfficial?: boolean;
}


export interface CandidateScore {
    score: number;

    reasons: string[];
}


// =============================================================================
// Public API
// =============================================================================

export function scoreCandidate(
    candidate: ScoreCandidateInput
): CandidateScore {

    let score = 0;

    const reasons: string[] = [];

    const title =
        normalize(candidate.title);


    // -------------------------------------------------------------------------
    // Strong positive signals
    // -------------------------------------------------------------------------

    if (
        candidate.isLikelyBoundaryLayer
    ) {
        score += 25;

        reasons.push(
            "likely political boundary layer"
        );
    }


    if (
        candidate.isPolygonLayer
    ) {
        score += 20;

        reasons.push(
            "polygon geometry"
        );
    }


    if (
        candidate.hasDistrictField
    ) {
        score += 20;

        reasons.push(
            "district/ward field detected"
        );
    }


    if (
        candidate.hasNameField
    ) {
        score += 10;

        reasons.push(
            "district/name field detected"
        );
    }


    if (
        candidate.isFeatureServer
    ) {
        score += 10;

        reasons.push(
            "FeatureServer"
        );
    }


    if (
        candidate.isMapServer
    ) {
        score += 5;

        reasons.push(
            "MapServer"
        );
    }


    if (
        candidate.isOfficial
    ) {
        score += 20;

        reasons.push(
            "official municipal source"
        );
    }


    // -------------------------------------------------------------------------
    // Title signals
    // -------------------------------------------------------------------------

    if (
        containsAny(
            title,
            [
                "ward",
                "wards"
            ]
        )
    ) {
        score += 20;

        reasons.push(
            "title contains ward"
        );
    }


    if (
        containsAny(
            title,
            [
                "council district",
                "city council",
                "council districts"
            ]
        )
    ) {
        score += 25;

        reasons.push(
            "title contains council district"
        );
    }


    if (
        containsAny(
            title,
            [
                "boundary",
                "boundaries"
            ]
        )
    ) {
        score += 15;

        reasons.push(
            "title contains boundary terminology"
        );
    }


    if (
        containsAny(
            title,
            [
                "municipal",
                "city of"
            ]
        )
    ) {
        score += 5;

        reasons.push(
            "title appears municipal"
        );
    }


    // -------------------------------------------------------------------------
    // Negative signals
    // -------------------------------------------------------------------------

    if (
        candidate.isHousingDataset ||
        containsAny(
            title,
            [
                "housing",
                "section 8",
                "affordable housing",
                "housing units"
            ]
        )
    ) {
        score -= 40;

        reasons.push(
            "housing dataset"
        );
    }


    if (
        candidate.isCensusDataset ||
        containsAny(
            title,
            [
                "census block",
                "block group",
                "tract",
                "census geography",
                "census data"
            ]
        )
    ) {
        score -= 45;

        reasons.push(
            "Census geography/dataset"
        );
    }


    if (
        candidate.isThematicDataset
    ) {
        score -= 35;

        reasons.push(
            "thematic dataset"
        );
    }


    if (
        containsAny(
            title,
            [
                "equity",
                "index",
                "priority",
                "demographic",
                "population",
                "income"
            ]
        )
    ) {
        score -= 20;

        reasons.push(
            "thematic/non-boundary terminology"
        );
    }


    // -------------------------------------------------------------------------
    // Geometry fallback
    // -------------------------------------------------------------------------

    if (
        candidate.geometryType &&
        !candidate.isPolygonLayer &&
        isPolygonGeometry(
            candidate.geometryType
        )
    ) {
        score += 15;

        reasons.push(
            "polygon geometry detected"
        );
    }


    // -------------------------------------------------------------------------
    // Clamp score
    // -------------------------------------------------------------------------

    score =
        Math.max(
            0,
            Math.min(
                100,
                score
            )
        );


    return {
        score,
        reasons
    };
}


// =============================================================================
// Helpers
// =============================================================================

function normalize(
    value?: string
): string {

    return (value ?? "")
        .toLowerCase()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}


function containsAny(
    value: string,
    terms: string[]
): boolean {

    return terms.some(
        term =>
            value.includes(term)
    );
}


function isPolygonGeometry(
    geometryType: string
): boolean {

    const normalized =
        geometryType.toLowerCase();

    return (
        normalized === "polygon" ||
        normalized === "esrigeometrypolygon" ||
        normalized.includes("polygon")
    );
}