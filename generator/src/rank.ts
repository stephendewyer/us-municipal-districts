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
 * Candidates explicitly rejected by classification are excluded.
 *
 * Classification is treated as evidence rather than a hard requirement:
 * a candidate does not need to be classified as a political boundary in
 * order to be considered by the ranking system.
 */
export function rankCandidates(
    candidates: InspectedCandidate[]
): CandidateScore[] {

    return candidates
        .filter(candidate =>
            !candidate.classification.shouldReject
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
            "boundary layer"
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
    // Title signals
    // -------------------------------------------------------------------------

    const title =
        normalizeText(
            inspection.title ??
            candidate.candidate.title ??
            ""
        );


    if (
        containsAny(
            title,
            [
                "ward",
                "wards"
            ]
        )
    ) {

        score += 30;

        reasons.push(
            "title contains ward"
        );
    }


    if (
        containsAny(
            title,
            [
                "council district",
                "council districts",
                "city council"
            ]
        )
    ) {

        score += 30;

        reasons.push(
            "title contains council district terminology"
        );
    }


    if (
        containsAny(
            title,
            [
                "aldermanic district",
                "aldermanic districts"
            ]
        )
    ) {

        score += 30;

        reasons.push(
            "title contains aldermanic district terminology"
        );
    }


    if (
        containsAny(
            title,
            [
                "municipal district",
                "municipal districts"
            ]
        )
    ) {

        score += 25;

        reasons.push(
            "title contains municipal district terminology"
        );
    }


    if (
        containsAny(
            title,
            [
                "district boundary",
                "district boundaries",
                "ward boundary",
                "ward boundaries"
            ]
        )
    ) {

        score += 25;

        reasons.push(
            "title contains boundary terminology"
        );
    }


    // -------------------------------------------------------------------------
    // Strong field evidence
    // -------------------------------------------------------------------------

    const districtFields =
        inspection.districtFields
            .map(normalizeText);


    const nameFields =
        inspection.nameFields
            .map(normalizeText);


    if (
        containsAny(
            districtFields.join(" "),
            [
                "ward",
                "ward number",
                "district",
                "district number",
                "council district",
                "council district number"
            ]
        )
    ) {

        score += 15;

        reasons.push(
            "field names strongly indicate political district"
        );
    }


    if (
        containsAny(
            nameFields.join(" "),
            [
                "ward name",
                "district name",
                "council district name",
                "ward",
                "district"
            ]
        )
    ) {

        score += 10;

        reasons.push(
            "name field appears to identify district"
        );
    }


    // -------------------------------------------------------------------------
    // Historical datasets
    // -------------------------------------------------------------------------

    if (
        isHistorical(title)
    ) {

        score -= 50;

        reasons.push(
            "appears to be historical"
        );
    }


    // -------------------------------------------------------------------------
    // Thematic/non-boundary datasets
    // -------------------------------------------------------------------------

    if (
        classification.isThematicDataset
    ) {

        score -= 40;

        reasons.push(
            "thematic dataset"
        );
    }


    // -------------------------------------------------------------------------
    // Census datasets
    // -------------------------------------------------------------------------

    if (
        classification.isCensusDataset
    ) {

        score -= 50;

        reasons.push(
            "Census dataset"
        );
    }


    // -------------------------------------------------------------------------
    // Housing datasets
    // -------------------------------------------------------------------------

    if (
        classification.isHousingDataset
    ) {

        score -= 40;

        reasons.push(
            "housing dataset"
        );
    }


    // -------------------------------------------------------------------------
    // Parcel datasets
    // -------------------------------------------------------------------------

    if (
        classification.isParcelDataset
    ) {

        score -= 40;

        reasons.push(
            "parcel dataset"
        );
    }


    // -------------------------------------------------------------------------
    // Clamp score
    // -------------------------------------------------------------------------

    score =
        Math.max(
            0,
            Math.min(
                300,
                score
            )
        );


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

    const normalized =
        geometry.toLowerCase();

    return (
        normalized === "polygon" ||
        normalized === "esrigeometrypolygon" ||
        normalized.includes("polygon")
    );
}


// =============================================================================
// Historical detection
// =============================================================================

function isHistorical(
    text: string
): boolean {

    /*
     * Explicit historical terminology is much stronger evidence
     * than the presence of a year in a dataset title.
     */
    return containsAny(
        text,
        [
            "historical",
            "historic",
            "old ward",
            "old wards",
            "former ward",
            "former wards",
            "previous ward",
            "previous wards",
            "past ward",
            "past wards",
            "former council district",
            "former council districts",
            "previous council district",
            "previous council districts",
            "old council district",
            "old council districts"
        ]
    );
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

    return terms.some(
        term =>
            value.includes(
                normalizeText(term)
            )
    );
}