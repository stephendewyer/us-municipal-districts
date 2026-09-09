import type { ArcGISInspection } from "./types.js";

export type TemporalStatus =
    | "current"
    | "historical"
    | "undated"
    | "future"
    | "unknown";

export interface TemporalEvidence {
    status: TemporalStatus;
    score: number;
    year?: number;
    startYear?: number;
    endYear?: number;
    reasons: string[];
}

const CURRENT_YEAR =
    new Date().getFullYear();

const HISTORICAL_SCORE =
    -60;

const CURRENT_SCORE =
    20;

const FUTURE_SCORE =
    -10;

const UNDATED_SCORE =
    0;


/**
 * Terms that indicate political-boundary context.
 *
 * A year in arbitrary prose is not enough to determine the temporal
 * vintage of a political-boundary dataset.
 */
const BOUNDARY_CONTEXT_PATTERN =
    /\b(?:ward|wards|district|districts|council|city council|alderman|aldermanic|boundary|boundaries|legislative|municipal|precinct|precincts|redistrict|redistricting|election)\b/i;


/**
 * Current-tense language.
 */
const CURRENT_LANGUAGE_PATTERN =
    /\b(?:current|currently|present|ongoing|active|maintained|in effect|effective today|current boundaries)\b/i;


/**
 * Future-oriented language.
 */
const FUTURE_LANGUAGE_PATTERN =
    /\b(?:future|proposed|upcoming|planned|pending|to be effective|effective in)\b/i;


/**
 * Normalize common Unicode dash characters.
 *
 * This allows:
 *
 *     -
 *     –
 *     —
 *
 * to be treated identically when parsing year ranges.
 */
function normalizeDashes(
    text: string
): string {
    return text
        .replace(/[–—]/g, "-");
}


/**
 * Extract four-digit years.
 */
function extractYears(
    text: string
): number[] {
    const matches =
        text.match(
            /\b(?:19|20)\d{2}\b/g
        );

    if (!matches) {
        return [];
    }

    return matches.map(
        Number
    );
}


/**
 * Extract a closed numeric year range.
 *
 * Examples:
 *
 *     2015-2023
 *     2015 – 2023
 *     2015 — 2023
 */
function extractNumericYearRange(
    text: string
): {
    startYear: number;
    endYear: number;
} | undefined {
    const normalized =
        normalizeDashes(text);

    const match =
        normalized.match(
            /\b((?:19|20)\d{2})\s*-\s*((?:19|20)\d{2})\b/
        );

    if (!match) {
        return undefined;
    }

    return {
        startYear:
            Number(match[1]),

        endYear:
            Number(match[2])
    };
}


/**
 * Extract a natural-language year range.
 *
 * Examples:
 *
 *     2015 through 2023
 *     2015 thru 2023
 *     2015 to 2023
 */
function extractNaturalYearRange(
    text: string
): {
    startYear: number;
    endYear: number;
} | undefined {
    const match =
        text.match(
            /\b((?:19|20)\d{2})\s+(?:through|thru|to)\s+((?:19|20)\d{2})\b/i
        );

    if (!match) {
        return undefined;
    }

    return {
        startYear:
            Number(match[1]),

        endYear:
            Number(match[2])
    };
}


/**
 * Extract a current open-ended year range.
 *
 * Examples:
 *
 *     2026-
 *     2026 –
 *     2026 —
 *     2026-present
 *     2026 – present
 *     2026 — present
 *     2026-current
 *     2026-ongoing
 *     2026-active
 */
function extractCurrentOpenRange(
    text: string
): { year: number } | undefined {
    const normalized =
        normalizeDashes(text);

    const pattern =
        new RegExp(
            `(?:^|\\D)(${CURRENT_YEAR})\\s*-\\s*(?:present|current|ongoing|active)?`,
            "i"
        );

    const match =
        normalized.match(pattern);

    if (!match) {
        return undefined;
    }

    return {
        year:
            Number(match[1])
    };
}

function attachCurrentYear(
    evidence: TemporalEvidence,
    text: string
): TemporalEvidence {
    if (
        evidence.status !== "current" ||
        evidence.year !== undefined
    ) {
        return evidence;
    }

    const currentYearPattern =
        new RegExp(
            `\\b(${CURRENT_YEAR})\\b`
        );

    const match =
        text.match(
            currentYearPattern
        );

    if (!match) {
        return evidence;
    }

    return {
        ...evidence,

        year:
            Number(
                match[1]
            ),

        reasons: [
            ...evidence.reasons,
            `current year ${CURRENT_YEAR} detected in temporal metadata`
        ]
    };
}

/**
 * Determine whether a bare year is meaningful in this metadata source.
 *
 * Titles, layer names, service names, and type keywords can use a bare
 * year as a version indicator.
 *
 * Free-form descriptions are treated more conservatively because they
 * may contain unrelated ordinance, publication, or document years.
 */
function allowsBareYearEvidence(
    source: string
): boolean {
    return (
        source === "title" ||
        source === "layer name" ||
        source === "service name" ||
        source.startsWith(
            "type keyword"
        )
    );
}


/**
 * Create historical evidence.
 */
function historicalEvidence(
    source: string,
    year?: number,
    range?: {
        startYear: number;
        endYear: number;
    }
): TemporalEvidence {
    if (range) {
        return {
            status:
                "historical",

            score:
                HISTORICAL_SCORE,

            startYear:
                range.startYear,

            endYear:
                range.endYear,

            reasons: [
                `historical year range ${range.startYear}-${range.endYear} detected in ${source}`
            ]
        };
    }

    return {
        status:
            "historical",

        score:
            HISTORICAL_SCORE,

        year,

        reasons: [
            `historical year ${year} detected in ${source}`
        ]
    };
}


/**
 * Create current evidence.
 */
function currentEvidence(
    source: string,
    year?: number,
    reason?: string
): TemporalEvidence {
    return {
        status:
            "current",

        score:
            CURRENT_SCORE,

        year,

        reasons: [
            reason ??
            `current temporal evidence detected in ${source}`
        ]
    };
}


/**
 * Evaluate temporal evidence in a single metadata field.
 */
function evaluateText(
    value: string | undefined,
    source: string
): TemporalEvidence | undefined {
    if (
        !value ||
        !value.trim()
    ) {
        return undefined;
    }

    const text =
        value.trim();

    const normalized =
        normalizeDashes(
            text
        );

    const years =
        extractYears(
            normalized
        );


    /*
     * 1. Explicit future language.
     */
    if (
        FUTURE_LANGUAGE_PATTERN.test(
            normalized
        )
    ) {
        const futureYear =
            years.find(
                year =>
                    year >
                    CURRENT_YEAR
            );

        return {
            status:
                "future",

            score:
                FUTURE_SCORE,

            year:
                futureYear,

            reasons: [
                `future temporal language detected in ${source}`
            ]
        };
    }


    /*
     * 2. Explicit current-year open-ended range.
     *
     * This is intentionally evaluated before generic "present/current"
     * language so that the year is preserved.
     */
    const currentOpenRange =
        extractCurrentOpenRange(
            normalized
        );

    if (
        currentOpenRange
    ) {
        return {
            status: "current",
            score: CURRENT_SCORE,
            startYear:
                currentOpenRange.year,
            reasons: [
                `current-year open-ended range beginning ${currentOpenRange.year} detected in ${source}`
            ]
        };
    }


    /*
     * 3. Explicit current language.
     *
     * When the current year appears anywhere in the field, preserve it.
     *
     * This avoids relying exclusively on extractYears() for titles such as:
     *
     *     "Chicago Wards 2026-present"
     */
    if (
        CURRENT_LANGUAGE_PATTERN.test(
            normalized
        )
    ) {
        const hasCurrentYear =
            normalized.includes(
                String(
                    CURRENT_YEAR
                )
            );

        return {
            status:
                "current",

            score:
                CURRENT_SCORE,

            ...(hasCurrentYear
                ? {
                    startYear:
                        CURRENT_YEAR
                }
                : {}),

            reasons: [
                `current temporal language detected in ${source}`
            ]
        };
    }


    /*
     * 4. Closed numeric year range.
     */
    const numericRange =
        extractNumericYearRange(
            normalized
        );

    if (
        numericRange
    ) {
        /*
         * A range ending in the current year represents the current
         * boundary vintage.
         */
        if (
            numericRange.endYear ===
            CURRENT_YEAR
        ) {
            return currentEvidence(
                source,

                CURRENT_YEAR,

                `year range ${numericRange.startYear}-${numericRange.endYear} ends in the current year in ${source}`
            );
        }

        if (
            numericRange.endYear <
            CURRENT_YEAR
        ) {
            return historicalEvidence(
                source,
                undefined,
                numericRange
            );
        }

        if (
            numericRange.startYear >
            CURRENT_YEAR
        ) {
            return {
                status:
                    "future",

                score:
                    FUTURE_SCORE,

                startYear:
                    numericRange.startYear,

                endYear:
                    numericRange.endYear,

                reasons: [
                    `future year range ${numericRange.startYear}-${numericRange.endYear} detected in ${source}`
                ]
            };
        }
    }


    /*
     * 5. Natural-language year range.
     */
    const naturalRange =
        extractNaturalYearRange(
            normalized
        );

    if (
        naturalRange
    ) {
        if (
            naturalRange.endYear ===
            CURRENT_YEAR
        ) {
            return currentEvidence(
                source,

                CURRENT_YEAR,

                `year range ${naturalRange.startYear}-${naturalRange.endYear} ends in the current year in ${source}`
            );
        }

        if (
            naturalRange.endYear <
            CURRENT_YEAR
        ) {
            return historicalEvidence(
                source,
                undefined,
                naturalRange
            );
        }

        if (
            naturalRange.startYear >
            CURRENT_YEAR
        ) {
            return {
                status:
                    "future",

                score:
                    FUTURE_SCORE,

                startYear:
                    naturalRange.startYear,

                endYear:
                    naturalRange.endYear,

                reasons: [
                    `future year range ${naturalRange.startYear}-${naturalRange.endYear} detected in ${source}`
                ]
            };
        }
    }


    /*
     * 6. Individual years.
     */
    for (
        const year of years
    ) {
        /*
         * Historical year.
         */
        if (
            year <
            CURRENT_YEAR
        ) {
            if (
                allowsBareYearEvidence(
                    source
                ) ||
                BOUNDARY_CONTEXT_PATTERN.test(
                    normalized
                )
            ) {
                return historicalEvidence(
                    source,
                    year
                );
            }

            continue;
        }


        /*
         * Future year.
         */
        if (
            year >
            CURRENT_YEAR
        ) {
            if (
                allowsBareYearEvidence(
                    source
                ) ||
                BOUNDARY_CONTEXT_PATTERN.test(
                    normalized
                )
            ) {
                return {
                    status:
                        "future",

                    score:
                        FUTURE_SCORE,

                    year,

                    reasons: [
                        `future year ${year} detected in ${source}`
                    ]
                };
            }

            continue;
        }


        /*
         * Current year.
         *
         * A bare current year is accepted for compact metadata such as:
         *
         *     Chicago Wards 2026
         *     typeKeyword: "2026"
         *
         * but not arbitrary prose.
         */
        if (
            year ===
            CURRENT_YEAR &&
            allowsBareYearEvidence(
                source
            )
        ) {
            return currentEvidence(
                source,

                year,

                `current year ${year} detected in ${source}`
            );
        }
    }


    return undefined;
}


/**
 * Evaluate ArcGIS metadata for temporal evidence.
 *
 * Metadata precedence:
 *
 *     1. title
 *     2. layer name
 *     3. service name
 *     4. layer description
 *     5. service description
 *     6. tags
 *     7. type keywords
 *
 * Higher-priority metadata cannot be overridden by lower-priority metadata.
 */

export function validateTemporal(
    inspection: ArcGISInspection
): TemporalEvidence {

    function evaluateMetadata(
        value: string | undefined,
        source: string
    ): TemporalEvidence | undefined {
        if (
            !value ||
            value.trim().length === 0
        ) {
            return undefined;
        }

        const evidence =
            evaluateText(
                value,
                source
            );

        if (!evidence) {
            return undefined;
        }

        return attachCurrentYear(
            evidence,
            value
        );
    }


    // =========================================================================
    // 1. Title
    // =========================================================================

    const titleEvidence =
        evaluateMetadata(
            inspection.title,
            "title"
        );

    if (
        titleEvidence
    ) {
        return titleEvidence;
    }


    // =========================================================================
    // 2. Layer name
    // =========================================================================

    const layerEvidence =
        evaluateMetadata(
            inspection.layerName,
            "layer name"
        );

    if (
        layerEvidence
    ) {
        return layerEvidence;
    }


    // =========================================================================
    // 3. Service name
    // =========================================================================

    const serviceEvidence =
        evaluateMetadata(
            inspection.serviceName,
            "service name"
        );

    if (
        serviceEvidence
    ) {
        return serviceEvidence;
    }


    // =========================================================================
    // 4. Layer description
    // =========================================================================

    const descriptionEvidence =
        evaluateMetadata(
            inspection.description,
            "layer description"
        );

    if (
        descriptionEvidence
    ) {
        return descriptionEvidence;
    }


    // =========================================================================
    // 5. Service description
    // =========================================================================

    const serviceDescriptionEvidence =
        evaluateMetadata(
            inspection.serviceDescription,
            "service description"
        );

    if (
        serviceDescriptionEvidence
    ) {
        return serviceDescriptionEvidence;
    }


    // =========================================================================
    // 6. Tags
    // =========================================================================

    if (
        inspection.tags
    ) {
        for (
            const tag of
            inspection.tags
        ) {
            const evidence =
                evaluateMetadata(
                    tag,
                    `tag "${tag}"`
                );

            if (
                evidence
            ) {
                return evidence;
            }
        }
    }


    // =========================================================================
    // 7. Type keywords
    // =========================================================================

    if (
        inspection.typeKeywords
    ) {
        for (
            const keyword of
            inspection.typeKeywords
        ) {
            const evidence =
                evaluateMetadata(
                    keyword,
                    `type keyword "${keyword}"`
                );

            if (
                evidence
            ) {
                return evidence;
            }
        }
    }


    // =========================================================================
    // No temporal evidence
    // =========================================================================

    return {
        status:
            "undated",

        score:
            UNDATED_SCORE,

        reasons: [
            "no explicit current, historical, or future temporal evidence detected"
        ]
    };
}