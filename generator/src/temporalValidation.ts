import type { ArcGISInspection, TemporalStatus } from "./types.js";

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

const HISTORICAL_SCORE = -60;
const CURRENT_SCORE = 20;
const DATED_SCORE = 5;
const FUTURE_SCORE = -10;
const UNDATED_SCORE = 0;

const BOUNDARY_CONTEXT_PATTERN =
    /\b(?:ward|wards|district|districts|council|city council|alderman|aldermanic|boundary|boundaries|legislative|municipal|precinct|precincts|redistrict|redistricting|election)\b/i;

const CURRENT_LANGUAGE_PATTERN =
    /\b(?:current|currently|present|ongoing|active|maintained|in effect|effective today|current boundaries)\b/i;

const HISTORICAL_LANGUAGE_PATTERN =
    /\b(?:historical|historic|former|previous|prior|old|superseded|retired|no longer in effect|expired|past boundaries)\b/i;

const FUTURE_LANGUAGE_PATTERN =
    /\b(?:future|proposed|upcoming|planned|pending|to be effective|effective in)\b/i;

const NON_VINTAGE_DATE_PATTERN =
    /\b(?:updated|update|modified|published|publication|created|downloaded|obtained|accessed|retrieved|exported|posted|last\s+(?:updated|edited|modified))\b/i;


/**
 * Normalize Unicode dash characters.
 */
function normalizeDashes(
    text: string
): string {
    return text.replace(
        /[–—−]/g,
        "-"
    );
}


/**
 * Extract four-digit years.
 */
function extractYears(
    text: string
): number[] {
    const matches =
        text.match(
            /(?<!\d)(?:19|20)\d{2}(?!\d)/g
        );

    if (!matches) {
        return [];
    }

    return matches.map(Number);
}


/**
 * Extract a closed numeric range.
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
 * Extract an open-ended range such as:
 *
 *     2026-
 *     2026-present
 *     2026-current
 *     2026-ongoing
 */
function extractOpenRange(
    text: string
): {
    year: number;
    isCurrent: boolean;
} | undefined {

    const normalized =
        normalizeDashes(text);

    const match =
        normalized.match(
            /\b((?:19|20)\d{2})\s*-\s*(?:(present|current|ongoing|active)\b|(?=$))/i
        );

    if (!match) {
        return undefined;
    }

    const year =
        Number(match[1]);

    /*
     * A bare trailing "-" is considered an open range.
     */
    const matchEnd =
        match[0].trim().endsWith("-");

    const isCurrent =
        matchEnd ||
        Boolean(match[2]);

    return {
        year,
        isCurrent
    };
}


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
                `explicitly historical year range ${range.startYear}-${range.endYear} detected in ${source}`
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
            `explicitly historical year ${year} detected in ${source}`
        ]
    };
}


function datedEvidence(
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
                "dated",

            score:
                DATED_SCORE,

            startYear:
                range.startYear,

            endYear:
                range.endYear,

            reasons: [
                `dated boundary vintage ${range.startYear}-${range.endYear} detected in ${source}`
            ]
        };
    }

    return {
        status:
            "dated",

        score:
            DATED_SCORE,

        year,

        reasons: [
            `dated boundary vintage ${year} detected in ${source}`
        ]
    };
}


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


function futureEvidence(
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
                "future",

            score:
                FUTURE_SCORE,

            startYear:
                range.startYear,

            endYear:
                range.endYear,

            reasons: [
                `future year range ${range.startYear}-${range.endYear} detected in ${source}`
            ]
        };
    }

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


/**
 * Evaluate temporal evidence in one metadata field.
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
        normalizeDashes(text);

    const years =
        extractYears(normalized);


    /*
     * Explicit future language always wins.
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

        return futureEvidence(
            source,
            futureYear
        );
    }


    /*
     * Explicit historical language means historical.
     *
     * This is deliberately distinct from merely having an old year.
     */
    if (
        HISTORICAL_LANGUAGE_PATTERN.test(
            normalized
        )
    ) {

        const range =
            extractNumericYearRange(
                normalized
            ) ??
            extractNaturalYearRange(
                normalized
            );

        if (range) {
            return historicalEvidence(
                source,
                undefined,
                range
            );
        }

        const historicalYear =
            years.find(
                year =>
                    year <=
                    CURRENT_YEAR
            );

        return historicalEvidence(
            source,
            historicalYear
        );
    }


    /*
     * Current open-ended ranges.
     */
    const openRange =
        extractOpenRange(
            normalized
        );

    if (
        openRange?.isCurrent
    ) {

        return {
            ...currentEvidence(
                source,
                openRange.year,
                `current boundary range beginning ${openRange.year} detected in ${source}`
            ),

            startYear:
                openRange.year
        };
    }


    /*
     * Generic current language.
     *
     * Preserve the current year when explicitly present.
     */
    if (
        CURRENT_LANGUAGE_PATTERN.test(
            normalized
        )
    ) {

        const currentYear =
            years.find(
                year =>
                    year ===
                    CURRENT_YEAR
            );

        return currentEvidence(
            source,
            currentYear,
            `current temporal language detected in ${source}`
        );
    }


    /*
     * Closed numeric range.
     */
    const numericRange =
        extractNumericYearRange(
            normalized
        );

    if (
        numericRange
    ) {

        if (
            numericRange.startYear >
            CURRENT_YEAR
        ) {
            return futureEvidence(
                source,
                undefined,
                numericRange
            );
        }

        /*
         * A range ending in the current year is current.
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

        /*
         * A completed range before the current year is DATED,
         * not automatically HISTORICAL.
         *
         * Example:
         *
         *     Chicago Wards 2015-2023
         *
         * This is a boundary vintage.
         */
        if (
            numericRange.endYear <
            CURRENT_YEAR
        ) {

            return datedEvidence(
                source,
                undefined,
                numericRange
            );
        }
    }


    /*
     * Natural-language range.
     */
    const naturalRange =
        extractNaturalYearRange(
            normalized
        );

    if (
        naturalRange
    ) {

        if (
            naturalRange.startYear >
            CURRENT_YEAR
        ) {

            return futureEvidence(
                source,
                undefined,
                naturalRange
            );
        }

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

            return datedEvidence(
                source,
                undefined,
                naturalRange
            );
        }
    }


    /*
     * Maintenance/publication dates are not boundary vintages.
     */
    if (
        NON_VINTAGE_DATE_PATTERN.test(
            normalized
        )
    ) {
        return undefined;
    }


    /*
     * Individual years.
     */
    for (
        const year of years
    ) {

        /*
         * Future year.
         */
        if (
            year >
            CURRENT_YEAR
        ) {

            if (
                allowsBareYearEvidence(source) ||
                BOUNDARY_CONTEXT_PATTERN.test(
                    normalized
                )
            ) {

                return futureEvidence(
                    source,
                    year
                );
            }

            continue;
        }


        /*
         * Current year.
         */
        if (
            year ===
            CURRENT_YEAR
        ) {

            if (
                allowsBareYearEvidence(source) ||
                BOUNDARY_CONTEXT_PATTERN.test(
                    normalized
                )
            ) {

                return currentEvidence(
                    source,
                    year,
                    `current year ${year} detected in ${source}`
                );
            }

            continue;
        }


        /*
         * Past year.
         *
         * A past year in boundary metadata means DATED.
         *
         * It does NOT mean HISTORICAL unless historical language
         * explicitly establishes that the boundary is no longer current.
         */
        if (
            year <
            CURRENT_YEAR
        ) {

            if (
                allowsBareYearEvidence(source) ||
                BOUNDARY_CONTEXT_PATTERN.test(
                    normalized
                )
            ) {

                return datedEvidence(
                    source,
                    year
                );
            }
        }
    }


    return undefined;
}


/**
 * Add the current year when current language is present but the year
 * was not captured directly.
 */
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

    const pattern =
        new RegExp(
            `\\b(${CURRENT_YEAR})\\b`
        );

    const match =
        text.match(pattern);

    if (!match) {
        return evidence;
    }

    return {
        ...evidence,

        year:
            Number(match[1]),

        reasons: [
            ...evidence.reasons,
            `current year ${CURRENT_YEAR} detected in temporal metadata`
        ]
    };
}


/**
 * Evaluate ArcGIS metadata for temporal evidence.
 *
 * Precedence:
 *
 *     title
 *     layer name
 *     service name
 *     layer description
 *     service description
 *     tags
 *     type keywords
 *
 * The first metadata field containing meaningful temporal evidence wins.
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


    return {
        status:
            "undated",

        score:
            UNDATED_SCORE,

        reasons: [
            "no explicit current, dated, historical, or future temporal evidence detected"
        ]
    };
}