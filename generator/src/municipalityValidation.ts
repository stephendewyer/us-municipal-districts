import type {
    CensusPlace,
    InspectedCandidate,
    MunicipalityValidation
} from "./types.js";

// =============================================================================
// Configuration
// =============================================================================

export const MUNICIPALITY_VALIDATION_THRESHOLD = 10;

// =============================================================================
// Public API
// =============================================================================

/**
 * Evaluate whether an inspected ArcGIS candidate appears to
 * belong to the target Census place.
 *
 * This function does NOT determine whether the dataset is:
 *
 * - a political boundary
 * - a ward
 * - a council district
 * - a valid polygon
 *
 * Those decisions belong to other stages of the pipeline.
 */
export function validateMunicipality(
    candidate: InspectedCandidate,
    place: CensusPlace
): MunicipalityValidation {

    let score = 0;
    const reasons: string[] = [];
    const inspection = candidate.inspection;
    const city = normalize(place.city);

    // =========================================================================
    // Dataset identity
    // =========================================================================

    /*
     * identityText describes what the dataset actually IS.
     *
     * This intentionally excludes descriptions and publisher/provenance
     * metadata. It is used for the strongest dataset-identity checks.
     */
    const identityText =
        normalize([
            candidate.candidate.title,
            inspection.title,
            inspection.serviceName,
            inspection.layerName
        ]
            .filter(Boolean)
            .join(" "));

    if (identityText) {
        reasons.push(
            `dataset identity: "${identityText}"`
        );
    }

    // =========================================================================
    // Dataset metadata
    // =========================================================================

    /*
     * datasetMetadataText describes the dataset itself, including its
     * description, but excludes accessInformation.
     *
     * This distinction is important.
     *
     * Example:
     *
     *     title:
     *         "City of Tucson Ward Boundaries"
     *
     *     accessInformation:
     *         "Pima County IT GIS"
     *
     * The publisher being Pima County does NOT mean the dataset is a
     * county-level boundary.
     *
     * Conversely, if the dataset description itself says:
     *
     *     "Pima County Council District Boundaries"
     *
     * that IS meaningful negative evidence.
     */
    const datasetMetadataText =
        normalize([
            candidate.candidate.title,
            inspection.title,
            inspection.serviceName,
            inspection.layerName,
            inspection.description,
            inspection.serviceDescription
        ]
            .filter(Boolean)
            .join(" "));

    // =========================================================================
    // Broad metadata
    // =========================================================================

    /*
     * metadataText contains broader provenance information.
     *
     * It is useful for positive municipality evidence because an official
     * publisher or organization can legitimately identify the municipality.
     *
     * It should NOT be used for county/state/federal negative evidence.
     */
    const metadataText =
        normalize([
            candidate.candidate.title,
            inspection.title,
            inspection.serviceName,
            inspection.layerName,
            inspection.description,
            inspection.serviceDescription,
            inspection.accessInformation
        ]
            .filter(Boolean)
            .join(" "));

    // =========================================================================
    // Field text
    // =========================================================================

    const fieldText =
        normalize([
            ...(inspection.fields ?? [])
                .flatMap(field => [
                    field.name,
                    field.alias
                ])
                .filter(
                    (value): value is string =>
                        Boolean(value)
                ),

            ...inspection.districtFields,
            ...inspection.nameFields
        ].join(" "));

    // =========================================================================
    // Owner / organization text
    // =========================================================================

    const ownerText =
        normalize([
            inspection.owner,
            inspection.organization
        ]
            .filter(Boolean)
            .join(" "));

    // =========================================================================
    // Tags / type keywords
    // =========================================================================

    const tagText =
        normalize([
            ...(inspection.tags ?? []),
            ...(inspection.typeKeywords ?? [])
        ].join(" "));

    // =========================================================================
    // URL text
    // =========================================================================

    const urlText =
        normalize([
            inspection.url,
            inspection.serviceUrl
        ]
            .filter(Boolean)
            .join(" "));

    // =========================================================================
    // Municipality URL evidence
    // =========================================================================

    if (
        city &&
        containsPhrase(
            urlText,
            city
        )
    ) {
        if (
            isMunicipalitySpecificDomain(
                inspection.url,
                place.city
            )
        ) {
            score += 30;

            reasons.push(
                `+30: municipality name "${place.city}" appears in municipality-specific URL`
            );
        } else {
            score += 5;

            reasons.push(
                `+5: municipality name "${place.city}" appears in candidate URL`
            );
        }
    }

    // =========================================================================
    // Target municipality evidence
    // =========================================================================

    if (
        city &&
        containsPhrase(
            metadataText,
            city
        )
    ) {
        score += 40;

        reasons.push(
            `+40: municipality name "${place.city}" appears in layer metadata`
        );
    }

    // =========================================================================
    // "City of X" evidence
    // =========================================================================

    const cityOf =
        `city of ${city}`;

    if (
        city &&
        containsPhrase(
            metadataText,
            cityOf
        )
    ) {
        score += 20;

        reasons.push(
            `+20: layer metadata contains "${cityOf}"`
        );
    }

    // =========================================================================
    // Municipality-specific field evidence
    // =========================================================================

    if (
        city &&
        containsPhrase(
            fieldText,
            city
        )
    ) {
        score += 20;

        reasons.push(
            `+20: municipality name "${place.city}" appears in field metadata`
        );
    }

    // =========================================================================
    // Municipal owner / organization evidence
    // =========================================================================

    if (
        city &&
        containsPhrase(
            ownerText,
            city
        )
    ) {
        score += 25;

        reasons.push(
            "+25: ArcGIS owner/organization appears municipality-specific"
        );
    }

    // =========================================================================
    // Municipal terminology
    // =========================================================================

    if (
        /\bcity\b/.test(metadataText) ||
        /\bmunicipal\b/.test(metadataText) ||
        /\bmunicipality\b/.test(metadataText) ||
        /\btown\b/.test(metadataText) ||
        /\bvillage\b/.test(metadataText)
    ) {
        score += 8;

        reasons.push(
            "+8: municipal terminology appears in metadata"
        );
    }

    // =========================================================================
    // County-level negative evidence
    // =========================================================================

    /*
     * IMPORTANT:
     *
     * Use datasetMetadataText rather than metadataText.
     *
     * accessInformation may contain a county publisher even when the
     * dataset itself is a valid municipal boundary.
     */
    if (
        /\bcounty\b/.test(
            datasetMetadataText
        )
    ) {
        score -= 35;

        reasons.push(
            "-35: county-level terminology appears in dataset metadata"
        );
    }

    // =========================================================================
    // State-level negative evidence
    // =========================================================================

    if (
        /\bstate\b/.test(
            datasetMetadataText
        ) ||
        /\bstatewide\b/.test(
            datasetMetadataText
        )
    ) {
        score -= 40;

        reasons.push(
            "-40: state-level terminology appears in dataset metadata"
        );
    }

    // =========================================================================
    // Federal-level negative evidence
    // =========================================================================

    if (
        /\bcongressional\b/.test(
            datasetMetadataText
        ) ||
        /\bcongress\b/.test(
            datasetMetadataText
        ) ||
        /\bfederal\b/.test(
            datasetMetadataText
        )
    ) {
        score -= 50;

        reasons.push(
            "-50: federal-level terminology appears in dataset metadata"
        );
    }

    // =========================================================================
    // Other municipality evidence
    // =========================================================================

    /*
     * As with county/state/federal evidence, inspect dataset metadata rather
     * than publisher/access information.
     *
     * This prevents something like:
     *
     *     title: "City of Tucson Ward Boundaries"
     *     accessInformation: "Pima County IT GIS"
     *
     * from being interpreted as another municipality.
     */
    const otherMunicipality =
        detectOtherMunicipality(
            datasetMetadataText,
            place.city
        );

    if (
        otherMunicipality
    ) {
        score -= 30;

        reasons.push(
            `-30: dataset metadata appears associated with another municipality "${otherMunicipality}"`
        );
    }

    // =========================================================================
    // Tags / type keywords
    // =========================================================================

    if (
        city &&
        containsPhrase(
            tagText,
            city
        )
    ) {
        score += 10;

        reasons.push(
            `+10: municipality name "${place.city}" appears in tags/type keywords`
        );
    }

    // =========================================================================
    // Result
    // =========================================================================

    const likelyMunicipalityMatch =
        score >=
        MUNICIPALITY_VALIDATION_THRESHOLD;

    reasons.push(
        `municipality validation score: ${score}`
    );

    reasons.push(
        likelyMunicipalityMatch
            ? "candidate passes municipality validation"
            : "candidate fails municipality validation"
    );

    return {
        score,
        reasons,
        likelyMunicipalityMatch
    };
}

// =============================================================================
// Text helpers
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

    const normalizedPhrase =
        normalize(phrase);

    if (!normalizedPhrase) {
        return false;
    }

    const escaped =
        normalizedPhrase.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
        );

    return new RegExp(
        `\\b${escaped}\\b`,
        "i"
    ).test(text);
}

// =============================================================================
// Municipality-specific URL detection
// =============================================================================

function isMunicipalitySpecificDomain(
    url: string | undefined,
    city: string
): boolean {
    if (
        !url ||
        !city
    ) {
        return false;
    }

    const normalizedUrl =
        normalize(url);

    const normalizedCity =
        normalize(city);

    if (
        !normalizedUrl ||
        !normalizedCity
    ) {
        return false;
    }

    /*
     * A municipality-specific government domain is strong evidence.
     *
     * Examples:
     *
     *     tucsonaz.gov
     *     gis.tucsonaz.gov
     *     maps.phoenix.gov
     *
     * We deliberately avoid treating arbitrary ArcGIS Online domains
     * as municipality-specific solely because the URL contains the
     * municipality name elsewhere.
     */
    const cityTokens =
        normalizedCity
            .split(" ")
            .filter(Boolean);

    const citySlug =
        cityTokens.join("");

    const cityHyphenated =
        cityTokens.join("-");

    const cityUnderscored =
        cityTokens.join("_");

    const candidates = [
        citySlug,
        cityHyphenated,
        cityUnderscored
    ]
        .filter(Boolean);

    for (
        const candidate of candidates
    ) {
        if (
            normalizedUrl.includes(
                `${candidate}.gov`
            ) ||
            normalizedUrl.includes(
                `.${candidate}.gov`
            )
        ) {
            return true;
        }
    }

    /*
     * Explicit Tucson/Phoenix-style government GIS handling.
     *
     * This remains intentionally conservative.
     */
    if (
        /tucsonaz\.gov/i.test(
            normalizedUrl
        ) ||
        /phoenix\.gov/i.test(
            normalizedUrl
        )
    ) {
        return true;
    }

    return false;
}

// =============================================================================
// Other municipality detection
// =============================================================================

function detectOtherMunicipality(
    text: string,
    targetCity: string
): string | undefined {

    const normalizedTarget =
        normalize(targetCity);

    const patterns = [
        /\bcity of ([a-z][a-z\s]*?)(?=\s+(?:ward|wards|district|districts|boundary|boundaries|map|gis)\b|$)/,
        /\btown of ([a-z][a-z\s]*?)(?=\s+(?:ward|wards|district|districts|boundary|boundaries|map|gis)\b|$)/,
        /\bvillage of ([a-z][a-z\s]*?)(?=\s+(?:ward|wards|district|districts|boundary|boundaries|map|gis)\b|$)/
    ];

    for (
        const pattern of patterns
    ) {
        const match =
            text.match(pattern);

        if (
            !match?.[1]
        ) {
            continue;
        }

        const municipality =
            normalize(
                match[1]
            );

        if (
            municipality &&
            municipality !==
                normalizedTarget &&
            municipality.length > 2
        ) {
            return municipality;
        }
    }

    return undefined;
}