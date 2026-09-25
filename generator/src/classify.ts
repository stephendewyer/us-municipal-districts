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

function normalize(
    value: string | undefined
): string {
    return (value ?? "")
        .replace(
            /([a-z])([A-Z])/g,
            "$1 $2"
        )
        .replace(
            /([a-zA-Z])(\d+)/g,
            "$1 $2"
        )
        .replace(
            /[_-]+/g,
            " "
        )
        .replace(
            /\s+/g,
            " "
        )
        .toLowerCase()
        .trim();
}

function unique(
    values: string[]
): string[] {
    return [
        ...new Set(
            values.filter(Boolean)
        )
    ];
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
            .filter(
                pattern =>
                    pattern.regex.test(text)
            )
            .map(
                pattern =>
                    pattern.label
            )
    );
}

function matchesAny(
    text: string,
    patterns: Pattern[]
): boolean {
    return patterns.some(
        pattern =>
            pattern.regex.test(text)
    );
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

const CITY_COUNCIL_PATTERNS: Pattern[] = [
    {
        label: "city council district",
        regex: /\bcity\s+council\s+districts?\b/i
    },
    {
        label: "city council",
        regex: /\bcity\s+council\b/i
    }
];

const COUNCIL_PATTERNS: Pattern[] = [
    {
        label: "council district",
        regex: /\bcouncil\s+districts?\b/i
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
    ...CITY_COUNCIL_PATTERNS,
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
    },
    {
        label: "eviction",
        regex: /\bevict(?:ion|ions)\b/i
    },
    {
        label: "filings",
        regex: /\bfilings?\b/i
    }
];

// =============================================================================
// Derived / analytical datasets
// =============================================================================

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
    },
    {
        label: "by district",
        regex: /\bby\s+(?:council\s+)?districts?\b/i
    },
    {
        label: "by ward",
        regex: /\bby\s+wards?\b/i
    },
    {
        label: "district aggregation",
        regex: /\bdistrict\s+aggregat/i
    },
    {
        label: "district statistics",
        regex: /\bdistrict\s+(?:statistics|stats)\b/i
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
        label: "census tract",
        regex: /\bcensus\s+tracts?\b/i
    },
    {
        label: "census block group",
        regex: /\bcensus\s+block\s+groups?\b/i
    },
    {
        label: "census block",
        regex: /\bcensus\s+blocks?\b/i
    },
    {
        label: "tabulation block",
        regex: /\btabulation\s+blocks?\b/i
    },
    {
        label: "TIGER/Line",
        regex: /\btiger(?:\/|\s+)line\b/i
    },
    {
        label: "ZCTA",
        regex: /\bzcta\b/i
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
    const normalized =
        normalize(value);

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
    const normalized =
        normalize(value);

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

    /*
     * Ward terminology takes precedence.
     */
    if (
        matchesAny(
            text,
            WARD_PATTERNS
        )
    ) {
        return "ward";
    }

    /*
     * City council terminology currently maps to the existing
     * council-district type.
     *
     * This preserves the project's existing DistrictType semantics
     * and keeps existing classification tests compatible.
     */
    if (
        matchesAny(
            text,
            CITY_COUNCIL_PATTERNS
        )
    ) {
        return "council-district";
    }

    /*
     * Generic council-district terminology.
     */
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

function escapeRegex(
    value: string
): string {
    return value.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );
}

function isOfficialMunicipalSource(
    candidate: DiscoveryCandidate,
    inspection: ArcGISInspection
): boolean {

    const url =
        normalize(
            inspection.url
        );

    const candidateUrl =
        normalize(
            candidate.url
        );

    const serviceUrl =
        normalize(
            inspection.serviceUrl
        );

    const owner =
        normalize(
            inspection.owner
        );

    const organization =
        normalize(
            inspection.organization
        );

    const title =
        normalize(
            inspection.title
        );

    const serviceName =
        normalize(
            inspection.serviceName
        );

    const city =
        normalize(
            candidate.city
        );

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
    if (
        candidate.source === "municipal"
    ) {
        return true;
    }

    /*
     * Government domain.
     *
     * This establishes government provenance, not necessarily
     * that the source is the municipality's own GIS.
     *
     * Municipality/geography validation remains responsible
     * for determining whether the geometry actually belongs
     * to the requested municipality.
     */
    if (
        /\b[a-z0-9.-]+\.gov\b/i.test(text)
    ) {
        return true;
    }

    /*
     * Explicit municipal organization identity.
     */
    if (city) {

        const municipalityIdentity =
            new RegExp(
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
     * Municipal identity in source metadata.
     */
    if (
        /\b(city|town|village|municipal)\b/i.test(
            `${owner} ${organization}`
        )
    ) {
        return true;
    }

    /*
     * Tucson/Pima government-source handling.
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

    const currentYear =
        new Date().getFullYear();

    const years = [
        ...identityText.matchAll(
            /\b(?:19|20)\d{2}\b/g
        )
    ].map(
        match =>
            Number(match[0])
    );

    /*
     * Any explicit prior year means historical.
     */
    if (
        years.some(
            year =>
                year < currentYear
        )
    ) {
        return "historical";
    }

    /*
     * An explicit current-year reference means current.
     */
    if (
        years.some(
            year =>
                year === currentYear
        )
    ) {
        return "current";
    }

    /*
     * Do not assume an undated source is current.
     */
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
    isPoliticalBoundary: boolean,
    derivedPoliticalDataset: boolean
): SourceRole {

    /*
     * A dataset can be a derived political dataset without
     * being a boundary layer.
     *
     * Example:
     *
     *     Eviction Filings by Council Districts
     *
     * This should be identifiable as derived rather than
     * simply "unknown".
     */
    if (
        derivedPoliticalDataset
    ) {
        return "derived";
    }

    if (
        !isPoliticalBoundary
    ) {
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

    const derivedMatches =
        findMatches(
            `${identityText} ${datasetText}`,
            DERIVED_PATTERNS
        );

    /*
     * A valid political boundary can still be a derived source.
     */
    if (
        derivedMatches.length > 0
    ) {
        return "derived";
    }

    /*
     * Official source + explicit political identity
     * is the strongest authority classification.
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
                    normalize(
                        field.name
                    )
            )
            .filter(Boolean);

    const fieldAliases =
        fields
            .map(
                field =>
                    normalize(
                        field.alias
                    )
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
     * Identity describes what the dataset itself is.
     *
     * Search-query terms and URLs are deliberately excluded.
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
     * Political identity is established from the dataset's
     * own identity, not from the search query that discovered it.
     */
    const politicalIdentityText =
        identityText;

    /*
     * Dataset metadata can provide additional thematic,
     * census, parcel, and housing evidence.
     */
    const datasetText = [
        description,
        serviceDescription,
        fieldText
    ]
        .filter(Boolean)
        .join(" ");

    /*
     * Discovery evidence is weaker.
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

        /*
        * Census classification describes what the dataset represents,
        * not whether the dataset happens to contain census-related
        * attributes.
        *
        * A political boundary may legitimately contain fields such as:
        *
        *     TRACT
        *     BLOCK
        *     ZCTA
        *     PRECINCT
        *
        * Those fields do not make the geometry a census dataset.
        *
        * Therefore census detection is based on dataset identity only.
        */
        census:
            findMatches(
                identityText,
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

    // =========================================================================
    // Identity classification
    // =========================================================================

    /*
     * IMPORTANT:
     *
     * Explicit political identity is based ONLY on identityText.
     *
     * This prevents a thematic dataset with a WARD/DISTRICT field
     * from becoming political merely because one of its attributes
     * happens to contain political terminology.
     */
    const politicalIdentityMatches =
        findMatches(
            politicalIdentityText,
            POLITICAL_PATTERNS
        );

    const explicitPoliticalIdentity =
        politicalIdentityMatches.length > 0;

    /*
     * Non-political identity is also based only on the dataset identity.
     *
     * A real political boundary may mention school districts,
     * water districts, etc. in its description or metadata.
     */
    const nonPoliticalMatches =
        findMatches(
            identityText,
            NON_POLITICAL_PATTERNS
        );

    const explicitNonPoliticalIdentity =
        nonPoliticalMatches.length > 0;

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
        geometryType ===
            "esri geometry polygon" ||
        geometryType ===
            "polygon";

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

    // =========================================================================
    // Thematic-vs-political distinction
    // =========================================================================

    /*
     * A thematic dataset can contain a political field without
     * being a political boundary.
     *
     * Example:
     *
     *     Golf Courses
     *     WARD
     *
     * is not a ward boundary.
     */
    const thematicAttributeLayer =
        matches.thematic.length > 0 &&
        !explicitPoliticalIdentity &&
        hasPoliticalField;

    // =========================================================================
    // Derived political dataset detection
    // =========================================================================

    /*
     * This is the critical Phoenix fix.
     *
     * A dataset such as:
     *
     *     Eviction Filings by Council Districts
     *
     * contains a legitimate political identity, but the political
     * districts are being used as an analytical/grouping dimension.
     *
     * It is NOT a boundary source.
     *
     * We deliberately detect this primarily from the dataset identity,
     * rather than arbitrary metadata, so descriptions of real boundary
     * layers do not accidentally cause rejection.
     */
    const identityDerivedMatches =
        findMatches(
            identityText,
            DERIVED_PATTERNS
        );

    const politicalGroupingIdentity =
        /\bby\s+(?:the\s+)?(?:city\s+)?(?:council\s+)?districts?\b/i.test(
            identityText
        ) ||
        /\bby\s+(?:the\s+)?wards?\b/i.test(
            identityText
        ) ||
        /\bdistrict\s+(?:aggregation|statistics|stats)\b/i.test(
            identityText
        ) ||
        /\b(?:aggregation|analysis|statistics|stats)\s+(?:by|for)\s+(?:the\s+)?(?:council\s+)?districts?\b/i.test(
            identityText
        );

    const derivedPoliticalDataset =
        explicitPoliticalIdentity &&
        identityDerivedMatches.length > 0 &&
        politicalGroupingIdentity;

    // =========================================================================
    // District type
    // =========================================================================

    /*
     * District type comes from political identity, not merely
     * from a field named WARD or DISTRICT.
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
     *
     * Derived analytical datasets are excluded.
     */
    const explicitIdentityPath =
        isPolygon &&
        explicitPoliticalIdentity &&
        !explicitNonPoliticalIdentity &&
        !derivedPoliticalDataset;

    /*
     * Rule 2:
     *
     * Polygon + WARD field.
     *
     * This supports sources whose title does not explicitly say
     * "ward" but whose validated field identifies the boundary.
     *
     * Thematic attribute layers and derived political datasets
     * are excluded.
     */
    const wardFieldPath =
        isPolygon &&
        hasWardField &&
        !explicitNonPoliticalIdentity &&
        !thematicAttributeLayer &&
        !derivedPoliticalDataset;

    /*
     * Rule 3:
     *
     * Polygon + political field.
     *
     * Thematic attribute layers and derived political datasets
     * are excluded.
     */
    const politicalFieldPath =
        isPolygon &&
        hasPoliticalField &&
        !explicitNonPoliticalIdentity &&
        !thematicAttributeLayer &&
        !derivedPoliticalDataset;

    /*
     * Rule 4:
     *
     * Official government/municipal source + polygon + district field.
     *
     * Official status is supportive evidence, not a requirement
     * for political-boundary classification.
     */
    const officialDistrictPath =
        isPolygon &&
        officialMunicipalSource &&
        hasDistrictField &&
        !thematicAttributeLayer &&
        !derivedPoliticalDataset &&
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
        !explicitNonPoliticalIdentity &&
        !derivedPoliticalDataset;

    /*
     * A candidate is a political boundary if it passes
     * at least one of the explicit paths.
     */
    const isPoliticalBoundary =
        explicitIdentityPath ||
        wardFieldPath ||
        politicalFieldPath ||
        officialDistrictPath ||
        politicalIdentityWithGenericField;

    const isBoundaryLayer =
        isPoliticalBoundary;

    /*
     * Derived political datasets are thematic by nature.
     *
     * Ordinary thematic layers are also marked thematic.
     */
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
            isPoliticalBoundary,
            derivedPoliticalDataset
        );

    // =========================================================================
    // Boundary matches
    // =========================================================================

    if (
        isBoundaryLayer
    ) {
        matches.boundary.push(
            "political boundary"
        );
    }

    // =========================================================================
    // Rejection reasons
    // =========================================================================

    const rejectionReasons: string[] = [];

    if (
        !isPolygon
    ) {
        rejectionReasons.push(
            "not polygon geometry"
        );
    }

    if (
        derivedPoliticalDataset
    ) {
        rejectionReasons.push(
            "derived political dataset uses municipal districts as an analytical or aggregation dimension rather than representing the district boundaries themselves"
        );

        if (
            identityDerivedMatches.length > 0
        ) {
            rejectionReasons.push(
                `derived identity evidence: ${identityDerivedMatches.join(", ")}`
            );
        }
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
        thematicAttributeLayer
    ) {
        rejectionReasons.push(
            "political district field appears to be an attribute on a thematic layer rather than the layer's boundary identity"
        );
    }

    if (
        hasPoliticalField &&
        !isPoliticalBoundary &&
        !thematicAttributeLayer &&
        !derivedPoliticalDataset
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

    // =========================================================================
    // Review status
    // =========================================================================

    /*
     * Review is relevant only for candidates that actually passed
     * political-boundary classification.
     *
     * Official municipal provenance is NOT required.
     */
    const requiresReview =
        isPoliticalBoundary &&
        (
            !officialMunicipalSource ||
            !explicitPoliticalIdentity ||
            !districtType
        );

    // =========================================================================
    // Debugging
    // =========================================================================

    console.log(
        "\nCLASSIFIER DEBUG:",
        {
            title,
            serviceName,
            layerName,

            identityText,

            explicitPoliticalIdentity,
            explicitNonPoliticalIdentity,

            hasPoliticalField,
            hasWardField,
            genericDistrictField,

            thematicAttributeLayer,
            derivedPoliticalDataset,

            politicalIdentityMatches,
            identityDerivedMatches,

            thematicMatches:
                matches.thematic,

            districtType,
            temporalStatus,
            officialMunicipalSource,

            isPolygon,
            isPoliticalBoundary,
            isThematicDataset,

            sourceRole
        }
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