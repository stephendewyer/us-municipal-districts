import type {
    CandidateClassification,
    ClassificationMatches,
    DistrictType,
    DiscoveryCandidate,
    ArcGISInspection,
    SourceRole,
    TemporalStatus
} from "./types.js";

// =============================================================================
// Helpers
// =============================================================================

function normalize(value: string | undefined): string {
    return (value ?? "")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/([a-zA-Z])(\d+)/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .toLowerCase()
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
        regex: /\bstorm[-\s]?drains?\b/i
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
        regex: /\bairports?\b/i
    },
    {
        label: "parcel",
        regex: /\bparcels?\b/i
    }
];

const DERIVED_PATTERNS: Pattern[] = [
    {
        label: "aggregation",
        regex: /\baggregat(?:e|ed|ion)\b/i
    },
    {
        label: "intersection",
        regex: /\bintersect(?:ion|ed)?\b/i
    },
    {
        label: "summarization",
        regex: /\bsummar(?:y|ize|ized|ization)\b/i
    },
    {
        label: "analysis",
        regex: /\banalys(?:is|tics)\b/i
    },
    {
        label: "crime",
        regex: /\bcrimes?\b/i
    },
    {
        label: "eviction",
        regex: /\bevict(?:ion|ions)\b/i
    },
    {
        label: "business licenses",
        regex: /\bbusiness\s+licenses?\b/i
    },
    {
        label: "benchmarking",
        regex: /\bbenchmarking\b/i
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
        /\bwards?\b/i.test(normalized) ||
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
    return /\bward\b/i.test(normalize(value));
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

function escapeRegex(value: string): string {
    return value.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );
}

function isOfficialMunicipalSource(
    candidate: DiscoveryCandidate,
    inspection: ArcGISInspection
): boolean {
    const url = normalize(inspection.url);
    const candidateUrl = normalize(candidate.url);
    const serviceUrl = normalize(inspection.serviceUrl);
    const owner = normalize(inspection.owner);
    const organization = normalize(inspection.organization);
    const title = normalize(inspection.title);
    const serviceName = normalize(inspection.serviceName);
    const city = normalize(candidate.city);

    const text = [
        url,
        candidateUrl,
        serviceUrl,
        owner,
        organization,
        title,
        serviceName
    ]
        .filter(Boolean)
        .join(" ");

    /*
     * Explicit discovery provenance.
     */
    if (candidate.source === "municipal") {
        return true;
    }

    /*
     * Official government domains are strong evidence.
     */
    if (/\b[a-z0-9.-]+\.gov\b/i.test(text)) {
        return true;
    }

    /*
     * Explicit municipal organization identity.
     *
     * Examples:
     *
     *     City of Tucson
     *     Town of Example
     *     Village of Example
     *     Municipality of Example
     *
     * Requiring the candidate city prevents an unrelated municipal
     * organization from making the source official.
     */
    if (city) {
        const municipalityIdentity = new RegExp(
            `\\b(city|town|village|municipality)\\s+of\\s+${escapeRegex(city)}\\b`,
            "i"
        );

        if (
            municipalityIdentity.test(owner) ||
            municipalityIdentity.test(organization)
        ) {
            return true;
        }
    }

    /*
     * Municipal identity appearing in source metadata.
     */
    if (
        /\b(city|town|village|municipal)\b/i.test(
            `${owner} ${organization}`
        )
    ) {
        return true;
    }

    /*
     * Explicit Tucson/Pima government-source handling.
     */
    if (
        /tucsonaz\.gov/i.test(text) ||
        /gis\.tucsonaz\.gov/i.test(text) ||
        /mapdata\.tucsonaz\.gov/i.test(text) ||
        /gisdata\.pima\.gov/i.test(text) ||
        /pima\s+county/i.test(text)
    ) {
        return true;
    }

    return false;
}

// =============================================================================
// Temporal status
// =============================================================================

function detectTemporalStatus(
    identityText: string
): TemporalStatus {
    const currentYear = new Date().getFullYear();

    /*
     * Look for explicit four-digit years in the dataset identity.
     *
     * Examples:
     *
     *     Chicago Wards 2015
     *     Wards 2000
     *     TucsonWards2022
     *
     * normalize() converts TucsonWards2022 to
     * "tucson wards 2022", so concatenated names are supported.
     */
    const years = [
        ...identityText.matchAll(
            /\b(?:19|20)\d{2}\b/g
        )
    ].map(
        match => Number(match[0])
    );

    /*
     * A year earlier than the current year is evidence that the
     * dataset represents an older boundary configuration.
     */
    if (
        years.some(
            year => year < currentYear
        )
    ) {
        return "historical";
    }

    /*
     * A current-year reference is evidence that the source is current.
     *
     * We deliberately do not assume that an undated dataset is current.
     */
    if (
        years.some(
            year => year === currentYear
        )
    ) {
        return "current";
    }

    return "undated";
}

// =============================================================================
// Source role
// =============================================================================

function detectSourceRole(
    candidate: DiscoveryCandidate,
    inspection: ArcGISInspection,
    explicitPoliticalIdentity: boolean,
    officialMunicipalSource: boolean,
    isPoliticalBoundary: boolean
): SourceRole {
    if (!isPoliticalBoundary) {
        return "unknown";
    }

    const identityText = [
        inspection.title,
        candidate.title,
        inspection.serviceName,
        inspection.layerName
    ]
        .filter(Boolean)
        .map(normalize)
        .join(" ");

    const datasetText = [
        inspection.description,
        inspection.serviceDescription,
        ...(inspection.tags ?? []),
        ...(inspection.typeKeywords ?? [])
    ]
        .filter(Boolean)
        .map(normalize)
        .join(" ");

    /*
     * Historical status is intentionally NOT represented by sourceRole.
     *
     * A source can be:
     *
     *     authoritative + historical
     *
     * or:
     *
     *     authoritative + current
     *
     * Temporal status is calculated separately.
     */

    /*
     * Derived datasets may contain perfectly valid political geometry,
     * but they are not necessarily the primary boundary source.
     */
    const derivedMatches =
        findMatches(
            datasetText,
            DERIVED_PATTERNS
        );

    if (
        derivedMatches.length > 0
    ) {
        return "derived";
    }

    /*
     * An official municipal source with explicit political identity
     * is our strongest initial authority signal.
     */
    if (
        officialMunicipalSource &&
        explicitPoliticalIdentity
    ) {
        return "authoritative";
    }

    return "unknown";
}

// =============================================================================
// Main classifier
// =============================================================================

export function classifyCandidate(
    candidate: DiscoveryCandidate,
    inspection: ArcGISInspection
): CandidateClassification {
    const title =
        normalize(
            inspection.title
        );

    const serviceName =
        normalize(
            inspection.serviceName
        );

    const layerName =
        normalize(
            inspection.layerName
        );

    const description =
        normalize(
            inspection.description
        );

    const serviceDescription =
        normalize(
            inspection.serviceDescription
        );

    const url =
        normalize(
            inspection.url
        );

    const candidateTitle =
        normalize(
            candidate.title
        );

    const searchQuery =
        normalize(
            candidate.searchQuery
        );

    const fields =
        inspection.fields ?? [];

    const fieldNames =
        fields
            .map(
                field =>
                    normalize(field.name)
            )
            .filter(Boolean);

    const fieldAliases =
        fields
            .map(
                field =>
                    normalize(field.alias)
            )
            .filter(Boolean);

    const fieldText = [
        ...fieldNames,
        ...fieldAliases
    ].join(" ");

    // =========================================================================
    // Dataset identity
    // =========================================================================

    /*
     * Identity text describes what the dataset actually IS.
     *
     * Search-query text is deliberately excluded.
     */
    const identityText = [
        title,
        candidateTitle,
        serviceName,
        layerName
    ]
        .filter(Boolean)
        .join(" ");

    /*
     * Political identity is deliberately based only on the dataset's
     * actual identity. Search-query evidence cannot manufacture
     * political identity.
     */
    const politicalIdentityText =
        identityText;

    /*
     * Dataset metadata is used for thematic/census/parcel/housing
     * classification.
     */
    const datasetText = [
        description,
        serviceDescription,
        fieldText
    ]
        .filter(Boolean)
        .join(" ");

    /*
     * Discovery text is weaker evidence and is only used for
     * broad political matching, not explicit political identity.
     */
    const discoveryText = [
        searchQuery,
        url
    ]
        .filter(Boolean)
        .join(" ");

    const politicalSearchableText = [
        identityText,
        datasetText,
        discoveryText
    ]
        .filter(Boolean)
        .join(" ");

    /*
     * Negative dataset classification intentionally excludes
     * search-query and URL evidence.
     */
    const datasetClassificationText = [
        identityText,
        datasetText
    ]
        .filter(Boolean)
        .join(" ");

    // =========================================================================
    // Matches
    // =========================================================================

    const matches: ClassificationMatches = {
        thematic:
            findMatches(
                datasetClassificationText,
                THEMATIC_PATTERNS
            ),

        census:
            findMatches(
                datasetClassificationText,
                CENSUS_PATTERNS
            ),

        parcel:
            findMatches(
                datasetClassificationText,
                PARCEL_PATTERNS
            ),

        housing:
            findMatches(
                datasetClassificationText,
                HOUSING_PATTERNS
            ),

        political:
            findMatches(
                politicalSearchableText,
                POLITICAL_PATTERNS
            ),

        boundary: [],

        official: []
    };

    /*
     * Non-political district identities are based on dataset
     * identity/metadata rather than search-query evidence.
     */
    const nonPoliticalMatches =
        findMatches(
            datasetClassificationText,
            NON_POLITICAL_PATTERNS
        );

    // =========================================================================
    // Official source
    // =========================================================================

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

    // =========================================================================
    // Geometry
    // =========================================================================

    const geometryType =
        normalize(
            inspection.geometryType
        );

    const isPolygon =
        geometryType === "esri geometry polygon" ||
        geometryType === "polygon";

    // =========================================================================
    // Fields
    // =========================================================================

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

    const hasWardField =
        allDistrictFields.some(
            isWardField
        );

    const hasPoliticalField =
        politicalFieldNames.length > 0;

    const hasDistrictField =
        districtFields.length > 0 ||
        allDistrictFields.length > 0;

    const genericDistrictField =
        allDistrictFields.some(
            isGenericDistrictField
        );

    const politicalIdentityMatches =
        findMatches(
            politicalIdentityText,
            POLITICAL_PATTERNS
        );

    /*
     * Explicit political identity means the dataset itself is identifiable
     * as political through its title, service name, or layer name.
     *
     * A field named WARD does not establish explicitPoliticalIdentity.
     */
    const explicitPoliticalIdentity =
        politicalIdentityMatches.length > 0;

    const explicitNonPoliticalIdentity =
        nonPoliticalMatches.length > 0;

    // =========================================================================
    // Thematic-vs-political distinction
    // =========================================================================

    /*
     * A thematic layer can contain a political field without being
     * a political boundary.
     *
     * Example:
     *
     *     TPRD_GOLF
     *     field: WARD
     *
     * is not a ward boundary.
     *
     * Conversely:
     *
     *     Tucson Ward Boundaries
     *     field: WARD
     *
     * is a genuine political boundary.
     */
    const thematicAttributeLayer =
        matches.thematic.length > 0 &&
        !explicitPoliticalIdentity &&
        hasPoliticalField;

    /*
     * District type is inferred from political identity text,
     * not from a political field alone.
     */
    const districtType =
        detectDistrictType(
            politicalIdentityText
        );

    // =========================================================================
    // Temporal status
    // =========================================================================

    const temporalStatus =
        detectTemporalStatus(
            identityText
        );

    // =========================================================================
    // Acceptance rules
    // =========================================================================

    /*
     * Rule 1:
     *
     * Polygon + explicit political identity.
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
     * Thematic layers with political fields are explicitly excluded.
     */
    const wardFieldPath =
        isPolygon &&
        hasWardField &&
        !explicitNonPoliticalIdentity &&
        !thematicAttributeLayer;

    /*
     * Rule 3:
     *
     * Polygon + political field.
     *
     * Thematic attribute layers are excluded.
     */
    const politicalFieldPath =
        isPolygon &&
        hasPoliticalField &&
        !explicitNonPoliticalIdentity &&
        !thematicAttributeLayer;

    /*
     * Rule 4:
     *
     * Official municipal source + polygon + district field.
     */
    const officialDistrictPath =
        isPolygon &&
        officialMunicipalSource &&
        hasDistrictField &&
        !thematicAttributeLayer &&
        (
            hasPoliticalField ||
            hasWardField ||
            genericDistrictField ||
            explicitPoliticalIdentity
        );

    /*
     * Rule 5:
     *
     * Explicit political identity + generic DISTRICT field.
     */
    const politicalIdentityWithGenericField =
        isPolygon &&
        explicitPoliticalIdentity &&
        genericDistrictField &&
        !explicitNonPoliticalIdentity;

    /*
     * A candidate is political only if it passes one of the explicit
     * acceptance paths above.
     */
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

    // =========================================================================
    // Source role
    // =========================================================================

    const sourceRole =
        detectSourceRole(
            candidate,
            inspection,
            explicitPoliticalIdentity,
            officialMunicipalSource,
            isPoliticalBoundary
        );

    // =========================================================================
    // Boundary matches
    // =========================================================================

    if (isBoundaryLayer) {
        matches.boundary.push(
            "political boundary"
        );
    }

    // =========================================================================
    // Rejection reasons
    // =========================================================================

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
            `non-political district identity: ${nonPoliticalMatches.join(", ")}`
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

    /*
     * Diagnostic output for cases where a political field exists
     * but the dataset itself is not a political boundary.
     */
    if (
        hasPoliticalField &&
        !isPoliticalBoundary
    ) {
        rejectionReasons.push(
            "political field evidence does not establish the dataset as a political boundary"
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

    if (thematicAttributeLayer) {
        rejectionReasons.push(
            "political district field appears to be an attribute on a thematic layer rather than the layer's boundary identity"
        );
    }

    // =========================================================================
    // Review status
    // =========================================================================

    /*
     * Explicit political identity is stronger than field-only evidence.
     *
     * Field-only candidates remain reviewable because fields such as
     * WARD can occur on thematic datasets.
     */
    const requiresReview =
        isPoliticalBoundary &&
        (
            !officialMunicipalSource ||
            !explicitPoliticalIdentity ||
            !districtType
        );

    // =========================================================================
    // Return
    // =========================================================================

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

        sourceRole,

        temporalStatus,

        rejected:
            !isPoliticalBoundary,

        requiresReview,

        rejectionReasons,

        matches
    };
}