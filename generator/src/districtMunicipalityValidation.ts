import type {
    CensusPlace
} from "./types.js";

// =============================================================================
// Types
// =============================================================================

export type DistrictMunicipalityScope =
    | "target"
    | "multi-municipality"
    | "unknown";

export interface DistrictMunicipalityValidation {

    /**
     * Whether the district values appear to represent:
     *
     * - the target municipality only
     * - multiple explicitly identified municipalities
     * - an unknown municipality scope
     */
    scope: DistrictMunicipalityScope;

    /**
     * Target municipality being evaluated.
     */
    targetMunicipality?: string;

    /**
     * Municipalities explicitly identified by the district values.
     */
    municipalities: string[];

    /**
     * Human-readable evidence supporting the result.
     */
    evidence: string[];

    /**
     * True when district values explicitly identify more than one
     * municipality, including the target municipality.
     */
    spansMultipleMunicipalities: boolean;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Determine whether the district values represented by an ArcGIS
 * candidate are specific to the target municipality or explicitly
 * span multiple municipalities.
 *
 * This validator operates only on district values themselves.
 *
 * It intentionally does NOT infer municipality scope from:
 *
 * - publisher
 * - URL
 * - service name
 * - dataset description
 * - county terminology
 * - geography
 *
 * Those signals are handled by other validation stages.
 *
 * Examples:
 *
 *     ["City of Milwaukee Common Council 1", ...]
 *         -> target
 *
 *     ["Milwaukee Common Council 1",
 *      "Cudahy 1",
 *      "Franklin 1"]
 *         -> currently unknown unless the values explicitly identify
 *            municipalities using a recognized pattern
 *
 *     ["City of Milwaukee 1",
 *      "City of Cudahy 1"]
 *         -> multi-municipality
 */
export function validateDistrictMunicipality(
    districtValues: string[],
    place: CensusPlace,
    knownPlaces: CensusPlace[]
): DistrictMunicipalityValidation {

    const targetMunicipality =
        normalize(place.city);

    const knownMunicipalities =
        new Set(
            knownPlaces
                .map(
                    knownPlace =>
                        normalize(knownPlace.city)
                )
                .filter(Boolean)
        );

    const normalizedDistrictValues =
        normalizeList(
            districtValues
        );

    const municipalities =
        new Set<string>();

    const evidence: string[] = [];

    for (
        const value of normalizedDistrictValues
    ) {

        const detected =
            detectMunicipalities(
                value,
                knownMunicipalities
            );

        for (
            const municipality of detected
        ) {

            municipalities.add(
                municipality
            );

            evidence.push(
                `district value "${value}" identifies municipality "${municipality}"`
            );
        }
    }

    const municipalityList =
        [...municipalities];

    const hasTargetMunicipality =
        municipalityList.some(
            municipality =>
                municipality ===
                targetMunicipality
        );

    const hasOtherMunicipality =
        municipalityList.some(
            municipality =>
                municipality !==
                targetMunicipality
        );

    // =========================================================================
    // Multiple municipalities
    // =========================================================================

    /**
     * Strongest case:
     *
     *     Milwaukee Common Council 1
     *     City of Cudahy 1
     *     City of Franklin 1
     *
     * The district values explicitly identify multiple municipalities.
     */
    if (
        municipalityList.length > 1 &&
        hasTargetMunicipality &&
        hasOtherMunicipality
    ) {

        evidence.push(
            `district values explicitly span ${municipalityList.length} municipalities`
        );

        return {
            scope: "multi-municipality",

            targetMunicipality:
                place.city,

            municipalities:
                municipalityList,

            evidence,

            spansMultipleMunicipalities:
                true
        };
    }

    // =========================================================================
    // Target municipality only
    // =========================================================================

    /**
     * If district values explicitly identify only the target
     * municipality, treat them as municipality-specific.
     */
    if (
        municipalityList.length === 1 &&
        hasTargetMunicipality
    ) {

        evidence.push(
            `district values explicitly identify target municipality "${place.city}"`
        );

        return {
            scope: "target",

            targetMunicipality:
                place.city,

            municipalities:
                municipalityList,

            evidence,

            spansMultipleMunicipalities:
                false
        };
    }

    // =========================================================================
    // Unknown
    // =========================================================================

    /**
     * If municipality identity cannot be established from the
     * district values themselves, do not guess.
     *
     * This is important because values such as:
     *
     *     1
     *     2
     *     3
     *
     * do not contain enough information to determine municipality
     * scope.
     */
    return {
        scope: "unknown",

        targetMunicipality:
            place.city,

        municipalities:
            municipalityList,

        evidence,

        spansMultipleMunicipalities:
            false
    };
}

// =============================================================================
// Municipality detection
// =============================================================================

/**
 * Detect explicit municipality names in an individual district value.
 *
 * Recognized forms include:
 *
 *     "City of Milwaukee Common Council 1"
 *         -> ["milwaukee"]
 *
 *     "City of Cudahy 1"
 *         -> ["cudahy"]
 *
 *     "Village of Bayside 1"
 *         -> ["bayside"]
 *
 *     "Town of Lisbon 1"
 *         -> ["lisbon"]
 *
 *     "Milwaukee Common Council 1"
 *         -> ["milwaukee"]
 *
 * Values such as:
 *
 *     "1"
 *     "Ward 1"
 *     "District 1"
 *
 * do not provide enough information to identify a municipality.
 *
 * The function intentionally does not attempt geographic inference.
 */
function detectMunicipalities(
    value: string,
    knownMunicipalities: Set<string>
): string[] {

    const normalized =
        normalize(value);

    if (!normalized) {
        return [];
    }

    const municipalities =
        new Set<string>();

    // =========================================================================
    // Explicit "City of X", "Village of X", and "Town of X"
    // =========================================================================

    const explicitPatterns = [
        /\bcity of ([a-z][a-z\s]*?)(?=\s+\d+\b|\s+(?:common council|council|board|district|ward)\b|$)/i,

        /\bvillage of ([a-z][a-z\s]*?)(?=\s+\d+\b|\s+(?:common council|council|board|district|ward)\b|$)/i,

        /\btown of ([a-z][a-z\s]*?)(?=\s+\d+\b|\s+(?:common council|council|board|district|ward)\b|$)/i
    ];

    for (
        const pattern of explicitPatterns
    ) {

        const match =
            normalized.match(
                pattern
            );

        if (
            match?.[1]
        ) {

            const municipality =
                normalizeMunicipalityName(
                    match[1]
                );

            if (
                municipality
            ) {

                municipalities.add(
                    municipality
                );
            }
        }
    }

    // =========================================================================
    // "X Common Council"
    // =========================================================================

    /**
     * Handles values such as:
     *
     *     Milwaukee Common Council 1
     *
     * where the municipality is not prefixed with "City of".
     */
    const commonCouncil =
        normalized.match(
            /^(.+?)\s+common council\b/i
        );

    if (
        commonCouncil?.[1]
    ) {

        const municipality =
            normalizeMunicipalityName(
                commonCouncil[1]
            );

        if (
            municipality
        ) {

            municipalities.add(
                municipality
            );
        }
    }

    // =========================================================================
    // Known municipality name followed by a district value
    // =========================================================================

    /**
     * Handles values such as:
     *
     *     Cudahy 1
     *     Franklin 1
     *     Glendale 3
     *     Wauwatosa 8
     *
     * using the Census-place municipality names supplied by the caller.
     *
     * This avoids hard-coding individual municipalities.
     */
    for (
        const municipality of knownMunicipalities
    ) {

        if (
            value === municipality ||
            value.startsWith(
                `${municipality} `
            )
        ) {
            municipalities.add(
                municipality
            );
        }
    }

    return [
        ...municipalities
    ];
}

// =============================================================================
// Normalization
// =============================================================================

function normalize(
    value: string | undefined
): string {

    return (value ?? "")
        .replace(
            /([a-z0-9])([A-Z])/g,
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

function normalizeMunicipalityName(
    value: string
): string {

    return normalize(value)
        .replace(
            /\b(city|village|town)\s+of\s+/,
            ""
        )
        .replace(
            /\s+(?:common council|council|board of trustees|board)\b.*$/,
            ""
        )
        .trim();
}

function normalizeList(
    values: string[]
): string[] {

    return [
        ...new Set(
            values
                .map(
                    value =>
                        normalize(value)
                )
                .filter(Boolean)
        )
    ];
}