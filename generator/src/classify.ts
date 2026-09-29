import type {
    CandidateClassification,
    ClassificationMatches,
    DistrictType,
    DiscoveryCandidate,
    ArcGISInspection,
    PublisherLevel,
    SourceRole,
    TemporalStatus
} from "./types.js";

import {
    MUNICIPAL_ARCGIS_AUTHORITIES
} from "./municipalArcGISAuthorities.js";

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

const NON_MUNICIPAL_POLITICAL_PATTERNS: Pattern[] = [
    {
        label: "legislative district",
        regex: /\blegislative\s+districts?\b/i
    },
    {
        label: "congressional district",
        regex: /\bcongressional\s+districts?\b/i
    },
    {
        label: "state senate district",
        regex: /\bstate\s+senate\s+districts?\b/i
    },
    {
        label: "state house district",
        regex: /\bstate\s+house\s+districts?\b/i
    },
    {
        label: "state assembly district",
        regex: /\bstate\s+assembly\s+districts?\b/i
    },
    {
        label: "assembly district",
        regex: /\bassembly\s+districts?\b/i
    }
];

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
            CITY_COUNCIL_PATTERNS
        )
    ) {
        return "council-district";
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
// Publisher level
// =============================================================================

function detectPublisherLevel(
    candidate: DiscoveryCandidate,
    inspection: ArcGISInspection
): PublisherLevel {

    const owner =
        normalize(
            inspection.owner
        );

    const organization =
        normalize(
            inspection.organization
        );

    const organizationText =
        `${owner} ${organization}`;

    const url =
        normalize(
            inspection.url
        );

    const serviceUrl =
        normalize(
            inspection.serviceUrl
        );

    const text = [
        organizationText,
        url,
        serviceUrl,
        normalize(candidate.url)
    ]
        .filter(Boolean)
        .join(" ");

    if (
        candidate.source ===
        "municipal"
    ) {
        return "municipal";
    }

    if (
        /\b(city|town|village|municipality)\b/i.test(
            organizationText
        )
    ) {
        return "municipal";
    }

    if (
        /\bcounty\b/i.test(
            text
        )
    ) {
        return "county";
    }

    if (
        /\b(state|department\s+of)\b/i.test(
            text
        )
    ) {
        return "state";
    }

    if (
        /\bfederal\b/i.test(
            text
        ) ||
        /\b[a-z0-9.-]+\.gov\b/i.test(text) &&
        /\b(census|federal)\b/i.test(text)
    ) {
        return "federal";
    }

    return "unknown";
}

// =============================================================================
// Municipal authority
// =============================================================================

function escapeRegex(
    value: string
): string {
    return value.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );
}

function matchesKnownMunicipalAuthority(
    city: string | undefined,
    state: string | undefined,
    organizationId: string | undefined
): boolean {

    if (
        !city ||
        !state ||
        !organizationId
    ) {
        return false;
    }

    const normalizedCity =
        normalize(city);

    const normalizedState =
        normalize(state);

    return MUNICIPAL_ARCGIS_AUTHORITIES.some(
        authority =>
            normalize(
                authority.city
            ) === normalizedCity &&
            normalize(
                authority.state
            ) === normalizedState &&
            authority.organizationId ===
                organizationId
    );
}

// =============================================================================
// Official municipal source
// =============================================================================

function isOfficialMunicipalSource(
    candidate: DiscoveryCandidate,
    inspection: ArcGISInspection
): boolean {

    const city =
        normalize(
            candidate.city
        );

    const state =
        normalize(
            candidate.state
        );

    // -------------------------------------------------------------------------
    // Portal / discovery provenance
    // -------------------------------------------------------------------------

    const owner =
        normalize(
            candidate.owner ??
            inspection.owner
        );

    const organizationId =
        candidate.organizationId ??
        inspection.organizationId;

    const organization =
        normalize(
            inspection.organization
        );

    const description = [
        candidate.description,
        inspection.description
    ]
        .map(normalize)
        .filter(Boolean)
        .join(" ");

    const serviceDescription =
        normalize(
            inspection.serviceDescription
        );

    const snippet =
        normalize(
            candidate.snippet
        );

    const accessInformation =
        normalize(
            candidate.accessInformation
        );

    const tags =
        (candidate.tags ?? [])
            .map(normalize)
            .join(" ");

    const typeKeywords =
        (candidate.typeKeywords ?? [])
            .map(normalize)
            .join(" ");

    // -------------------------------------------------------------------------
    // URL provenance
    // -------------------------------------------------------------------------

    const url =
        normalize(
            inspection.url
        );

    const serviceUrl =
        normalize(
            inspection.serviceUrl
        );

    const candidateUrl =
        normalize(
            candidate.url
        );

    const provenanceText = [
        owner,
        organization,
        description,
        serviceDescription,
        snippet,
        accessInformation,
        tags,
        typeKeywords
    ]
        .filter(Boolean)
        .join(" ");

    const sourceText = [
        url,
        serviceUrl,
        candidateUrl,
        owner,
        organization
    ]
        .filter(Boolean)
        .join(" ");

    // -------------------------------------------------------------------------
    // 1. Explicit discovery provenance
    // -------------------------------------------------------------------------

    if (
        candidate.source ===
        "municipal"
    ) {
        return true;
    }

    // -------------------------------------------------------------------------
    // 2. Known municipal ArcGIS organization
    // -------------------------------------------------------------------------

    if (
        matchesKnownMunicipalAuthority(
            city,
            state,
            organizationId
        )
    ) {
        return true;
    }

    // -------------------------------------------------------------------------
    // 3. Municipal Portal owner
    //
    // Example:
    //
    //     City_of_Phoenix
    //     City_of_Tucson
    //     Town_of_Gilbert
    //
    // normalize() converts underscores/hyphens into spaces, so the
    // comparison becomes:
    //
    //     city of phoenix
    //
    // -------------------------------------------------------------------------

    if (
        city &&
        owner
    ) {
        const municipalOwnerPattern =
            new RegExp(
                `\\b(?:city|town|village|municipality)\\s+of\\s+${escapeRegex(city)}\\b`,
                "i"
            );

        if (
            municipalOwnerPattern.test(
                owner
            )
        ) {
            return true;
        }
    }

    // -------------------------------------------------------------------------
    // 4. Known municipal ArcGIS Enterprise host
    // -------------------------------------------------------------------------

    const authority =
        MUNICIPAL_ARCGIS_AUTHORITIES.find(
            item =>
                item.city === city &&
                item.state === state
        );

    if (
        authority?.hosts?.some(
            host =>
                sourceText.includes(
                    host.toLowerCase()
                )
        )
    ) {
        return true;
    }

    // -------------------------------------------------------------------------
    // 5. Explicit publisher / owner / maintainer evidence
    // -------------------------------------------------------------------------

    if (
        city
    ) {
        const municipality =
            `(?:city|town|village|municipality)\\s+of\\s+${escapeRegex(city)}`;

        const publisherPatterns = [
            new RegExp(
                `\\bpublished\\s+by\\s+(?:the\\s+)?${municipality}\\b`,
                "i"
            ),
            new RegExp(
                `\\bprovided\\s+by\\s+(?:the\\s+)?${municipality}\\b`,
                "i"
            ),
            new RegExp(
                `\\bmaintained\\s+by\\s+(?:the\\s+)?${municipality}\\b`,
                "i"
            ),
            new RegExp(
                `\\bowned\\s+by\\s+(?:the\\s+)?${municipality}\\b`,
                "i"
            ),
            new RegExp(
                `\\bcreated\\s+by\\s+(?:the\\s+)?${municipality}\\b`,
                "i"
            ),
            new RegExp(
                `\\bmanaged\\s+by\\s+(?:the\\s+)?${municipality}\\b`,
                "i"
            ),
            new RegExp(
                `\\bfrom\\s+(?:the\\s+)?${municipality}\\s+open\\s+data\\b`,
                "i"
            ),
            new RegExp(
                `\\b${municipality}\\s+open\\s+data\\s+portal\\b`,
                "i"
            )
        ];

        if (
            publisherPatterns.some(
                pattern =>
                    pattern.test(
                        provenanceText
                    )
            )
        ) {
            return true;
        }
    }

    // -------------------------------------------------------------------------
    // 6. Explicit municipal GIS / data portal identity
    // -------------------------------------------------------------------------

    if (
        city
    ) {
        const municipalPortal =
            new RegExp(
                `\\b${escapeRegex(city)}\\s+(?:open\\s+data|gis|gis\\s+data)\\s+portal\\b`,
                "i"
            );

        if (
            municipalPortal.test(
                provenanceText
            )
        ) {
            return true;
        }
    }

    /*
     * Deliberately do NOT treat:
     *
     *     .gov
     *     "City of Tucson" in a description
     *     "municipal"
     *     "government"
     *     a generic ArcGIS organization
     *
     * as sufficient evidence.
     */

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

    if (
        years.some(
            year =>
                year < currentYear
        )
    ) {
        return "historical";
    }

    if (
        years.some(
            year =>
                year === currentYear
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
    isPoliticalBoundary: boolean,
    derivedPoliticalDataset: boolean
): SourceRole {

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

    if (
        derivedMatches.length > 0
    ) {
        return "derived";
    }

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

    const identityText = [
        title,
        candidateTitle,
        serviceName,
        layerName
    ]
        .filter(Boolean)
        .join(" ");

    const politicalIdentityText =
        identityText;

    const datasetText = [
        description,
        serviceDescription,
        fieldText
    ]
        .filter(Boolean)
        .join(" ");

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

    const politicalIdentityMatches =
        findMatches(
            politicalIdentityText,
            POLITICAL_PATTERNS
        );

    const nonMunicipalPoliticalMatches =
        findMatches(
            politicalIdentityText,
            NON_MUNICIPAL_POLITICAL_PATTERNS
        );

    const explicitPoliticalIdentity =
        politicalIdentityMatches.length > 0;

    const nonPoliticalMatches =
        findMatches(
            identityText,
            NON_POLITICAL_PATTERNS
        );

    const explicitNonPoliticalIdentity =
        nonPoliticalMatches.length > 0;

    const explicitNonMunicipalPoliticalIdentity =
        nonMunicipalPoliticalMatches.length > 0;

    const isMunicipalPoliticalBoundary =
        explicitPoliticalIdentity &&
        !explicitNonMunicipalPoliticalIdentity;

    // =========================================================================
    // Publisher / provenance
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

    const publisherLevel =
        detectPublisherLevel(
            candidate,
            inspection
        );

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

    const thematicAttributeLayer =
        matches.thematic.length > 0 &&
        !explicitPoliticalIdentity &&
        hasPoliticalField;

    // =========================================================================
    // Derived political dataset detection
    // =========================================================================

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

    const explicitIdentityPath =
        isPolygon &&
        explicitPoliticalIdentity &&
        !explicitNonPoliticalIdentity &&
        !derivedPoliticalDataset;

    const wardFieldPath =
        isPolygon &&
        hasWardField &&
        !explicitNonPoliticalIdentity &&
        !thematicAttributeLayer &&
        !derivedPoliticalDataset;

    const politicalFieldPath =
        isPolygon &&
        hasPoliticalField &&
        !explicitNonPoliticalIdentity &&
        !thematicAttributeLayer &&
        !derivedPoliticalDataset;

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

    const politicalIdentityWithGenericField =
        isPolygon &&
        explicitPoliticalIdentity &&
        genericDistrictField &&
        !explicitNonPoliticalIdentity &&
        !derivedPoliticalDataset;

    const isPoliticalBoundary =
        explicitIdentityPath ||
        wardFieldPath ||
        politicalFieldPath ||
        officialDistrictPath ||
        politicalIdentityWithGenericField;

    const isBoundaryLayer =
        isMunicipalPoliticalBoundary;

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

    if (
        explicitNonMunicipalPoliticalIdentity &&
        !isMunicipalPoliticalBoundary
    ) {
        rejectionReasons.push(
            `non-municipal political boundary: ${nonMunicipalPoliticalMatches.join(", ")}`
        );
    }

    // =========================================================================
    // Review status
    // =========================================================================

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

        isMunicipalPoliticalBoundary,

        isThematicDataset,

        isCensusDataset:
            matches.census.length > 0,

        isParcelDataset:
            matches.parcel.length > 0,

        isHousingDataset:
            matches.housing.length > 0,

        officialMunicipalSource,

        publisherLevel,

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