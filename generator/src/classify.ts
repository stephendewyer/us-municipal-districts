import type {
    CandidateClassification,
    ClassificationMatches,
    DistrictType,
    DiscoveryCandidate,
    ArcGISInspection
} from "./types.js";


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


function unique(values: string[]): string[] {
    return [...new Set(values)];
}


interface Pattern {
    label: string;
    regex: RegExp;
}


function findMatches(
    text: string,
    patterns: Pattern[]
): string[] {

    return unique(
        patterns
            .filter(pattern => pattern.regex.test(text))
            .map(pattern => pattern.label)
    );
}


// =============================================================================
// Keyword patterns
// =============================================================================

const POLITICAL_PATTERNS: Pattern[] = [

    {
        label: "ward",
        regex: /\bwards?\b/i
    },

    {
        label: "council district",
        regex: /\bcouncil districts?\b/i
    },

    {
        label: "city council",
        regex: /\bcity council\b/i
    },

    {
        label: "aldermanic",
        regex: /\baldermanic\b/i
    },

    {
        label: "alderman",
        regex: /\balderman\b/i
    },

    {
        label: "municipal district",
        regex: /\bmunicipal districts?\b/i
    },

    {
        label: "political district",
        regex: /\bpolitical districts?\b/i
    },

    {
        label: "election district",
        regex: /\belection districts?\b/i
    },

    {
        label: "voting district",
        regex: /\bvoting districts?\b/i
    }
];


const WARD_PATTERNS: Pattern[] = [

    {
        label: "ward",
        regex: /\bwards?\b/i
    },

    {
        label: "ward boundary",
        regex: /\bward boundaries?\b/i
    }
];


const COUNCIL_PATTERNS: Pattern[] = [

    {
        label: "council district",
        regex: /\bcouncil districts?\b/i
    },

    {
        label: "city council",
        regex: /\bcity council\b/i
    },

    {
        label: "council ward",
        regex: /\bcouncil wards?\b/i
    }
];


const ALDERMANIC_PATTERNS: Pattern[] = [

    {
        label: "aldermanic",
        regex: /\baldermanic\b/i
    },

    {
        label: "alderman",
        regex: /\balderman\b/i
    }
];


const MUNICIPAL_PATTERNS: Pattern[] = [

    {
        label: "municipal district",
        regex: /\bmunicipal districts?\b/i
    }
];


const THEMATIC_PATTERNS: Pattern[] = [

    {
        label: "transit",
        regex: /\btransit\b/i
    },

    {
        label: "transit stop",
        regex: /\btransit stops?\b/i
    },

    {
        label: "route",
        regex: /\broutes?\b/i
    },

    {
        label: "golf",
        regex: /\bgolf\b/i
    },

    {
        label: "exercise",
        regex: /\bexercise\b/i
    },

    {
        label: "lighting",
        regex: /\blighting\b/i
    },

    {
        label: "playground",
        regex: /\bplaygrounds?\b/i
    },

    {
        label: "playing field",
        regex: /\bplaying fields?\b/i
    },

    {
        label: "ballfield",
        regex: /\bballfields?\b/i
    },

    {
        label: "maintenance",
        regex: /\bmaintenance\b/i
    },

    {
        label: "garden",
        regex: /\bgardens?\b/i
    },

    {
        label: "aquatic",
        regex: /\baquatics?\b/i
    },

    {
        label: "pool",
        regex: /\bpools?\b/i
    },

    {
        label: "road",
        regex: /\broads?\b/i
    },

    {
        label: "crime",
        regex: /\bcrimes?\b/i
    },

    {
        label: "hate",
        regex: /\bhate\b/i
    },

    {
        label: "violence",
        regex: /\bviolence\b/i
    },

    {
        label: "connectivity",
        regex: /\bconnectivity\b/i
    },

    {
        label: "project",
        regex: /\bprojects?\b/i
    },

    {
        label: "tree equity",
        regex: /\btree equity\b/i
    },

    {
        label: "neighborhood",
        regex: /\bneighborhoods?\b/i
    },

    {
        label: "zoning",
        regex: /\bzoning\b/i
    },

    {
        label: "water",
        regex: /\bwater\b/i
    },

    {
        label: "groundwater",
        regex: /\bgroundwater\b/i
    },

    {
        label: "airport",
        regex: /\bairport\b/i
    },

    {
        label: "environment",
        regex: /\benvironment\b/i
    }
];


const CENSUS_PATTERNS: Pattern[] = [

    {
        label: "census",
        regex: /\bcensus\b/i
    },

    {
        label: "block group",
        regex: /\bblock groups?\b/i
    },

    {
        label: "census tract",
        regex: /\bcensus tracts?\b/i
    },

    {
        label: "tract",
        regex: /\btracts?\b/i
    }
];


const PARCEL_PATTERNS: Pattern[] = [

    {
        label: "parcel",
        regex: /\bparcels?\b/i
    },

    {
        label: "property",
        regex: /\bproperties?\b/i
    },

    {
        label: "APN",
        regex: /\bapn\b/i
    },

    {
        label: "owner",
        regex: /\bowners?\b/i
    },

    {
        label: "ownership",
        regex: /\bownership\b/i
    },

    {
        label: "assessor",
        regex: /\bassessor\b/i
    },

    {
        label: "zoning",
        regex: /\bzoning\b/i
    }
];


const HOUSING_PATTERNS: Pattern[] = [

    {
        label: "housing",
        regex: /\bhousing\b/i
    },

    {
        label: "households",
        regex: /\bhouseholds?\b/i
    },

    {
        label: "residential",
        regex: /\bresidential\b/i
    },

    {
        label: "affordable housing",
        regex: /\baffordable housing\b/i
    },

    {
        label: "vacancy",
        regex: /\bvacancy\b/i
    }
];


// =============================================================================
// District type
// =============================================================================

function detectDistrictType(
    text: string
): DistrictType | undefined {

    if (
        WARD_PATTERNS.some(
            pattern => pattern.regex.test(text)
        )
    ) {
        return "ward";
    }


    if (
        COUNCIL_PATTERNS.some(
            pattern => pattern.regex.test(text)
        )
    ) {
        return "council-district";
    }


    if (
        ALDERMANIC_PATTERNS.some(
            pattern => pattern.regex.test(text)
        )
    ) {
        return "aldermanic-district";
    }


    if (
        MUNICIPAL_PATTERNS.some(
            pattern => pattern.regex.test(text)
        )
    ) {
        return "municipal-district";
    }


    return undefined;
}


// =============================================================================
// Main classifier
// =============================================================================

export function classifyCandidate(
    candidate: DiscoveryCandidate,
    inspection: ArcGISInspection
): CandidateClassification {

    // -------------------------------------------------------------------------
    // Text used for classification
    // -------------------------------------------------------------------------

    const title = normalize(
        inspection.title
    );

    const serviceName = normalize(
        inspection.serviceName
    );

    const layerName = normalize(
        inspection.layerName
    );

    const description = normalize(
        inspection.description
    );


    const fieldNames = (
        inspection.fields ?? []
    )
        .map(field => normalize(field.name))
        .filter(Boolean);


    const fieldAliases = (
        inspection.fields ?? []
    )
        .map(field => normalize(field.alias))
        .filter(Boolean);


    const fieldText = [
        ...fieldNames,
        ...fieldAliases
    ].join(" ");


    const searchableText = [
        title,
        serviceName,
        layerName,
        description,
        fieldText
    ]
        .filter(Boolean)
        .join(" ");


    const identityText = [
        title,
        serviceName,
        layerName
    ]
        .filter(Boolean)
        .join(" ");


    // -------------------------------------------------------------------------
    // Keyword matches
    // -------------------------------------------------------------------------

    const matches: ClassificationMatches = {

        thematic: findMatches(
            searchableText,
            THEMATIC_PATTERNS
        ),

        census: findMatches(
            searchableText,
            CENSUS_PATTERNS
        ),

        parcel: findMatches(
            searchableText,
            PARCEL_PATTERNS
        ),

        housing: findMatches(
            searchableText,
            HOUSING_PATTERNS
        ),

        political: findMatches(
            searchableText,
            POLITICAL_PATTERNS
        ),

        boundary: [],

        official: []
    };


    // -------------------------------------------------------------------------
    // Official municipal source
    // -------------------------------------------------------------------------

    const url = inspection.url.toLowerCase();


    /*
     * Do NOT treat every ArcGIS-hosted service as official.
     *
     * services1.arcgis.com
     * services3.arcgis.com
     * services6.arcgis.com
     *
     * can contain municipal data, but the hosting domain alone
     * does not prove municipal ownership.
     */
    const officialMunicipalSource =
        candidate.source === "municipal" ||
        url.includes("tucsonaz.gov") ||
        url.includes("cityoftucson");


    if (officialMunicipalSource) {
        matches.official.push(
            "official municipal source"
        );
    }


    // -------------------------------------------------------------------------
    // Geometry
    // -------------------------------------------------------------------------

    const isPolygon =
        inspection.geometryType ===
            "esriGeometryPolygon" ||
        inspection.geometryType ===
            "polygon";


    // -------------------------------------------------------------------------
    // District fields
    // -------------------------------------------------------------------------

    const districtFields =
        inspection.districtFields ?? [];


    const hasDistrictField =
        districtFields.length > 0;


    const politicalDistrictField =
        districtFields.some(field => {

            const normalized = normalize(field);

            return (
                /\bward\b/.test(normalized) ||
                /\bdistrict\b/.test(normalized) ||
                /\bcouncil\b/.test(normalized) ||
                /\balderman/.test(normalized)
            );
        });


    // -------------------------------------------------------------------------
    // Name fields
    // -------------------------------------------------------------------------

    const nameFields =
        inspection.nameFields ?? [];


    const hasNameField =
        nameFields.length > 0;


    // -------------------------------------------------------------------------
    // District type
    // -------------------------------------------------------------------------

    const districtType =
        detectDistrictType(identityText);


    // -------------------------------------------------------------------------
    // Negative evidence
    // -------------------------------------------------------------------------

    const isCensusDataset =
        matches.census.length > 0;


    const isParcelDataset =
        matches.parcel.length > 0;


    const isHousingDataset =
        matches.housing.length > 0;


    /*
     * Thematic evidence is not automatically disqualifying.
     *
     * A genuine political boundary dataset can have words such as
     * "project" or "community" in its description.
     */
    const thematicEvidence =
        matches.thematic.length > 0;


    // -------------------------------------------------------------------------
    // Political-boundary score
    // -------------------------------------------------------------------------

    let politicalBoundaryScore = 0;


    /*
     * Strong evidence: political terminology in the actual
     * layer/service identity.
     */
    if (
        WARD_PATTERNS.some(
            pattern => pattern.regex.test(identityText)
        )
    ) {
        politicalBoundaryScore += 5;
    }


    if (
        COUNCIL_PATTERNS.some(
            pattern => pattern.regex.test(identityText)
        )
    ) {
        politicalBoundaryScore += 5;
    }


    if (
        ALDERMANIC_PATTERNS.some(
            pattern => pattern.regex.test(identityText)
        )
    ) {
        politicalBoundaryScore += 5;
    }


    if (
        MUNICIPAL_PATTERNS.some(
            pattern => pattern.regex.test(identityText)
        )
    ) {
        politicalBoundaryScore += 5;
    }


    /*
     * Polygon geometry is important, but not sufficient.
     */
    if (isPolygon) {
        politicalBoundaryScore += 2;
    }


    /*
     * District field is useful evidence, but deliberately weak.
     *
     * This prevents:
     *
     * LaDoceFocusNeighborhoods
     * TPRD_GOLF
     * Tree Equity Score
     *
     * from becoming ward boundaries simply because they
     * contain a WARD field.
     */
    if (politicalDistrictField) {
        politicalBoundaryScore += 1;
    }


    /*
     * Name field provides some additional evidence.
     */
    if (hasNameField) {
        politicalBoundaryScore += 1;
    }


    /*
     * Official source increases confidence.
     */
    if (officialMunicipalSource) {
        politicalBoundaryScore += 1;
    }


    /*
     * Strong negative evidence.
     */
    if (isCensusDataset) {
        politicalBoundaryScore -= 5;
    }


    if (isParcelDataset) {
        politicalBoundaryScore -= 5;
    }


    if (isHousingDataset) {
        politicalBoundaryScore -= 2;
    }


    /*
     * Thematic evidence is a moderate negative signal.
     *
     * It should not automatically destroy a genuine boundary,
     * because descriptions can contain unrelated thematic words.
     */
    if (thematicEvidence) {
        politicalBoundaryScore -= 2;
    }


    // -------------------------------------------------------------------------
    // Political boundary decision
    // -------------------------------------------------------------------------

    /*
     * Require strong evidence.
     *
     * A candidate must:
     *
     * 1. Be polygon geometry
     * 2. Have a plausible political district field OR
     *    explicit political district terminology
     * 3. Reach the confidence threshold
     */
    const isPoliticalBoundary =
        isPolygon &&
        politicalBoundaryScore >= 6 &&
        (
            politicalDistrictField ||
            districtType !== undefined
        );


    // -------------------------------------------------------------------------
    // Boundary layer
    // -------------------------------------------------------------------------

    /*
     * "Boundary layer" should mean an actual political boundary,
     * not simply any polygon.
     */
    const isBoundaryLayer =
        isPoliticalBoundary;


    if (isBoundaryLayer) {
        matches.boundary.push(
            "political boundary"
        );
    }


    // -------------------------------------------------------------------------
    // Thematic classification
    // -------------------------------------------------------------------------

    const isThematicDataset =
        thematicEvidence &&
        !isPoliticalBoundary;


    // -------------------------------------------------------------------------
    // Rejection
    // -------------------------------------------------------------------------

    let rejected = false;


    /*
     * Non-polygons cannot be used as municipal district boundaries.
     */
    if (!isPolygon) {
        rejected = true;
    }


    /*
     * Census datasets are not municipal district boundaries.
     */
    if (isCensusDataset) {
        rejected = true;
    }


    /*
     * Parcel/property datasets are not municipal district boundaries.
     */
    if (isParcelDataset) {
        rejected = true;
    }


    /*
     * Housing datasets are not municipal district boundaries.
     */
    if (isHousingDataset && !isPoliticalBoundary) {
        rejected = true;
    }


    /*
     * A layer containing WARD/DISTRICT fields is not enough.
     */
    if (
        hasDistrictField &&
        !politicalDistrictField &&
        !isPoliticalBoundary
    ) {
        rejected = true;
    }


    /*
     * Final safety check.
     *
     * Only strong political-boundary candidates survive.
     */
    if (!isPoliticalBoundary) {
        rejected = true;
    }

    // -------------------------------------------------------------------------
    // Manual review
    // -------------------------------------------------------------------------

    const requiresReview =
        isPoliticalBoundary &&
        (
            politicalBoundaryScore < 8 ||
            !officialMunicipalSource ||
            !inspection.districtField ||
            !districtType
        );


    // -------------------------------------------------------------------------
    // Return
    // -------------------------------------------------------------------------

    return {

        isBoundaryLayer,
        isPoliticalBoundary,
        isThematicDataset,
        isCensusDataset,
        isParcelDataset,
        isHousingDataset,
        officialMunicipalSource,
        districtType,
        rejected,
        requiresReview,
        matches
    };
}