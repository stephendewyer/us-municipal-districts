import type {
    CensusPlace,
    InspectedCandidate
} from "./types.js";

// =============================================================================
// Types
// =============================================================================

export type DistrictMunicipalityScope =
    | "target"
    | "multi-municipality"
    | "unknown";

export interface DistrictMunicipalityValidation {
    scope: DistrictMunicipalityScope;

    targetMunicipality?: string;

    municipalities: string[];

    evidence: string[];

    /** 
     * True when district values explicitly identify more than one
     * municipality.
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
 * This is intentionally conservative.
 *
 * We only classify a candidate as "multi-municipality" when the
 * district values themselves contain explicit municipality names.
 *
 * We do NOT infer multi-municipality coverage merely because:
 *
 * - the publisher is a county
 * - the URL contains "county"
 * - the dataset description mentions multiple jurisdictions
 * - the geography overlaps multiple municipalities
 *
 * Those are handled by other validation stages.
 */
export function validateDistrictMunicipality(
    candidate: InspectedCandidate,
    place: CensusPlace
): DistrictMunicipalityValidation {

    const targetMunicipality =
        normalize(place.city);

    const districtValues =
        getDistrictValues(candidate);

    const municipalities =
        new Set<string>();

    const evidence: string[] = [];

    for (const value of districtValues) {

        const detected =
            detectMunicipalities(value);

        for (const municipality of detected) {

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

    /*
     * Strongest case:
     *
     *     Milwaukee Common Council 1
     *     Cudahy 1
     *     Franklin 1
     *     Glendale 1
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
            targetMunicipality: place.city,
            municipalities: municipalityList,
            evidence,
            spansMultipleMunicipalities: true
        };
    }

    /*
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
            targetMunicipality: place.city,
            municipalities: municipalityList,
            evidence,
            spansMultipleMunicipalities: false
        };
    }

    /*
     * If we cannot establish municipality identity from the
     * district values themselves, do not guess.
     */
    return {
        scope: "unknown",
        targetMunicipality: place.city,
        municipalities: municipalityList,
        evidence,
        spansMultipleMunicipalities: false
    };
}

// =============================================================================
// District values
// =============================================================================

function getDistrictValues(
    candidate: InspectedCandidate
): string[] {

    const inspectionValues =
        candidate.inspection.distinctDistrictValues ?? [];

    if (
        inspectionValues.length > 0
    ) {
        return normalizeList(
            inspectionValues
        );
    }

    const validationValues =
        candidate.validation?.distinctDistrictValues ?? [];

    return normalizeList(
        validationValues
    );
}

// =============================================================================
// Municipality detection
// =============================================================================

/**
 * Detect explicit municipality names in an individual district value.
 *
 * Examples:
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
 *     "Milwaukee Common Council 1"
 *         -> ["milwaukee"]
 *
 *     "1"
 *         -> []
 *
 * The function intentionally does not attempt geographic inference.
 */
function detectMunicipalities(
    value: string
): string[] {

    const normalized =
        normalize(value);

    if (!normalized) {
        return [];
    }

    const municipalities =
        new Set<string>();

    /*
     * Explicit "City of X", "Village of X", and "Town of X".
     */
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

    /*
     * Milwaukee's dataset also contains values such as:
     *
     *     "Milwaukee Common Council 1"
     *
     * where the municipality is not prefixed with "City of".
     *
     * Handle that form conservatively.
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
            /([a-z])([A-Z])/g,
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
                .map(value =>
                    normalize(value)
                )
                .filter(Boolean)
        )
    ];
}