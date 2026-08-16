export interface ScoreCandidateInput {
    placeFips: string;

    city?: string;
    state?: string;

    title?: string;
    url?: string;

    serviceName?: string;
    serviceType?: string;

    layerName?: string;
    description?: string;

    geometryType?: string;

    fields?: string[];

    hasDistrictField?: boolean;
    hasNameField?: boolean;

    isFeatureServer?: boolean;
    isMapServer?: boolean;

    isPolygonLayer?: boolean;
    isLikelyBoundaryLayer?: boolean;
}

export interface ScoreCandidateResult {
    score: number;
    requiresReview: boolean;
    reasons: string[];
}


export function scoreCandidate(
    candidate: ScoreCandidateInput
): ScoreCandidateResult {

    /*
     * Convert every potentially undefined value to a string
     * before calling string methods.
     */
    const searchableText = [
        candidate.city,
        candidate.state,
        candidate.title,
        candidate.url,
        candidate.serviceName,
        candidate.serviceType,
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


    const fields =
        (candidate.fields ?? [])
            .filter(
                (field): field is string =>
                    typeof field === "string"
            )
            .map(
                field =>
                    field.toLowerCase()
            );


    let score = 0;

    const reasons: string[] = [];


    // -------------------------------------------------------------------------
    // Strong boundary keywords
    // -------------------------------------------------------------------------

    if (
        searchableText.includes("ward")
    ) {
        score += 25;
        reasons.push(
            "contains ward"
        );
    }


    if (
        searchableText.includes("council district")
    ) {
        score += 30;
        reasons.push(
            "contains council district"
        );
    }


    if (
        searchableText.includes("city council")
    ) {
        score += 25;
        reasons.push(
            "contains city council"
        );
    }


    if (
        searchableText.includes("municipal district")
    ) {
        score += 30;
        reasons.push(
            "contains municipal district"
        );
    }


    if (
        searchableText.includes("alderman")
    ) {
        score += 25;
        reasons.push(
            "contains alderman"
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
        score += 20;
        reasons.push(
            "polygon geometry"
        );
    }


    // -------------------------------------------------------------------------
    // ArcGIS service type
    // -------------------------------------------------------------------------

    if (
        candidate.isFeatureServer === true ||
        searchableText.includes("featureserver") ||
        candidate.url?.toLowerCase().includes(
            "/featureserver"
        )
    ) {
        score += 10;
        reasons.push(
            "FeatureServer"
        );
    }


    if (
        candidate.isMapServer === true ||
        searchableText.includes("mapserver") ||
        candidate.url?.toLowerCase().includes(
            "/mapserver"
        )
    ) {
        score += 10;
        reasons.push(
            "MapServer"
        );
    }


    // -------------------------------------------------------------------------
    // Inspection signals
    // -------------------------------------------------------------------------

    if (
        candidate.isLikelyBoundaryLayer === true
    ) {
        score += 30;
        reasons.push(
            "likely boundary layer"
        );
    }


    // -------------------------------------------------------------------------
    // District fields
    // -------------------------------------------------------------------------

    const districtFields = [
        "district",
        "districtid",
        "district_id",
        "district_no",
        "district_num",
        "district_number",

        "ward",
        "wardid",
        "ward_id",
        "ward_no",
        "ward_num",
        "ward_number",

        "council_district",
        "councildistrict",
        "council_district_no",

        "aldermanic_district"
    ];


    if (
        candidate.hasDistrictField === true ||
        fields.some(
            field =>
                districtFields.includes(field)
        )
    ) {
        score += 20;
        reasons.push(
            "district field"
        );
    }


    // -------------------------------------------------------------------------
    // Name fields
    // -------------------------------------------------------------------------

    const nameFields = [
        "name",
        "district_name",
        "ward_name",
        "council_district_name",
        "aldermanic_district_name"
    ];


    if (
        candidate.hasNameField === true ||
        fields.some(
            field =>
                nameFields.includes(field)
        )
    ) {
        score += 10;
        reasons.push(
            "name field"
        );
    }


    // -------------------------------------------------------------------------
    // Negative signals
    // -------------------------------------------------------------------------

    if (
        searchableText.includes(
            "census block"
        )
    ) {
        score -= 40;
        reasons.push(
            "census block dataset"
        );
    }


    if (
        searchableText.includes(
            "block group"
        )
    ) {
        score -= 40;
        reasons.push(
            "census block group dataset"
        );
    }


    if (
        searchableText.includes(
            "housing"
        )
    ) {
        score -= 30;
        reasons.push(
            "housing dataset"
        );
    }


    if (
        searchableText.includes(
            "crime"
        )
    ) {
        score -= 25;
        reasons.push(
            "crime dataset"
        );
    }


    if (
        searchableText.includes(
            "overdose"
        )
    ) {
        score -= 25;
        reasons.push(
            "overdose dataset"
        );
    }


    if (
        searchableText.includes(
            "parcel"
        )
    ) {
        score -= 25;
        reasons.push(
            "parcel dataset"
        );
    }


    if (
        searchableText.includes(
            "neighborhood"
        )
    ) {
        score -= 25;
        reasons.push(
            "neighborhood dataset"
        );
    }


    if (
        searchableText.includes(
            "zoning"
        )
    ) {
        score -= 30;
        reasons.push(
            "zoning dataset"
        );
    }


    // -------------------------------------------------------------------------
    // Normalize
    // -------------------------------------------------------------------------

    score =
        Math.max(
            0,
            Math.min(
                100,
                score
            )
        );


    // -------------------------------------------------------------------------
    // Review threshold
    // -------------------------------------------------------------------------

    const requiresReview =
        score < 90;


    return {
        score,
        requiresReview,
        reasons
    };
}