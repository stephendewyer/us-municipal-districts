import type {
    ArcGISGeometryType,
    InspectedCandidate,
    CandidateScore
} from "./types.js";


// =============================================================================
// Public API
// =============================================================================

/**
 * Rank inspected municipal district candidates.
 *
 * Candidates should already have been:
 *
 * 1. discovered
 * 2. inspected
 * 3. classified
 *
 * Rejected candidates are excluded automatically.
 */
export function rankCandidates(
    candidates: InspectedCandidate[]
): CandidateScore[] {

    return candidates
        .filter(candidate =>
            !candidate.classification.shouldReject
        )
        .filter(candidate =>
            candidate.classification.isPoliticalBoundary
        )
        .map(candidate => {

            const result =
                calculateScore(candidate);

            return {
                candidate,
                score: result.score,
                reasons: result.reasons
            };
        })
        .sort(
            (a, b) =>
                b.score - a.score
        );
}


// =============================================================================
// Scoring
// =============================================================================

function calculateScore(
    candidate: InspectedCandidate
): {
    score: number;
    reasons: string[];
} {

    const reasons: string[] = [];

    let score =
        candidate.candidate.score;


    const inspection =
        candidate.inspection;

    const classification =
        candidate.classification;


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

        score += 50;

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

        score += 25;

        reasons.push(
            "polygon boundary layer"
        );
    }


    // -------------------------------------------------------------------------
    // District type
    // -------------------------------------------------------------------------

    if (
        classification.districtType
    ) {

        score += 20;

        reasons.push(
            `identified as ${classification.districtType}`
        );
    }


    // -------------------------------------------------------------------------
    // Geometry
    // -------------------------------------------------------------------------

    if (
        isPolygonGeometry(
            inspection.geometryType
        )
    ) {

        score += 25;

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
    // FeatureServer
    // -------------------------------------------------------------------------

    if (
        inspection.serviceType ===
        "FeatureServer"
    ) {

        score += 15;

        reasons.push(
            "FeatureServer"
        );
    }


    // -------------------------------------------------------------------------
    // MapServer
    // -------------------------------------------------------------------------

    if (
        inspection.serviceType ===
        "MapServer"
    ) {

        score += 10;

        reasons.push(
            "MapServer"
        );
    }


    // -------------------------------------------------------------------------
    // Query support
    // -------------------------------------------------------------------------

    if (
        inspection.supportsQuery
    ) {

        score += 10;

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
    // Historical datasets
    // -------------------------------------------------------------------------

    const title =
        normalizeText(
            inspection.title ??
            candidate.candidate.title ??
            ""
        );

    if (
        isHistorical(title)
    ) {

        score -= 50;

        reasons.push(
            "appears to be historical"
        );
    }


    return {
        score,
        reasons
    };
}


// =============================================================================
// Geometry
// =============================================================================

function isPolygonGeometry(
    geometry?: ArcGISGeometryType
): boolean {

    if (!geometry) {
        return false;
    }

    return (
        geometry === "polygon" ||
        geometry === "esriGeometryPolygon"
    );
}


// =============================================================================
// Historical detection
// =============================================================================

function isHistorical(
    text: string
): boolean {

    if (
        containsAny(text, [
            "historical",
            "historic",
            "old ward",
            "old wards",
            "former ward",
            "former wards",
            "previous ward",
            "previous wards",
            "past ward",
            "past wards"
        ])
    ) {
        return true;
    }


    /*
     * Don't automatically reject every layer containing a year.
     *
     * A current redistricting dataset can legitimately contain
     * a recent year.
     */
    const years =
        text.match(
            /\b(?:19|20)\d{2}\b/g
        );

    if (!years) {
        return false;
    }


    const currentYear =
        new Date().getFullYear();


    return years.some(year => {

        const numericYear =
            Number(year);

        return (
            numericYear <
            currentYear - 4
        );
    });
}


// =============================================================================
// Helpers
// =============================================================================

function normalizeText(
    value: string
): string {

    return value
        .toLowerCase()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}


function containsAny(
    value: string,
    terms: string[]
): boolean {

    return terms.some(term =>
        value.includes(term)
    );
}