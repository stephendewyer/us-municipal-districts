import type {
    ArcGISServiceType
} from "./types.js";


// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ScoreCandidateInput {

    city?: string;

    state?: string;

    placeFips: string;

    title?: string;

    url?: string;

    serviceName?: string;

    serviceType?: ArcGISServiceType;

    layerName?: string;

    description?: string;

    fields?: string[];

    hasDistrictField?: boolean;

    hasNameField?: boolean;

    isFeatureServer?: boolean;

    isMapServer?: boolean;

    isPolygonLayer?: boolean;

    isLikelyBoundaryLayer?: boolean;

    supportsQuery?: boolean;

    supportsGeometryQuery?: boolean;

    supportsPagination?: boolean;

    supportsGeoJSON?: boolean;

    maxRecordCount?: number;

    geometryType?: string;
}


export interface ScoreCandidateResult {

    score: number;

    requiresReview: boolean;

    reasons: string[];
}


// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

export function scoreCandidate(
    candidate: ScoreCandidateInput
): ScoreCandidateResult {

    // -------------------------------------------------------------------------
    // Searchable text
    // -------------------------------------------------------------------------

    const searchableText = [
        candidate.title,
        candidate.url,
        candidate.serviceName,
        candidate.layerName,
        candidate.description
    ]
        .filter(
            (value): value is string =>
                typeof value === "string" &&
                value.trim().length > 0
        )
        .join(" ")
        .toLowerCase();


    // -------------------------------------------------------------------------
    // Normalized fields
    // -------------------------------------------------------------------------

    const fields =
        (candidate.fields ?? [])
            .filter(
                (field): field is string =>
                    typeof field === "string"
            )
            .map(
                field =>
                    normalizeField(field)
            );


    // -------------------------------------------------------------------------
    // Score
    // -------------------------------------------------------------------------

    let score = 0;

    const reasons: string[] = [];


    // -------------------------------------------------------------------------
    // Boundary terminology
    // -------------------------------------------------------------------------

    /*
     * These are intentionally NOT all equivalent.
     *
     * "ward boundary" is much stronger than simply "ward".
     */

    if (
        containsAny(
            searchableText,
            [
                "ward boundary",
                "ward boundaries",
                "ward district",
                "ward districts"
            ]
        )
    ) {

        score += 35;

        reasons.push(
            "ward boundary terminology"
        );
    }


    if (
        containsAny(
            searchableText,
            [
                "council district boundary",
                "council district boundaries",
                "city council district boundary",
                "city council district boundaries"
            ]
        )
    ) {

        score += 40;

        reasons.push(
            "council district boundary terminology"
        );
    }


    if (
        containsAny(
            searchableText,
            [
                "aldermanic district boundary",
                "aldermanic district boundaries"
            ]
        )
    ) {

        score += 40;

        reasons.push(
            "aldermanic district boundary terminology"
        );
    }


    if (
        containsAny(
            searchableText,
            [
                "municipal district boundary",
                "municipal district boundaries"
            ]
        )
    ) {

        score += 40;

        reasons.push(
            "municipal district boundary terminology"
        );
    }


    // -------------------------------------------------------------------------
    // Standalone ward / district terminology
    // -------------------------------------------------------------------------

    if (
        containsWord(
            searchableText,
            "ward"
        )
    ) {

        score += 20;

        reasons.push(
            "contains ward"
        );
    }


    if (
        containsWord(
            searchableText,
            "district"
        )
    ) {

        score += 15;

        reasons.push(
            "contains district"
        );
    }


    if (
        containsWord(
            searchableText,
            "council"
        )
    ) {

        score += 10;

        reasons.push(
            "contains council"
        );
    }


    if (
        containsWord(
            searchableText,
            "alderman"
        )
    ) {

        score += 15;

        reasons.push(
            "contains alderman"
        );
    }


    // -------------------------------------------------------------------------
    // Explicit city council terminology
    // -------------------------------------------------------------------------

    if (
        containsAny(
            searchableText,
            [
                "city council",
                "city council ward",
                "city council wards",
                "city council district",
                "city council districts"
            ]
        )
    ) {

        score += 20;

        reasons.push(
            "city council terminology"
        );
    }


    // -------------------------------------------------------------------------
    // Geometry
    // -------------------------------------------------------------------------

    const isPolygon =
        candidate.isPolygonLayer === true ||
        candidate.geometryType === "Polygon" ||
        candidate.geometryType === "MultiPolygon" ||
        candidate.geometryType === "esriGeometryPolygon";


    if (isPolygon) {

        score += 25;

        reasons.push(
            "polygon geometry"
        );
    }


    // -------------------------------------------------------------------------
    // Non-polygon penalty
    // -------------------------------------------------------------------------

    if (
        candidate.isPolygonLayer === false &&
        candidate.geometryType
    ) {

        score -= 20;

        reasons.push(
            "non-polygon geometry"
        );
    }


    // -------------------------------------------------------------------------
    // ArcGIS service type
    // -------------------------------------------------------------------------

    if (
        candidate.isFeatureServer === true ||
        candidate.serviceType === "FeatureServer"
    ) {

        score += 10;

        reasons.push(
            "FeatureServer"
        );
    }


    if (
        candidate.isMapServer === true ||
        candidate.serviceType === "MapServer"
    ) {

        score += 10;

        reasons.push(
            "MapServer"
        );
    }


    // -------------------------------------------------------------------------
    // Boundary inspection signal
    // -------------------------------------------------------------------------

    if (
        candidate.isLikelyBoundaryLayer === true
    ) {

        score += 25;

        reasons.push(
            "likely boundary layer"
        );
    }


    // -------------------------------------------------------------------------
    // District field
    // -------------------------------------------------------------------------

    if (
        candidate.hasDistrictField === true ||
        fields.some(
            field =>
                isDistrictField(field)
        )
    ) {

        score += 25;

        reasons.push(
            "district field"
        );
    }


    // -------------------------------------------------------------------------
    // Name field
    // -------------------------------------------------------------------------

    if (
        candidate.hasNameField === true ||
        fields.some(
            field =>
                isNameField(field)
        )
    ) {

        score += 15;

        reasons.push(
            "name field"
        );
    }


    // -------------------------------------------------------------------------
    // Query capability
    // -------------------------------------------------------------------------

    if (
        candidate.supportsQuery === true
    ) {

        score += 5;

        reasons.push(
            "supports query"
        );
    }


    if (
        candidate.supportsGeometryQuery === true
    ) {

        score += 5;

        reasons.push(
            "supports geometry query"
        );
    }


    if (
        candidate.supportsPagination === true
    ) {

        score += 3;

        reasons.push(
            "supports pagination"
        );
    }


    if (
        candidate.supportsGeoJSON === true
    ) {

        score += 3;

        reasons.push(
            "supports GeoJSON"
        );
    }


    // =========================================================================
    // NEGATIVE SIGNALS
    // =========================================================================

    // -------------------------------------------------------------------------
    // Housing
    // -------------------------------------------------------------------------

    if (
        containsWord(
            searchableText,
            "housing"
        )
    ) {

        score -= 45;

        reasons.push(
            "housing dataset"
        );
    }


    // -------------------------------------------------------------------------
    // Census
    // -------------------------------------------------------------------------

    if (
        containsWord(
            searchableText,
            "census"
        )
    ) {

        score -= 35;

        reasons.push(
            "census dataset"
        );
    }


    if (
        containsAny(
            searchableText,
            [
                "census block",
                "census blocks",
                "block group",
                "block groups"
            ]
        )
    ) {

        score -= 45;

        reasons.push(
            "census block dataset"
        );
    }


    // -------------------------------------------------------------------------
    // Neighborhood
    // -------------------------------------------------------------------------

    if (
        containsWord(
            searchableText,
            "neighborhood"
        )
    ) {

        score -= 45;

        reasons.push(
            "neighborhood dataset"
        );
    }


    // -------------------------------------------------------------------------
    // Parcel
    // -------------------------------------------------------------------------

    if (
        containsWord(
            searchableText,
            "parcel"
        )
    ) {

        score -= 45;

        reasons.push(
            "parcel dataset"
        );
    }


    // -------------------------------------------------------------------------
    // Crime
    // -------------------------------------------------------------------------

    if (
        containsWord(
            searchableText,
            "crime"
        )
    ) {

        score -= 45;

        reasons.push(
            "crime dataset"
        );
    }


    // -------------------------------------------------------------------------
    // Zoning
    // -------------------------------------------------------------------------

    if (
        containsWord(
            searchableText,
            "zoning"
        )
    ) {

        score -= 45;

        reasons.push(
            "zoning dataset"
        );
    }


    // -------------------------------------------------------------------------
    // Transportation / infrastructure
    // -------------------------------------------------------------------------

    if (
        containsAny(
            searchableText,
            [
                "street",
                "road",
                "traffic",
                "bike",
                "bus route",
                "transit",
                "sidewalk",
                "parking"
            ]
        )
    ) {

        score -= 30;

        reasons.push(
            "transportation dataset"
        );
    }


    // -------------------------------------------------------------------------
    // Parks / recreation
    // -------------------------------------------------------------------------

    if (
        containsAny(
            searchableText,
            [
                "park",
                "parks",
                "golf course",
                "recreation"
            ]
        )
    ) {

        score -= 30;

        reasons.push(
            "parks/recreation dataset"
        );
    }


    // -------------------------------------------------------------------------
    // Environmental / thematic datasets
    // -------------------------------------------------------------------------

    if (
        containsAny(
            searchableText,
            [
                "tree equity",
                "solar",
                "climate",
                "environment",
                "environmental",
                "air quality"
            ]
        )
    ) {

        score -= 30;

        reasons.push(
            "thematic environmental dataset"
        );
    }


    // -------------------------------------------------------------------------
    // Historical datasets
    // -------------------------------------------------------------------------

    if (
        /\b(19|20)\d{2}\b/.test(
            searchableText
        ) &&
        containsAny(
            searchableText,
            [
                "ward",
                "district",
                "redistrict",
                "boundary"
            ]
        )
    ) {

        score -= 15;

        reasons.push(
            "possibly historical boundary dataset"
        );
    }


    // =========================================================================
    // Strong positive override
    // =========================================================================

    /*
     * An actual boundary layer with polygon geometry and a district field
     * should rank very highly even if the service has a generic title.
     */

    if (
        isPolygon &&
        candidate.isLikelyBoundaryLayer === true &&
        (
            candidate.hasDistrictField === true ||
            fields.some(
                field =>
                    isDistrictField(field)
            )
        )
    ) {

        score += 20;

        reasons.push(
            "polygon boundary with district field"
        );
    }


    // =========================================================================
    // Strong negative override
    // =========================================================================

    /*
     * A dataset explicitly describing housing, census, parcels, etc. should
     * not become a top candidate simply because it contains "ward".
     */

    const thematicDataset =
        containsAny(
            searchableText,
            [
                "housing",
                "census",
                "parcel",
                "crime",
                "zoning",
                "neighborhood",
                "solar",
                "climate",
                "tree equity",
                "bus route",
                "bike",
                "street maintenance"
            ]
        );


    if (
        thematicDataset &&
        !containsAny(
            searchableText,
            [
                "ward boundary",
                "ward boundaries",
                "district boundary",
                "district boundaries",
                "council district boundary",
                "council district boundaries"
            ]
        )
    ) {

        score -= 20;

        reasons.push(
            "thematic dataset rather than boundary layer"
        );
    }


    // =========================================================================
    // Normalize
    // =========================================================================

    score =
        Math.max(
            0,
            Math.min(
                100,
                score
            )
        );


    // =========================================================================
    // Review threshold
    // =========================================================================

    /*
     * 90+ = strong enough to consider automatic selection.
     *
     * Anything below 90 should still be retained for manual review.
     */

    const requiresReview =
        score < 90;


    return {

        score,

        requiresReview,

        reasons
    };
}


// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function normalizeField(
    field: string
): string {

    return field
        .toLowerCase()
        .trim()
        .replace(
            /[^a-z0-9]/g,
            ""
        );
}


function containsWord(
    text: string,
    word: string
): boolean {

    const escaped =
        word.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
        );


    return new RegExp(
        `\\b${escaped}\\b`,
        "i"
    ).test(
        text
    );
}


function containsAny(
    text: string,
    values: readonly string[]
): boolean {

    return values.some(
        value =>
            text.includes(
                value.toLowerCase()
            )
    );
}


function isDistrictField(
    field: string
): boolean {

    return [
        "district",
        "districtid",
        "districtno",
        "districtnum",
        "districtnumber",

        "ward",
        "wardid",
        "wardno",
        "wardnum",
        "wardnumber",

        "councildistrict",
        "councildistrictid",
        "councildistrictno",
        "councildistrictnum",

        "aldermanicdistrict",
        "aldermanicdistrictid",
        "aldermanicdistrictno",
        "aldermanicdistrictnum"
    ].includes(
        field
    );
}


function isNameField(
    field: string
): boolean {

    return [
        "name",
        "districtname",
        "wardname",
        "councildistrictname",
        "aldermanicdistrictname"
    ].includes(
        field
    );
}