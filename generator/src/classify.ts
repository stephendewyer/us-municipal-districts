// generator/src/classify.ts

import type {
    ArcGISInspection,
    CandidateClassification,
    DistrictType,
    DiscoveryCandidate
} from "./types.js";


// -----------------------------------------------------------------------------
// Keyword groups
// -----------------------------------------------------------------------------

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
    "projects"
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
    "land splits"
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
    "council district",
    "council districts",
    "city council",
    "municipal district",
    "municipal districts",
    "aldermanic",
    "aldermanic district",
    "aldermanic districts"
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


// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

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
    return terms.find(term => text.includes(term));
}


function containsAnyAll(
    text: string,
    terms: string[]
): string[] {
    return terms.filter(term => text.includes(term));
}


// -----------------------------------------------------------------------------
// District type
// -----------------------------------------------------------------------------

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


// -----------------------------------------------------------------------------
// Classification
// -----------------------------------------------------------------------------

export function classifyCandidate(
    candidate: DiscoveryCandidate,
    inspection: ArcGISInspection
): CandidateClassification {

    const text = searchableText(candidate, inspection);

    const thematicMatches = containsAnyAll(text, THEMATIC_TERMS);
    const censusMatches = containsAnyAll(text, CENSUS_TERMS);
    const parcelMatches = containsAnyAll(text, PARCEL_TERMS);
    const housingMatches = containsAnyAll(text, HOUSING_TERMS);
    const politicalMatches = containsAnyAll(text, POLITICAL_TERMS);
    const boundaryMatches = containsAnyAll(text, BOUNDARY_TERMS);
    const officialMatches = containsAnyAll(text, OFFICIAL_TERMS);

    const districtType = detectDistrictType(text);

    // -------------------------------------------------------------------------
    // Geometry
    // -------------------------------------------------------------------------

    const isPolygon =
        inspection.geometryType === "esriGeometryPolygon" ||
        inspection.geometryType === "polygon";

    const isBoundaryLayer =
        isPolygon &&
        (
            boundaryMatches.length > 0 ||
            politicalMatches.length > 0
        );

    // -------------------------------------------------------------------------
    // Dataset rejection
    // -------------------------------------------------------------------------

    const isCensusDataset =
        censusMatches.length > 0;

    const isParcelDataset =
        parcelMatches.length > 0;

    const isHousingDataset =
        housingMatches.length > 0;

    const isThematicDataset =
        thematicMatches.length > 0;

    /*
     * A layer can contain the word "ward" and still not actually be
     * a ward boundary layer.
     *
     * For example:
     *
     *   "Ward 3 Census Block Groups"
     *   "Ward Housing"
     *   "Section 8 Housing per Ward"
     *
     * Those should not become canonical ward sources.
     */
    const shouldReject =
        isCensusDataset ||
        isParcelDataset ||
        isHousingDataset ||
        (
            isThematicDataset &&
            !isBoundaryLayer
        );

    // -------------------------------------------------------------------------
    // Official source detection
    // -------------------------------------------------------------------------

    const officialMunicipalSource =
        isLikelyOfficialMunicipalSource(
            candidate,
            inspection
        );

    // -------------------------------------------------------------------------
    // Political boundary detection
    // -------------------------------------------------------------------------

    const isPoliticalBoundary =
        !shouldReject &&
        isBoundaryLayer &&
        politicalMatches.length > 0 &&
        districtType !== undefined;

    return {
        isBoundaryLayer,
        isPoliticalBoundary,

        isThematicDataset,
        isCensusDataset,
        isParcelDataset,
        isHousingDataset,

        officialMunicipalSource,

        districtType,

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


// -----------------------------------------------------------------------------
// Official municipal source
// -----------------------------------------------------------------------------

export function isLikelyOfficialMunicipalSource(
    candidate: DiscoveryCandidate,
    inspection: ArcGISInspection
): boolean {

    const url = normalize(candidate.candidateUrl);

    const text = normalize([
        candidate.title,
        inspection.title,
        inspection.serviceName,
        inspection.layerName,
        inspection.description
    ]
        .filter(Boolean)
        .join(" "));

    /*
     * Strongest signal:
     *
     *   city/town/village GIS domain
     *
     * We deliberately don't assume every ArcGIS Online service is official.
     */

    const officialDomain =
        isMunicipalDomain(url);

    if (officialDomain) {
        return true;
    }

    /*
     * ArcGIS services hosted by a municipality can sometimes use a generic
     * ArcGIS URL. In that case, look for strong municipal ownership signals.
     */

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


// -----------------------------------------------------------------------------
// Municipal-domain detection
// -----------------------------------------------------------------------------

function isMunicipalDomain(url: string): boolean {

    /*
     * Extract hostname from the URL.
     */

    let hostname: string;

    try {
        hostname = new URL(url).hostname.toLowerCase();
    } catch {
        return false;
    }

    /*
     * Common municipal domains.
     *
     * This intentionally favors evidence of government ownership rather
     * than assuming that every ArcGIS.com service is official.
     */

    const governmentDomain =
        hostname.endsWith(".gov") ||
        hostname.endsWith(".us");

    if (governmentDomain) {
        return true;
    }

    /*
     * Examples:
     *
     * mapdata.tucsonaz.gov
     * gis.tucsonaz.gov
     * gisdata.pima.gov
     */

    if (
        hostname.includes("gis.") ||
        hostname.includes("gisdata.") ||
        hostname.includes("mapdata.")
    ) {
        return true;
    }

    return false;
}


// -----------------------------------------------------------------------------
// Rejection explanation
// -----------------------------------------------------------------------------

export function getClassificationReasons(
    classification: CandidateClassification
): string[] {

    const reasons: string[] = [];

    if (classification.isCensusDataset) {
        reasons.push("census dataset");
    }

    if (classification.isParcelDataset) {
        reasons.push("parcel/property dataset");
    }

    if (classification.isHousingDataset) {
        reasons.push("housing dataset");
    }

    if (
        classification.isThematicDataset &&
        !classification.isBoundaryLayer
    ) {
        reasons.push("thematic dataset");
    }

    if (classification.isBoundaryLayer) {
        reasons.push("polygon boundary layer");
    }

    if (classification.isPoliticalBoundary) {
        reasons.push("political district boundary");
    }

    if (classification.officialMunicipalSource) {
        reasons.push("likely official municipal source");
    }

    if (classification.districtType) {
        reasons.push(
            `district type: ${classification.districtType}`
        );
    }

    if (classification.shouldReject) {
        reasons.push("rejected");
    }

    return reasons;
}