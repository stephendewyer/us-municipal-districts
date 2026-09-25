import type {
    ArcGISField,
    CanonicalAlternative,
    CanonicalSource,
    DistrictType,
    EquivalentLayerGroup,
    SourceRole
} from "./types.js";

import {
    scoreCandidate,
    compareCandidateScores
} from "./rank.js";

import {
    validateTemporal
} from "./temporalValidation.js";

// =============================================================================
// Helpers
// =============================================================================

function normalizeField(value?: string): string {
    return (value ?? "")
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .toLowerCase()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

// =============================================================================
// Source role and temporal priority
// =============================================================================

const SOURCE_ROLE_PRIORITY: Record<SourceRole, number> = {
    authoritative: 4,
    derived: 3,
    duplicate: 2,
    unknown: 1
};

function sourceRolePriority(
    candidate: EquivalentLayerGroup["candidates"][number]
): number {
    return SOURCE_ROLE_PRIORITY[
        candidate.classification.sourceRole
    ];
}

function temporalPriority(
    candidate: EquivalentLayerGroup["candidates"][number]
): number {
    const temporal = validateTemporal(candidate.inspection);

    switch (temporal.status) {
        case "current":
            return 3;
        case "undated":
            return 2;
        case "historical":
            return 1;
        default:
            return 0;
    }
}

// =============================================================================
// Political field detection
// =============================================================================

function isPoliticalField(value?: string): boolean {
    const normalized = normalizeField(value);

    return (
        /\bward\b/.test(normalized) ||
        /\bcouncil\b/.test(normalized) ||
        /\balderman/.test(normalized) ||
        /\bmunicipal\s+district\b/.test(normalized) ||
        /\bpolitical\s+district\b/.test(normalized) ||
        /\belection\s+district\b/.test(normalized) ||
        /\belectoral\s+district\b/.test(normalized) ||
        /\bvoting\s+district\b/.test(normalized) ||
        /\bvoting\s+precinct\b/.test(normalized) ||
        /\bdistrict\s*(?:no|number|num|id)?\b/.test(normalized)
    );
}

// =============================================================================
// District field scoring
// =============================================================================

function districtFieldScore(
    field: ArcGISField,
    districtType?: DistrictType
): number {
    const name = normalizeField(field.name);
    const alias = normalizeField(field.alias);
    const combined = `${name} ${alias}`;

    let score = 0;

    if (districtType === "ward") {
        if (/^ward$/.test(name)) {
            score += 100;
        }

        if (/^ward\s*(id|no|number|num)$/.test(name)) {
            score += 90;
        }

        if (/\bward\b/.test(combined)) {
            score += 50;
        }
    }

    if (districtType === "council-district") {
        if (/^council\s+district$/.test(combined)) {
            score += 100;
        }

        if (
            /\bcouncil\b/.test(combined) &&
            /\bdistrict\b/.test(combined)
        ) {
            score += 60;
        }

        if (/\bcouncil\b/.test(combined)) {
            score += 30;
        }
    }

    if (districtType === "aldermanic-district") {
        if (/\balderman/.test(combined)) {
            score += 100;
        }

        if (/\bward\b/.test(combined)) {
            score += 30;
        }
    }

    if (districtType === "municipal-district") {
        if (/\bmunicipal\s+district\b/.test(combined)) {
            score += 100;
        }

        if (/\bdistrict\b/.test(combined)) {
            score += 50;
        }
    }

    if (/^district$/.test(name)) {
        score += 80;
    }

    if (/^district\s*(id|no|number|num)$/.test(name)) {
        score += 75;
    }

    if (/\bdistrict\s*(id|no|number|num)\b/.test(combined)) {
        score += 60;
    }

    if (/\bward\s*(id|no|number|num)\b/.test(combined)) {
        score += 75;
    }

    if (
        /\bcouncil\s*(district\s*)?(id|no|number|num)\b/.test(
            combined
        )
    ) {
        score += 75;
    }

    if (/\bward\s*number\b/.test(combined)) {
        score += 70;
    }

    if (/\bcouncil\s+district\s*number\b/.test(combined)) {
        score += 70;
    }

    if (
        /\bname\b/.test(name) &&
        !/\bward\b/.test(combined) &&
        !/\bdistrict\b/.test(combined) &&
        !/\bcouncil\b/.test(combined)
    ) {
        score -= 30;
    }

    if (/\bdescription\b/.test(name)) {
        score -= 50;
    }

    if (/\bgeometry\b/.test(name)) {
        score -= 50;
    }

    return score;
}

// =============================================================================
// Canonical source preference
// =============================================================================

function canonicalSourceBonus(
    candidate: EquivalentLayerGroup["candidates"][number]
): number {
    const identityText = [
        candidate.inspection.title,
        candidate.inspection.layerName,
        candidate.inspection.serviceName,
        candidate.candidate.title
    ]
        .filter(
            (value): value is string => Boolean(value)
        )
        .map(normalizeField)
        .join(" ");

    let bonus = 0;

    const boundaryNative =
        /\bcouncil\s+districts?\b/.test(identityText) ||
        /\bward\s+boundar(?:y|ies)\b/.test(identityText) ||
        /\bwards?(?:\s*\d{2,4})?\b/.test(identityText) ||
        /\baldermanic\s+districts?\b/.test(identityText) ||
        /\bmunicipal\s+districts?\b/.test(identityText) ||
        /\bpolitical\s+districts?\b/.test(identityText);

    if (boundaryNative) {
        bonus += 20;
    }

    if (candidate.classification.officialMunicipalSource) {
        bonus += 15;
    }

    return bonus;
}

// =============================================================================
// District field selection
// =============================================================================

function findDistrictField(
    candidate: EquivalentLayerGroup["candidates"][number]
): string | undefined {
    const districtType = candidate.classification.districtType;

    if (candidate.inspection.districtField) {
        return candidate.inspection.districtField;
    }

    if (candidate.validation?.districtField) {
        return candidate.validation.districtField;
    }

    const fields = candidate.inspection.fields ?? [];

    const rankedFields = fields
        .map(field => ({
            field,
            score: districtFieldScore(field, districtType)
        }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score);

    if (rankedFields[0]) {
        return rankedFields[0].field.name;
    }

    const districtFields = candidate.inspection.districtFields ?? [];

    if (districtFields.length > 0) {
        return districtFields[0];
    }

    const politicalField = fields.find(
        field =>
            isPoliticalField(field.name) ||
            isPoliticalField(field.alias)
    );

    return politicalField?.name;
}

// =============================================================================
// Canonical eligibility
// =============================================================================

function isCanonicalCandidate(
    candidate: EquivalentLayerGroup["candidates"][number]
): boolean {
    const classification = candidate.classification;
    const validation = candidate.validation;

    if (classification.rejected) {
        return false;
    }

    if (!classification.isPoliticalBoundary) {
        return false;
    }

    if (!classification.isBoundaryLayer) {
        return false;
    }

    if (!classification.districtType) {
        return false;
    }

    if (!validation) {
        return false;
    }

    if (!validation.isLikelyPoliticalBoundary) {
        return false;
    }

    if (validation.confidence < 60) {
        return false;
    }

    if (!validation.districtField) {
        return false;
    }

    if (validation.completeDistrictCoverage === false) {
        return false;
    }

    const geometry = candidate.inspection.geometryType;

    if (
        geometry !== "polygon" &&
        geometry !== "esriGeometryPolygon"
    ) {
        return false;
    }

    return Boolean(findDistrictField(candidate));
}

// =============================================================================
// Select canonical source
// =============================================================================

export function selectCanonicalSource(
    group: EquivalentLayerGroup
): CanonicalSource | undefined {
    if (group.candidates.length === 0) {
        return undefined;
    }

    const eligibleCandidates =
        group.candidates.filter(isCanonicalCandidate);

    if (eligibleCandidates.length === 0) {
        return undefined;
    }

    const ranked = eligibleCandidates
        .map(candidate => ({
            candidate,
            candidateScore: scoreCandidate(candidate),
            temporalPriority: temporalPriority(candidate),
            canonicalBonus: canonicalSourceBonus(candidate)
        }))
        .filter(
            item =>
                item.candidateScore.score !==
                Number.NEGATIVE_INFINITY
        )
        .sort((a, b) => {
            const sourceRoleDifference =
                sourceRolePriority(b.candidate) -
                sourceRolePriority(a.candidate);

            if (sourceRoleDifference !== 0) {
                return sourceRoleDifference;
            }

            if (b.temporalPriority !== a.temporalPriority) {
                return b.temporalPriority - a.temporalPriority;
            }

            if (b.canonicalBonus !== a.canonicalBonus) {
                return b.canonicalBonus - a.canonicalBonus;
            }

            return compareCandidateScores(
                a.candidateScore,
                b.candidateScore
            );
        });

    const best = ranked[0];

    if (!best) {
        return undefined;
    }

    const candidate = best.candidateScore.candidate;
    const inspection = candidate.inspection;
    const classification = candidate.classification;
    const districtField = findDistrictField(candidate);

    if (!classification.districtType || !districtField) {
        return undefined;
    }

    const alternatives: CanonicalAlternative[] =
        ranked
            .slice(1)
            .map(item => {
                const alternative =
                    item.candidateScore.candidate;

                return {
                    url: alternative.inspection.url,
                    itemId: alternative.candidate.itemId,
                    title:
                        alternative.inspection.title ??
                        alternative.inspection.layerName ??
                        alternative.candidate.title,
                    serviceType:
                        alternative.inspection.serviceType,
                    officialMunicipalSource:
                        alternative
                            .classification
                            .officialMunicipalSource,
                    score:
                        item.candidateScore.score
                };
            });

    const validationConfidence =
        candidate.validation?.confidence;

    const requiresReview =
        Boolean(
            candidate.candidate.requiresReview ||
            classification.requiresReview ||
            (
                validationConfidence !== undefined &&
                validationConfidence < 70
            ) ||
            group.confidence < 75
        );

    const coverageReason =
        candidate.validation?.completeDistrictCoverage === true
            ? "district coverage: complete"
            : candidate.validation?.completeDistrictCoverage === false
                ? "district coverage: incomplete"
                : "district coverage: unknown";

    const selectionReasons = [
        ...best.candidateScore.reasons,
        `source role: ${classification.sourceRole}`,
        `source role priority: ${sourceRolePriority(
            candidate
        )}`,
        `temporal priority: ${best.temporalPriority}`,
        coverageReason,
        `canonical source bonus: ${
            best.canonicalBonus >= 0 ? "+" : ""
        }${best.canonicalBonus}`
    ];

    return {
        url: inspection.url,
        itemId: candidate.candidate.itemId,
        title:
            inspection.title ??
            inspection.layerName ??
            inspection.serviceName ??
            candidate.candidate.title ??
            "Municipal district layer",
        city: candidate.candidate.city,
        state: candidate.candidate.state,
        placeFips: candidate.candidate.placeFips,
        districtType: classification.districtType,
        serviceType: inspection.serviceType,
        officialMunicipalSource:
            classification.officialMunicipalSource,
        districtField,
        nameField: inspection.nameField,
        geometryType: inspection.geometryType ?? "unknown",

        // Selection bonuses are not added to the stored candidate score.
        score: best.candidateScore.score,

        alternatives,
        selectionReasons,
        requiresReview
    };
}

// =============================================================================
// Select canonical sources from equivalence groups
// =============================================================================

export function selectCanonicalSources(
    groups: EquivalentLayerGroup[]
): CanonicalSource[] {
    const sources: CanonicalSource[] = [];

    for (const group of groups) {
        const canonical = selectCanonicalSource(group);

        if (canonical) {
            sources.push(canonical);
        }
    }

    return sources;
}

// =============================================================================
// Compare canonical sources
// =============================================================================

export function compareCanonicalSources(
    a: CanonicalSource,
    b: CanonicalSource
): number {
    if (b.score !== a.score) {
        return b.score - a.score;
    }

    if (a.requiresReview !== b.requiresReview) {
        return a.requiresReview ? 1 : -1;
    }

    if (
        a.officialMunicipalSource !==
        b.officialMunicipalSource
    ) {
        return a.officialMunicipalSource ? -1 : 1;
    }

    if (a.serviceType !== b.serviceType) {
        return a.serviceType === "FeatureServer"
            ? -1
            : 1;
    }

    return a.url.localeCompare(b.url);
}

// =============================================================================
// Select municipality-wide canonical source
// =============================================================================

export function selectMunicipalityCanonicalSource(
    groups: EquivalentLayerGroup[]
): CanonicalSource | undefined {
    if (groups.length === 0) {
        return undefined;
    }

    const groupWinners = groups
        .map(group => {
            const source = selectCanonicalSource(group);

            if (!source) {
                return undefined;
            }

            const candidate = group.candidates.find(
                item =>
                    item.inspection.url === source.url
            );

            if (!candidate) {
                return undefined;
            }

            return {
                source,
                candidate
            };
        })
        .filter(
            (
                item
            ): item is {
                source: CanonicalSource;
                candidate:
                    EquivalentLayerGroup["candidates"][number];
            } => item !== undefined
        );

    if (groupWinners.length === 0) {
        return undefined;
    }

    groupWinners.sort((a, b) => {
        const sourceRoleDifference =
            sourceRolePriority(b.candidate) -
            sourceRolePriority(a.candidate);

        if (sourceRoleDifference !== 0) {
            return sourceRoleDifference;
        }

        const temporalDifference =
            temporalPriority(b.candidate) -
            temporalPriority(a.candidate);

        if (temporalDifference !== 0) {
            return temporalDifference;
        }

        const canonicalBonusDifference =
            canonicalSourceBonus(b.candidate) -
            canonicalSourceBonus(a.candidate);

        if (canonicalBonusDifference !== 0) {
            return canonicalBonusDifference;
        }

        return compareCanonicalSources(
            a.source,
            b.source
        );
    });

    return groupWinners[0]?.source;
}