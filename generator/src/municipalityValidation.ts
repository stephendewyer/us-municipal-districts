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

    const inspection =
        candidate.inspection;

    const city =
        normalize(place.city);

    const metadataText =
        normalize([
            inspection.title,
            inspection.serviceName,
            inspection.layerName,
            inspection.description,
            inspection.serviceDescription
        ]
            .filter(Boolean)
            .join(" "));

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

    const ownerText =
        normalize([
            inspection.owner,
            inspection.organization
        ]
            .filter(Boolean)
            .join(" "));

    const tagText =
        normalize([
            ...(inspection.tags ?? []),
            ...(inspection.typeKeywords ?? [])
        ].join(" "));


    // =========================================================================
    // Target municipality evidence
    // =========================================================================

    if (
        city &&
        containsPhrase(metadataText, city)
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
        containsPhrase(metadataText, cityOf)
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
        containsPhrase(fieldText, city)
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
        containsPhrase(ownerText, city)
    ) {

        score += 25;

        reasons.push(
            `+25: ArcGIS owner/organization appears municipality-specific`
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

    if (
        /\bcounty\b/.test(metadataText)
    ) {

        score -= 35;

        reasons.push(
            "-35: county-level terminology appears in metadata"
        );
    }


    // =========================================================================
    // State-level negative evidence
    // =========================================================================

    if (
        /\bstate\b/.test(metadataText) ||
        /\bstatewide\b/.test(metadataText)
    ) {

        score -= 40;

        reasons.push(
            "-40: state-level terminology appears in metadata"
        );
    }


    // =========================================================================
    // Federal-level negative evidence
    // =========================================================================

    if (
        /\bcongressional\b/.test(metadataText) ||
        /\bcongress\b/.test(metadataText) ||
        /\bfederal\b/.test(metadataText)
    ) {

        score -= 50;

        reasons.push(
            "-50: federal-level terminology appears in metadata"
        );
    }


    // =========================================================================
    // Other municipality evidence
    // =========================================================================

    const otherMunicipality =
        detectOtherMunicipality(
            metadataText,
            place.city
        );

    if (otherMunicipality) {

        score -= 30;

        reasons.push(
            `-30: metadata appears associated with another municipality "${otherMunicipality}"`
        );
    }


    // =========================================================================
    // Tags / type keywords
    // =========================================================================

    if (
        city &&
        containsPhrase(tagText, city)
    ) {

        score += 10;

        reasons.push(
            `+10: municipality name "${place.city}" appears in tags/type keywords`
        );
    }


    // =========================================================================
    // Final decision
    // =========================================================================

    const likelyMunicipalityMatch =
        score >= MUNICIPALITY_VALIDATION_THRESHOLD;

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
    value: string
): string {

    return value
        .toLowerCase()
        .replace(/[_-]+/g, " ")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}


function containsPhrase(
    text: string,
    phrase: string
): boolean {

    if (!phrase) {
        return false;
    }

    const normalizedPhrase =
        normalize(phrase);

    if (!normalizedPhrase) {
        return false;
    }

    return (
        ` ${text} `
    ).includes(
        ` ${normalizedPhrase} `
    );
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

    /*
     * Look for common municipal naming patterns.
     *
     * This is intentionally conservative. We do not attempt
     * to build a nationwide municipality dictionary here.
     *
     * The goal is to detect obvious cases such as:
     *
     *   City of Phoenix
     *   City of Mesa
     *   Town of Oro Valley
     *
     * when processing Tucson.
     */

    const patterns = [
        /\bcity of ([a-z][a-z\s]+?)(?:\s+(?:wards?|districts?|boundaries?|gis|map))?(?:\s|$)/,
        /\btown of ([a-z][a-z\s]+?)(?:\s+(?:wards?|districts?|boundaries?|gis|map))?(?:\s|$)/,
        /\bvillage of ([a-z][a-z\s]+?)(?:\s+(?:wards?|districts?|boundaries?|gis|map))?(?:\s|$)/
    ];

    for (const pattern of patterns) {

        const match =
            text.match(pattern);

        if (!match?.[1]) {
            continue;
        }

        const municipality =
            normalize(match[1]);

        if (
            municipality &&
            municipality !== normalizedTarget &&
            municipality.length > 2
        ) {

            return municipality;
        }
    }

    return undefined;
}