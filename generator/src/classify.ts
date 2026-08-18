import type {
    ArcGISInspection,
    CandidateClassification,
    DistrictType,
    DiscoveryCandidate
} from "./types.js";


// =============================================================================
// Keyword groups
// =============================================================================

const THEMATIC_TERMS = [
    "housing",
    "subsidized",
    "income",
    "demographic",
    "demographics",
    "population",
    "employment",
    "educational",
    "education",
    "climate",
    "environment",
    "tree equity",
    "equity priority",
    "equity index",
    "survey",
    "solar",
    "airport",
    "park",
    "parks",
    "golf",
    "bike",
    "birding",
    "transportation",
    "street maintenance",
    "crime",
    "hate crime",
    "business",
    "impact fee",
    "project",
    "projects",
    "transit",
    "route",
    "routes",
    "stop",
    "stops",
    "maintenance",
    "recreation",
    "playground",
    "playgrounds",
    "aquatics",
    "golf course",
    "golf courses",
    "connectivity"
];


const CENSUS_TERMS = [
    "census",
    "block group",
    "block groups",
    "tract",
    "tracts",
    "tabulation area",
    "zcta"
];


const PARCEL_TERMS = [
    "parcel",
    "parcels",
    "property",
    "properties",
    "lot",
    "lots",
    "land split",
    "land splits",
    "zoning"
];


const HOUSING_TERMS = [
    "housing",
    "subsidized housing",
    "section 8",
    "affordable housing",
    "low income housing"
];


const POLITICAL_TERMS = [
    "ward",
    "wards",
    "ward boundary",
    "ward boundaries",

    "council district",
    "council districts",
    "council district boundary",
    "council district boundaries",

    "city council",
    "city council district",
    "city council districts",

    "municipal district",
    "municipal districts",
    "municipal district boundary",
    "municipal district boundaries",

    "aldermanic",
    "aldermanic district",
    "aldermanic districts",
    "aldermanic district boundary",
    "aldermanic district boundaries"
];


const BOUNDARY_TERMS = [
    "boundary",
    "boundaries",
    "district",
    "districts",
    "ward",
    "wards",
    "council"
];


const OFFICIAL_TERMS = [
    "city of",
    "town of",
    "village of",
    "municipality",
    "municipal",
    "official",
    "open data",
    "open_data",
    "city council"
];


// =============================================================================
// Helpers
// =============================================================================

function normalize(value?: string): string {

    return (value ?? "")
        .toLowerCase()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}


function searchableText(
    candidate: DiscoveryCandidate,
    inspection: ArcGISInspection
): string {

    return normalize([
        candidate.title,
        candidate.candidateUrl,
        inspection.title,
        inspection.serviceName,
        inspection.layerName,
        inspection.description
    ]
        .filter(Boolean)
        .join(" "));
}


function containsAny(
    text: string,
    terms: string[]
): string | undefined {

    return terms.find(
        term =>
            text.includes(term)
    );
}


function containsAnyAll(
    text: string,
    terms: string[]
): string[] {

    return terms.filter(
        term =>
            text.includes(term)
    );
}


// =============================================================================
// Field evidence
// =============================================================================

function getFieldText(
    inspection: ArcGISInspection
): string {

    return normalize([
        ...(inspection.districtFields ?? []),
        ...(inspection.nameFields ?? []),
        ...(inspection.fields ?? []).map(
            field =>
                `${field.name} ${field.alias ?? ""}`
        )
    ].join(" "));
}


function hasStrongPoliticalField(
    inspection: ArcGISInspection
): boolean {

    const fields = [
        ...(inspection.districtFields ?? []),
        ...(inspection.fields ?? []).map(
            field =>
                `${field.name} ${field.alias ?? ""}`
        )
    ];

    return fields.some(field => {

        const value =
            normalize(field);

        return (
            value.includes("ward") ||
            value.includes("council district") ||
            value.includes("council_district") ||
            value.includes("aldermanic") ||
            value.includes("municipal district")
        );
    });
}


// =============================================================================
// District type
// =============================================================================

export function detectDistrictType(
    text: string
): DistrictType | undefined {

    if (
        text.includes("ward") ||
        text.includes("wards")
    ) {
        return "ward";
    }

    if (
        text.includes("council district") ||
        text.includes("council districts") ||
        text.includes("city council")
    ) {
        return "council-district";
    }

    if (
        text.includes("aldermanic")
    ) {
        return "aldermanic-district";
    }

    if (
        text.includes("municipal district") ||
        text.includes("municipal districts")
    ) {
        return "municipal-district";
    }

    return undefined;
}


// =============================================================================
// Classification
// =============================================================================

export function classifyCandidate(
    candidate: DiscoveryCandidate,
    inspection: ArcGISInspection
): CandidateClassification {

    const text =
        searchableText(
            candidate,
            inspection
        );

    const fieldText =
        getFieldText(
            inspection
        );

    const thematicMatches =
        containsAnyAll(
            text,
            THEMATIC_TERMS
        );

    const censusMatches =
        containsAnyAll(
            text,
            CENSUS_TERMS
        );

    const parcelMatches =
        containsAnyAll(
            text,
            PARCEL_TERMS
        );

    const housingMatches =
        containsAnyAll(
            text,
            HOUSING_TERMS
        );

    const politicalMatches =
        containsAnyAll(
            text,
            POLITICAL_TERMS
        );

    const boundaryMatches =
        containsAnyAll(
            text,
            BOUNDARY_TERMS
        );

    const officialMatches =
        containsAnyAll(
            text,
            OFFICIAL_TERMS
        );

    /*
     * IMPORTANT:
     *
     * Do not use field names as the primary source of political
     * classification.
     *
     * A WARD field can simply mean that a thematic dataset contains
     * the ward associated with each feature.
     */

    const districtType =
        detectDistrictType(
            text
        );


    // =========================================================================
    // Geometry
    // =========================================================================

    const isPolygon =
        inspection.geometryType ===
            "esriGeometryPolygon" ||
        inspection.geometryType ===
            "polygon";


    /*
     * A boundary layer requires BOTH:
     *
     *   1. polygon geometry
     *   2. textual evidence that the layer represents a boundary
     *
     * Merely having a DISTRICT or WARD field is not enough.
     */

    const textualBoundaryEvidence =
        politicalMatches.length > 0 ||
        (
            boundaryMatches.length > 0 &&
            districtType !== undefined
        );


    const isBoundaryLayer =
        isPolygon &&
        textualBoundaryEvidence;


    // =========================================================================
    // Dataset rejection
    // =========================================================================

    const isCensusDataset =
        censusMatches.length > 0;

    const isParcelDataset =
        parcelMatches.length > 0;

    const isHousingDataset =
        housingMatches.length > 0;

    const isThematicDataset =
        thematicMatches.length > 0;


    /*
     * Thematic datasets should normally be rejected.
     *
     * The exception is a genuine political boundary layer whose
     * metadata explicitly identifies the layer as a ward/council/
     * municipal district boundary.
     */

    const shouldReject =
        isCensusDataset ||
        isParcelDataset ||
        isHousingDataset ||
        (
            isThematicDataset &&
            !isBoundaryLayer
        );


    // =========================================================================
    // Official source
    // =========================================================================

    const officialMunicipalSource =
        isLikelyOfficialMunicipalSource(
            candidate,
            inspection
        );


    // =========================================================================
    // Political boundary
    // =========================================================================

    /*
     * This is intentionally strict.
     *
     * A candidate is a political boundary only when:
     *
     *   - it is a polygon
     *   - it has explicit political-boundary evidence
     *   - a district type can be identified
     *   - it has a district field
     *
     * This prevents datasets such as:
     *
     *   "LaDoceFocusNeighborhoods"
     *   "Tree Equity"
     *   "Golf Courses"
     *
     * from becoming ward sources merely because they contain
     * a WARD field.
     */

    const hasDistrictField =
        Boolean(
            inspection.districtField
        ) ||
        (
            inspection.districtFields?.length ?? 0
        ) > 0;


    const isPoliticalBoundary =
        !shouldReject &&
        isBoundaryLayer &&
        districtType !== undefined &&
        hasDistrictField;


    return {
        isBoundaryLayer,
        isPoliticalBoundary,

        isThematicDataset,
        isCensusDataset,
        isParcelDataset,
        isHousingDataset,

        officialMunicipalSource,

        districtType:
            isPoliticalBoundary
                ? districtType
                : undefined,

        shouldReject,

        matches: {
            thematic: thematicMatches,
            census: censusMatches,
            parcel: parcelMatches,
            housing: housingMatches,
            political: politicalMatches,
            boundary: boundaryMatches,
            official: officialMatches
        }
    };
}


// =============================================================================
// Official municipal source
// =============================================================================

export function isLikelyOfficialMunicipalSource(
    candidate: DiscoveryCandidate,
    inspection: ArcGISInspection
): boolean {

    const url =
        normalize(
            candidate.candidateUrl
        );

    const text =
        normalize([
            candidate.title,
            inspection.title,
            inspection.serviceName,
            inspection.layerName,
            inspection.description
        ]
            .filter(Boolean)
            .join(" "));


    const officialDomain =
        isMunicipalDomain(
            url
        );

    if (officialDomain) {
        return true;
    }


    const municipalLanguage =
        containsAny(
            text,
            [
                "city of",
                "town of",
                "village of",
                "municipality"
            ]
        );


    const officialLanguage =
        containsAny(
            text,
            [
                "official",
                "open data",
                "open_data"
            ]
        );


    return Boolean(
        municipalLanguage &&
        officialLanguage
    );
}


// =============================================================================
// Municipal-domain detection
// =============================================================================

function isMunicipalDomain(
    url: string
): boolean {

    let hostname: string;

    try {

        hostname =
            new URL(url)
                .hostname
                .toLowerCase();

    } catch {

        return false;
    }


    const governmentDomain =
        hostname.endsWith(".gov") ||
        hostname.endsWith(".us");

    if (governmentDomain) {
        return true;
    }


    if (
        hostname.includes("gis.") ||
        hostname.includes("gisdata.") ||
        hostname.includes("mapdata.")
    ) {
        return true;
    }


    return false;
}


// =============================================================================
// Rejection explanation
// =============================================================================

export function getClassificationReasons(
    classification: CandidateClassification
): string[] {

    const reasons: string[] = [];


    if (
        classification.isCensusDataset
    ) {
        reasons.push(
            "census dataset"
        );
    }


    if (
        classification.isParcelDataset
    ) {
        reasons.push(
            "parcel/property dataset"
        );
    }


    if (
        classification.isHousingDataset
    ) {
        reasons.push(
            "housing dataset"
        );
    }


    if (
        classification.isThematicDataset &&
        !classification.isBoundaryLayer
    ) {
        reasons.push(
            "thematic dataset"
        );
    }


    if (
        classification.isBoundaryLayer
    ) {
        reasons.push(
            "polygon boundary layer"
        );
    }


    if (
        classification.isPoliticalBoundary
    ) {
        reasons.push(
            "political district boundary"
        );
    }


    if (
        classification.officialMunicipalSource
    ) {
        reasons.push(
            "likely official municipal source"
        );
    }


    if (
        classification.districtType
    ) {
        reasons.push(
            `district type: ${classification.districtType}`
        );
    }


    if (
        classification.shouldReject
    ) {
        reasons.push(
            "rejected"
        );
    }


    return reasons;
}