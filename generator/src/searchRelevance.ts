import type {
    ArcGISSearchResult,
    CensusPlace,
    SearchRelevance
} from "./types.js";

// =============================================================================
// Configuration
// =============================================================================

/**
 * Minimum score required for a search result to continue through
 * ArcGIS item resolution.
 *
 * This is intentionally conservative. The purpose of this stage
 * is to eliminate obvious noise, not to make the final political
 * boundary decision.
 */
export const SEARCH_RELEVANCE_THRESHOLD = 10;


// =============================================================================
// Positive keywords
// =============================================================================

const POSITIVE_KEYWORDS: Array<{
    keyword: string;
    score: number;
    reason: string;
}> = [
    {
        keyword: "city council",
        score: 25,
        reason: 'contains "city council"'
    },
    {
        keyword: "council district",
        score: 30,
        reason: 'contains "council district"'
    },
    {
        keyword: "council districts",
        score: 30,
        reason: 'contains "council districts"'
    },
    {
        keyword: "ward",
        score: 25,
        reason: 'contains "ward"'
    },
    {
        keyword: "wards",
        score: 25,
        reason: 'contains "wards"'
    },
    {
        keyword: "aldermanic",
        score: 30,
        reason: 'contains "aldermanic"'
    },
    {
        keyword: "municipal district",
        score: 20,
        reason: 'contains "municipal district"'
    },
    {
        keyword: "municipal districts",
        score: 20,
        reason: 'contains "municipal districts"'
    },
    {
        keyword: "political district",
        score: 15,
        reason: 'contains "political district"'
    },
    {
        keyword: "political districts",
        score: 15,
        reason: 'contains "political districts"'
    },
    {
        keyword: "district boundary",
        score: 12,
        reason: 'contains "district boundary"'
    },
    {
        keyword: "district boundaries",
        score: 12,
        reason: 'contains "district boundaries"'
    },
    {
        keyword: "ward boundary",
        score: 15,
        reason: 'contains "ward boundary"'
    },
    {
        keyword: "ward boundaries",
        score: 15,
        reason: 'contains "ward boundaries"'
    },
    {
        keyword: "council boundary",
        score: 15,
        reason: 'contains "council boundary"'
    },
    {
        keyword: "council boundaries",
        score: 15,
        reason: 'contains "council boundaries"'
    },
    {
        keyword: "redistrict",
        score: 12,
        reason: 'contains "redistrict"'
    },
    {
        keyword: "redistricting",
        score: 12,
        reason: 'contains "redistricting"'
    }
];


// =============================================================================
// Negative keywords
// =============================================================================

const NEGATIVE_KEYWORDS: Array<{
    keyword: string;
    score: number;
    reason: string;
}> = [
    {
        keyword: "transit",
        score: -50,
        reason: 'contains "transit"'
    },
    {
        keyword: "bus route",
        score: -45,
        reason: 'contains "bus route"'
    },
    {
        keyword: "bus routes",
        score: -45,
        reason: 'contains "bus routes"'
    },
    {
        keyword: "road",
        score: -30,
        reason: 'contains "road"'
    },
    {
        keyword: "roads",
        score: -30,
        reason: 'contains "roads"'
    },
    {
        keyword: "street",
        score: -25,
        reason: 'contains "street"'
    },
    {
        keyword: "streets",
        score: -25,
        reason: 'contains "streets"'
    },
    {
        keyword: "parcel",
        score: -35,
        reason: 'contains "parcel"'
    },
    {
        keyword: "parcels",
        score: -35,
        reason: 'contains "parcels"'
    },
    {
        keyword: "property",
        score: -25,
        reason: 'contains "property"'
    },
    {
        keyword: "housing",
        score: -30,
        reason: 'contains "housing"'
    },
    {
        keyword: "school",
        score: -45,
        reason: 'contains "school"'
    },
    {
        keyword: "schools",
        score: -45,
        reason: 'contains "schools"'
    },
    {
        keyword: "park",
        score: -25,
        reason: 'contains "park"'
    },
    {
        keyword: "parks",
        score: -25,
        reason: 'contains "parks"'
    },
    {
        keyword: "tree",
        score: -30,
        reason: 'contains "tree"'
    },
    {
        keyword: "trees",
        score: -30,
        reason: 'contains "trees"'
    },
    {
        keyword: "crime",
        score: -30,
        reason: 'contains "crime"'
    },
    {
        keyword: "demographic",
        score: -25,
        reason: 'contains "demographic"'
    },
    {
        keyword: "demographics",
        score: -25,
        reason: 'contains "demographics"'
    },
    {
        keyword: "population",
        score: -20,
        reason: 'contains "population"'
    },
    {
        keyword: "utility",
        score: -25,
        reason: 'contains "utility"'
    },
    {
        keyword: "utilities",
        score: -25,
        reason: 'contains "utilities"'
    },
    {
        keyword: "water",
        score: -20,
        reason: 'contains "water"'
    },
    {
        keyword: "wastewater",
        score: -25,
        reason: 'contains "wastewater"'
    },
    {
        keyword: "groundwater",
        score: -30,
        reason: 'contains "groundwater"'
    },
    {
        keyword: "imagery",
        score: -25,
        reason: 'contains "imagery"'
    },
    {
        keyword: "aerial",
        score: -20,
        reason: 'contains "aerial"'
    },
    {
        keyword: "business",
        score: -20,
        reason: 'contains "business"'
    },
    {
        keyword: "businesses",
        score: -20,
        reason: 'contains "businesses"'
    },
    {
        keyword: "restaurant",
        score: -20,
        reason: 'contains "restaurant"'
    },
    {
        keyword: "zoning",
        score: -10,
        reason: 'contains "zoning"'
    },
    {
        keyword: "land use",
        score: -15,
        reason: 'contains "land use"'
    },
    {
        keyword: "fire station",
        score: -20,
        reason: 'contains "fire station"'
    },
    {
        keyword: "police",
        score: -20,
        reason: 'contains "police"'
    },
    {
        keyword: "hospital",
        score: -20,
        reason: 'contains "hospital"'
    },
    {
        keyword: "health",
        score: -15,
        reason: 'contains "health"'
    }
];


// =============================================================================
// Main scorer
// =============================================================================

/**
 * Score an ArcGIS search result for likely municipal political-
 * district relevance.
 *
 * This is an inexpensive pre-filter.
 *
 * IMPORTANT:
 *
 * This function does NOT determine whether an item actually
 * represents a political boundary. That remains the responsibility
 * of inspection, classification, validation, and ranking.
 */
export function scoreSearchResult(
    result: ArcGISSearchResult,
    place: CensusPlace
): SearchRelevance {

    const reasons: string[] = [];

    let score = 0;

    const title =
        normalize(result.title);

    const description =
        normalize(result.description);

    const snippet =
        normalize(result.snippet);

    const owner =
        normalize(result.owner);

    const tags =
        (result.tags ?? [])
            .map(normalize)
            .join(" ");

    const typeKeywords =
        (result.typeKeywords ?? [])
            .map(normalize)
            .join(" ");

    const searchableText = [
        title,
        description,
        snippet,
        tags,
        typeKeywords
    ]
        .filter(Boolean)
        .join(" ");


    // =========================================================================
    // Municipality name
    // =========================================================================

    const city =
        normalize(place.city);

    if (city.length > 0) {

        if (titleContainsPhrase(title, city)) {

            score += 35;

            reasons.push(
                `title contains municipality name "${place.city}"`
            );

        } else if (
            containsPhrase(
                searchableText,
                city
            )
        ) {

            score += 20;

            reasons.push(
                `metadata contains municipality name "${place.city}"`
            );

        } else {

            /*
             * Search results without the municipality name are not
             * automatically rejected. Some official ArcGIS layers
             * have generic titles such as "Wards" or "Council Districts".
             */

            reasons.push(
                `municipality name "${place.city}" not found in metadata`
            );
        }
    }


    // =========================================================================
    // Positive political-boundary keywords
    // =========================================================================

    for (
        const keyword of POSITIVE_KEYWORDS
    ) {

        if (
            containsPhrase(
                searchableText,
                keyword.keyword
            )
        ) {

            score += keyword.score;

            reasons.push(
                `+${keyword.score}: ${keyword.reason}`
            );
        }
    }


    // =========================================================================
    // Negative thematic keywords
    // =========================================================================

    for (
        const keyword of NEGATIVE_KEYWORDS
    ) {

        if (
            containsPhrase(
                searchableText,
                keyword.keyword
            )
        ) {

            score += keyword.score;

            reasons.push(
                `${keyword.score}: ${keyword.reason}`
            );
        }
    }


    // =========================================================================
    // Official municipal ownership
    // =========================================================================

    if (
        isLikelyMunicipalOwner(
            owner,
            city
        )
    ) {

        score += 30;

        reasons.push(
            `+30: likely municipal ArcGIS owner "${result.owner}"`
        );

    } else if (
        isLikelyGovernmentOwner(
            owner
        )
    ) {

        score += 12;

        reasons.push(
            `+12: likely government ArcGIS owner "${result.owner}"`
        );
    }


    // =========================================================================
    // ArcGIS service type
    // =========================================================================

    if (
        result.type === "Feature Service"
    ) {

        score += 5;

        reasons.push(
            "+5: Feature Service"
        );

    } else if (
        result.type === "Map Service"
    ) {

        score += 4;

        reasons.push(
            "+4: Map Service"
        );

    } else if (
        result.type === "Web Map"
    ) {

        /*
         * Web maps can contain the correct boundary layer, but they
         * are less directly useful than a Feature Service or Map Service.
         */

        score -= 3;

        reasons.push(
            "-3: Web Map rather than direct service"
        );

    } else if (
        result.type !== "Feature Collection"
    ) {

        score -= 5;

        reasons.push(
            "-5: non-service ArcGIS item type"
        );
    }


    // =========================================================================
    // Unrelated municipality detection
    // =========================================================================

    const municipalityNames =
        extractLikelyMunicipalityNames(
            searchableText
        );

    for (
        const municipalityName of municipalityNames
    ) {

        if (
            city.length > 0 &&
            municipalityName !== city
        ) {

            score -= 10;

            reasons.push(
                `-10: metadata may reference another municipality "${municipalityName}"`
            );
        }
    }


    // =========================================================================
    // Final decision
    // =========================================================================

    const likelyRelevant =
        score >= SEARCH_RELEVANCE_THRESHOLD;


    reasons.push(
        `final search relevance score: ${score}`
    );

    reasons.push(
        likelyRelevant
            ? "candidate passes search relevance threshold"
            : "candidate rejected by search relevance threshold"
    );


    return {
        score,
        reasons,
        likelyRelevant
    };
}


// =============================================================================
// Helpers
// =============================================================================

function normalize(
    value: string | undefined
): string {

    return (
        value ??
        ""
    )
        .toLowerCase()
        .replace(
            /[_-]+/g,
            " "
        )
        .replace(
            /[^a-z0-9\s]/g,
            " "
        )
        .replace(
            /\s+/g,
            " "
        )
        .trim();
}


function containsPhrase(
    text: string,
    phrase: string
): boolean {

    if (
        !text ||
        !phrase
    ) {
        return false;
    }

    return (
        ` ${text} `
    ).includes(
        ` ${phrase} `
    );
}


function titleContainsPhrase(
    title: string,
    phrase: string
): boolean {

    return containsPhrase(
        title,
        phrase
    );
}


function isLikelyMunicipalOwner(
    owner: string,
    city: string
): boolean {

    if (
        !owner
    ) {
        return false;
    }

    if (
        owner.includes("city_") ||
        owner.includes("city ")
    ) {
        return true;
    }

    if (
        owner.includes("municipal")
    ) {
        return true;
    }

    if (
        city &&
        owner.includes(city)
    ) {
        return (
            owner.includes("gis") ||
            owner.includes("city") ||
            owner.includes("government") ||
            owner.includes("gov")
        );
    }

    return false;
}


function isLikelyGovernmentOwner(
    owner: string
): boolean {

    if (
        !owner
    ) {
        return false;
    }

    return (
        owner.includes("gov") ||
        owner.includes("government") ||
        owner.includes("county") ||
        owner.includes("state") ||
        owner.includes("city") ||
        owner.includes("municipal")
    );
}


/**
 * This intentionally uses a small heuristic rather than trying to
 * maintain a nationwide municipality database.
 *
 * It catches common metadata patterns such as:
 *
 *   "Phoenix"
 *   "City of Phoenix"
 *   "Tucson County"
 *
 * It is only a negative signal. It should never by itself eliminate
 * a candidate.
 */
function extractLikelyMunicipalityNames(
    text: string
): string[] {

    const names: string[] = [];

    const cityPatterns = [
        /\bcity of ([a-z][a-z\s]+?)(?=\s+(?:ward|wards|district|districts|boundary|boundaries|gis)\b|$)/g,
        /\b([a-z][a-z\s]+?) city\b/g
    ];

    for (
        const pattern of cityPatterns
    ) {

        for (
            const match of text.matchAll(pattern)
        ) {

            const value =
                match[1]
                    ?.trim();

            if (
                value &&
                value.length > 2 &&
                !names.includes(value)
            ) {

                names.push(value);
            }
        }
    }

    return names;
}