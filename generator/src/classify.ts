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
    return [...new Set(values.filter(Boolean))];
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

function matchesAny(
    text: string,
    patterns: Pattern[]
): boolean {
    return patterns.some(pattern => pattern.regex.test(text));
}

// =============================================================================
// Political identity
// =============================================================================

const WARD_PATTERNS: Pattern[] = [
    {
        label: "ward",
        regex: /\bwards?\b/i
    },
    {
        label: "ward boundary",
        regex: /\bward\s+boundar(?:y|ies)\b/i
    },
    {
        label: "ward map",
        regex: /\bward\s+maps?\b/i
    },
    {
        label: "city ward",
        regex: /\bcity\s+wards?\b/i
    },
    {
        label: "council ward",
        regex: /\bcouncil\s+wards?\b/i
    },
    {
        label: "ward cot",
        regex: /\bward\s+cot\b/i
    },
    {
        label: "wards cot",
        regex: /\bwards\s+cot\b/i
    }
];

const COUNCIL_PATTERNS: Pattern[] = [
    {
        label: "council district",
        regex: /\bcouncil\s+districts?\b/i
    },
    {
        label: "city council",
        regex: /\bcity\s+council\b/i
    },
    {
        label: "council ward",
        regex: /\bcouncil\s+wards?\b/i
    },
    {
        label: "council boundary",
        regex: /\bcouncil\s+boundar(?:y|ies)\b/i
    },
    {
        label: "council map",
        regex: /\bcouncil\s+maps?\b/i
    }
];

const ALDERMANIC_PATTERNS: Pattern[] = [
    {
        label: "aldermanic",
        regex: /\baldermanic\b/i
    },
    {
        label: "alderman",
        regex: /\balderman\b|\baldermen\b/i
    },
    {
        label: "aldermanic district",
        regex: /\baldermanic\s+districts?\b/i
    },
    {
        label: "aldermanic ward",
        regex: /\baldermanic\s+wards?\b/i
    }
];

const MUNICIPAL_PATTERNS: Pattern[] = [
    {
        label: "municipal district",
        regex: /\bmunicipal\s+districts?\b/i
    },
    {
        label: "municipal boundary",
        regex: /\bmunicipal\s+boundar(?:y|ies)\b/i
    },
    {
        label: "municipal ward",
        regex: /\bmunicipal\s+wards?\b/i
    }
];

const ELECTION_PATTERNS: Pattern[] = [
    {
        label: "election district",
        regex: /\belection\s+districts?\b/i
    },
    {
        label: "electoral district",
        regex: /\belectoral\s+districts?\b/i
    },
    {
        label: "voting district",
        regex: /\bvoting\s+districts?\b/i
    },
    {
        label: "voting precinct",
        regex: /\bvoting\s+precincts?\b/i
    }
];

const POLITICAL_PATTERNS: Pattern[] = [
    ...WARD_PATTERNS,
    ...COUNCIL_PATTERNS,
    ...ALDERMANIC_PATTERNS,
    ...MUNICIPAL_PATTERNS,
    ...ELECTION_PATTERNS,

    {
        label: "political district",
        regex: /\bpolitical\s+districts?\b/i
    },

    {
        label: "legislative district",
        regex: /\blegislative\s+districts?\b/i
    }
];

// =============================================================================
// Explicitly non-political datasets
// =============================================================================

const NON_POLITICAL_PATTERNS: Pattern[] = [
    {
        label: "fire district",
        regex: /\bfire\s+districts?\b/i
    },
    {
        label: "school district",
        regex: /\bschool\s+districts?\b/i
    },
    {
        label: "maintenance district",
        regex: /\bmaintenance\s+districts?\b/i
    },
    {
        label: "tax district",
        regex: /\btax(?:ation)?\s+districts?\b/i
    },
    {
        label: "water district",
        regex: /\bwater\s+districts?\b/i
    },
    {
        label: "irrigation district",
        regex: /\birrigation\s+districts?\b/i
    },
    {
        label: "transit district",
        regex: /\btransit\s+districts?\b/i
    },
    {
        label: "historic district",
        regex: /\bhistoric\s+districts?\b/i
    },
    {
        label: "business district",
        regex: /\bbusiness\s+districts?\b/i
    },
    {
        label: "improvement district",
        regex: /\bimprovement\s+districts?\b/i
    },
    {
        label: "special district",
        regex: /\bspecial\s+districts?\b/i
    },
    {
        label: "assessment district",
        regex: /\bassessment\s+districts?\b/i
    },
    {
        label: "park district",
        regex: /\bpark\s+districts?\b/i
    },
    {
        label: "utility district",
        regex: /\butility\s+districts?\b/i
    },
    {
        label: "sanitary district",
        regex: /\bsanitary\s+districts?\b/i
    },
    {
        label: "reclamation district",
        regex: /\breclamation\s+districts?\b/i
    }
];

// =============================================================================
// Thematic datasets
// =============================================================================

const THEMATIC_PATTERNS: Pattern[] = [
    {
        label: "transit",
        regex: /\btransit\b/i
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
        label: "maintenance",
        regex: /\bmaintenance\b/i
    },
    {
        label: "road",
        regex: /\broads?\b/i
    },
    {
        label: "street",
        regex: /\bstreets?\b/i
    },
    {
        label: "sewer",
        regex: /\bsewers?\b/i
    },
    {
        label: "stormdrain",
        regex: /\bstormdrain\b/i
    },
    {
        label: "water",
        regex: /\bwater\b/i
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
        label: "park",
        regex: /\bparks?\b/i
    },
    {
        label: "school",
        regex: /\bschools?\b/i
    },
    {
        label: "project",
        regex: /\bprojects?\b/i
    },
    {
        label: "airport",
        regex: /\bairport\b/i
    },
    {
        label: "parcel",
        regex: /\bparcels?\b/i
    }
];

// =============================================================================
// Census
// =============================================================================

const CENSUS_PATTERNS: Pattern[] = [
    {
        label: "census",
        regex: /\bcensus\b/i
    },
    {
        label: "block group",
        regex: /\bblock\s+groups?\b/i
    },
    {
        label: "census tract",
        regex: /\bcensus\s+tracts?\b/i
    },
    {
        label: "tract",
        regex: /\btracts?\b/i
    }
];

// =============================================================================
// Parcel
// =============================================================================

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
    }
];

// =============================================================================
// Housing
// =============================================================================

const HOUSING_PATTERNS: Pattern[] = [
    {
        label: "housing",
        regex: /\bhousing\b/i
    },
    {
        label: "residential",
        regex: /\bresidential\b/i
    },
    {
        label: "households",
        regex: /\bhouseholds?\b/i
    }
];

// =============================================================================
// Political field detection
// =============================================================================

function isPoliticalField(
    value?: string
): boolean {
    const normalized = normalize(value);

    if (!normalized) {
        return false;
    }

    return (
        /\bward\b/i.test(normalized) ||
        /\bcouncil\b/i.test(normalized) ||
        /\balderman/i.test(normalized) ||
        /\bmunicipal\s+district\b/i.test(normalized) ||
        /\bpolitical\s+district\b/i.test(normalized) ||
        /\belection\s+district\b/i.test(normalized) ||
        /\belectoral\s+district\b/i.test(normalized) ||
        /\bvoting\s+district\b/i.test(normalized) ||
        /\bvoting\s+precinct\b/i.test(normalized)
    );
}

function isGenericDistrictField(
    value?: string
): boolean {
    const normalized = normalize(value);

    return (
        /\bdistrict\b/i.test(normalized) &&
        !isPoliticalField(normalized)
    );
}

function isWardField(
    value?: string
): boolean {
    return /\bward\b/i.test(
        normalize(value)
    );
}

// =============================================================================
// District type
// =============================================================================

function detectDistrictType(
    text: string
): DistrictType | undefined {

    if (
        matchesAny(
            text,
            WARD_PATTERNS
        )
    ) {
        return "ward";
    }

    if (
        matchesAny(
            text,
            COUNCIL_PATTERNS
        )
    ) {
        return "council-district";
    }

    if (
        matchesAny(
            text,
            ALDERMANIC_PATTERNS
        )
    ) {
        return "aldermanic-district";
    }

    if (
        matchesAny(
            text,
            MUNICIPAL_PATTERNS
        )
    ) {
        return "municipal-district";
    }

    if (
        matchesAny(
            text,
            ELECTION_PATTERNS
        )
    ) {
        return "municipal-district";
    }

    return undefined;
}

// =============================================================================
// Official municipal source
// =============================================================================

function isOfficialMunicipalSource(
    candidate: DiscoveryCandidate,
    inspection: ArcGISInspection
): boolean {

    const url = normalize(
        inspection.url
    );

    const candidateUrl = normalize(
        candidate.url
    );

    const text = [
        url,
        candidateUrl,
        normalize(inspection.owner),
        normalize(inspection.organization),
        normalize(inspection.title),
        normalize(inspection.serviceName)
    ].join(" ");

    return (
        candidate.source === "municipal" ||
        /\b(city|town|village|municipal)\b/i.test(text) ||
        /\.gov\b/i.test(text) ||
        /tucsonaz\.gov/i.test(text) ||
        /gis\.tucsonaz\.gov/i.test(text) ||
        /mapdata\.tucsonaz\.gov/i.test(text) ||
        /gisdata\.pima\.gov/i.test(text) ||
        /pima\s+county/i.test(text)
    );
}

// =============================================================================
// Main classifier
// =============================================================================

export function classifyCandidate(
    candidate: DiscoveryCandidate,
    inspection: ArcGISInspection
): CandidateClassification {

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

    const serviceDescription = normalize(
        inspection.serviceDescription
    );

    const url = normalize(
        inspection.url
    );

    const candidateTitle = normalize(
        candidate.title
    );

    const searchQuery = normalize(
        candidate.searchQuery
    );

    const fields =
        inspection.fields ?? [];

    const fieldNames = fields
        .map(field => normalize(field.name))
        .filter(Boolean);

    const fieldAliases = fields
        .map(field => normalize(field.alias))
        .filter(Boolean);

    const fieldText = [
        ...fieldNames,
        ...fieldAliases
    ].join(" ");

    const identityText = [
        title,
        candidateTitle,
        serviceName,
        layerName
    ]
        .filter(Boolean)
        .join(" ");

    const metadataText = [
        description,
        serviceDescription,
        fieldText,
        searchQuery
    ]
        .filter(Boolean)
        .join(" ");

    const searchableText = [
        identityText,
        metadataText,
        url
    ]
        .filter(Boolean)
        .join(" ");

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

    const nonPoliticalMatches =
        findMatches(
            searchableText,
            NON_POLITICAL_PATTERNS
        );

    const officialMunicipalSource =
        isOfficialMunicipalSource(
            candidate,
            inspection
        );

    if (
        officialMunicipalSource
    ) {
        matches.official.push(
            "official municipal source"
        );
    }

    const isPolygon =
        inspection.geometryType ===
            "esriGeometryPolygon" ||
        inspection.geometryType ===
            "polygon";

    const districtFields =
        inspection.districtFields ?? [];

    const nameFields =
        inspection.nameFields ?? [];

    const allDistrictFields =
        unique([
            ...districtFields,
            ...fieldNames.filter(
                field =>
                    isPoliticalField(field) ||
                    isGenericDistrictField(field) ||
                    isWardField(field)
            )
        ]);

    const politicalFieldNames =
        unique([
            ...fieldNames.filter(
                isPoliticalField
            ),
            ...fieldAliases.filter(
                isPoliticalField
            )
        ]);

    const wardField =
        allDistrictFields.some(
            isWardField
        );

    const councilField =
        allDistrictFields.some(
            field =>
                /\bcouncil\b/i.test(
                    field
                )
        );

    const genericDistrictField =
        allDistrictFields.some(
            isGenericDistrictField
        );

    const explicitPoliticalIdentity =
        matches.political.length > 0;

    const nonPoliticalIdentity =
        findMatches(
            identityText,
            NON_POLITICAL_PATTERNS
        );

    const explicitNonPoliticalIdentity =
        nonPoliticalIdentity.length > 0;

    const hasPoliticalField =
        politicalFieldNames.length > 0;

    const hasWardField =
        wardField;

    const hasDistrictField =
        districtFields.length > 0 ||
        allDistrictFields.length > 0;

    const districtType =
        detectDistrictType(
            identityText
        ) ??
        detectDistrictType(
            metadataText
        ) ??
        (
            hasWardField
                ? "ward"
                : councilField
                    ? "council-district"
                    : undefined
        );

    // =========================================================================
    // Structural evidence
    // =========================================================================

    let score = 0;

    if (isPolygon) {
        score += 30;
    }

    if (explicitPoliticalIdentity) {
        score += 40;
    }

    if (hasPoliticalField) {
        score += 35;
    }

    if (hasWardField) {
        score += 25;
    }

    if (councilField) {
        score += 20;
    }

    if (genericDistrictField) {
        score += 10;
    }

    if (hasDistrictField) {
        score += 10;
    }

    if (nameFields.length > 0) {
        score += 5;
    }

    if (officialMunicipalSource) {
        score += 15;
    }

    // =========================================================================
    // Negative evidence
    // =========================================================================

    if (
        matches.parcel.length > 0 &&
        !hasPoliticalField &&
        !hasWardField
    ) {
        score -= 35;
    }

    if (
        matches.census.length > 0 &&
        !explicitPoliticalIdentity &&
        !hasPoliticalField
    ) {
        score -= 25;
    }

    if (
        explicitNonPoliticalIdentity &&
        !explicitPoliticalIdentity &&
        !hasPoliticalField &&
        !hasWardField
    ) {
        score -= 50;
    }

    // Thematic terms are weak negative evidence only.
    if (
        matches.thematic.length > 0 &&
        !explicitPoliticalIdentity &&
        !hasPoliticalField &&
        !hasWardField
    ) {
        score -= 10;
    }

    // =========================================================================
    // Acceptance rules
    // =========================================================================

    /*
     * Rule 1:
     *
     * Polygon + explicit political identity.
     *
     * This is the cleanest discovery case.
     */
    const explicitIdentityPath =
        isPolygon &&
        explicitPoliticalIdentity &&
        !explicitNonPoliticalIdentity;

    /*
     * Rule 2:
     *
     * Polygon + WARD field.
     *
     * This is extremely important for real-world municipal GIS.
     *
     * Example:
     *
     *     WARD_COT
     *     WARD
     *     Ward
     *
     * The layer title does not always contain "city council".
     */
    const wardFieldPath =
        isPolygon &&
        hasWardField &&
        !explicitNonPoliticalIdentity;

    /*
     * Rule 3:
     *
     * Polygon + political field.
     */
    const politicalFieldPath =
        isPolygon &&
        hasPoliticalField &&
        !explicitNonPoliticalIdentity;

    /*
     * Rule 4:
     *
     * Official municipal source + polygon + district field.
     */
    const officialDistrictPath =
        isPolygon &&
        officialMunicipalSource &&
        hasDistrictField &&
        (
            hasPoliticalField ||
            hasWardField ||
            genericDistrictField ||
            explicitPoliticalIdentity
        );

    /*
     * Rule 5:
     *
     * Some municipal datasets have a generic DISTRICT field but
     * an unmistakably political layer title.
     */
    const politicalIdentityWithGenericField =
        isPolygon &&
        explicitPoliticalIdentity &&
        genericDistrictField &&
        !explicitNonPoliticalIdentity;

    const isPoliticalBoundary =
        explicitIdentityPath ||
        wardFieldPath ||
        politicalFieldPath ||
        officialDistrictPath ||
        politicalIdentityWithGenericField;

    const isBoundaryLayer =
        isPoliticalBoundary;

    const isThematicDataset =
        matches.thematic.length > 0 &&
        !isPoliticalBoundary;

    if (isBoundaryLayer) {
        matches.boundary.push(
            "political boundary"
        );
    }

    const rejectionReasons: string[] = [];

    if (!isPolygon) {
        rejectionReasons.push(
            "not polygon geometry"
        );
    }

    if (
        matches.census.length > 0 &&
        !isPoliticalBoundary
    ) {
        rejectionReasons.push(
            `census dataset: ${matches.census.join(", ")}`
        );
    }

    if (
        matches.parcel.length > 0 &&
        !isPoliticalBoundary
    ) {
        rejectionReasons.push(
            `parcel/property dataset: ${matches.parcel.join(", ")}`
        );
    }

    if (
        explicitNonPoliticalIdentity &&
        !isPoliticalBoundary
    ) {
        rejectionReasons.push(
            `non-political district identity: ${nonPoliticalIdentity.join(", ")}`
        );
    }

    if (
        !explicitPoliticalIdentity &&
        !hasPoliticalField &&
        !hasWardField &&
        !officialDistrictPath
    ) {
        rejectionReasons.push(
            "no strong political identity or field evidence"
        );
    }

    if (!isPoliticalBoundary) {
        rejectionReasons.push(
            `political evidence score: ${score}`
        );
    }

    if (
        matches.thematic.length > 0 &&
        !isPoliticalBoundary
    ) {
        rejectionReasons.push(
            `thematic evidence: ${matches.thematic.join(", ")}`
        );
    }

    /*
     * Explicit political identity is high confidence.
     *
     * Field-based matches should remain reviewable.
     */
    const requiresReview =
        isPoliticalBoundary &&
        (
            !officialMunicipalSource ||
            !explicitPoliticalIdentity ||
            !districtType
        );

    return {
        isBoundaryLayer,

        isPoliticalBoundary,

        isThematicDataset,

        isCensusDataset:
            matches.census.length > 0,

        isParcelDataset:
            matches.parcel.length > 0,

        isHousingDataset:
            matches.housing.length > 0,

        officialMunicipalSource,

        districtType,

        rejected:
            !isPoliticalBoundary,

        requiresReview,

        rejectionReasons,

        matches
    };
}