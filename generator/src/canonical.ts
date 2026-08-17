// generator/src/canonical.ts

import type {
    ArcGISInspection,
    CanonicalAlternative,
    CanonicalSource,
    EquivalentLayerGroup,
    InspectedCandidate
} from "./types.js";


// =============================================================================
// Public API
// =============================================================================

/**
 * Select the single canonical source from a collection of equivalent-layer
 * groups.
 *
 * The candidates should already have been:
 *
 *   1. discovered
 *   2. inspected
 *   3. classified
 *   4. filtered
 *   5. grouped by equivalence
 *
 * This module is responsible only for selecting the best source.
 */
export function selectCanonicalSource(
    groups: EquivalentLayerGroup[]
): CanonicalSource | undefined {

    if (groups.length === 0) {
        return undefined;
    }

    /*
     * Select the best candidate from every equivalent group.
     */
    const groupWinners = groups
        .map(selectBestFromGroup)
        .filter(
            (source): source is CanonicalSource =>
                source !== undefined
        );

    if (groupWinners.length === 0) {
        return undefined;
    }

    /*
     * If multiple independent groups exist, choose the strongest
     * canonical source among them.
     */
    groupWinners.sort(compareCanonicalSources);

    return groupWinners[0];
}


// =============================================================================
// Select best candidate from an equivalent group
// =============================================================================

function selectBestFromGroup(
    group: EquivalentLayerGroup
): CanonicalSource | undefined {

    if (group.candidates.length === 0) {
        return undefined;
    }

    /*
     * Rank all candidates in the group.
     */
    const ranked = group.candidates
        .filter(candidate => !candidate.classification.shouldReject)
        .map(candidate => ({
            candidate,
            score: calculateCanonicalScore(candidate)
        }))
        .sort((a, b) => b.score - a.score);

    const winner = ranked[0];

    if (!winner) {
        return undefined;
    }

    const candidate = winner.candidate;

    const inspection = candidate.inspection;

    /*
     * Determine the district field.
     *
     * This should normally already have been identified during inspection.
     * If it hasn't, we attempt to infer it from the available fields.
     */
    const districtField =
        inspection.districtField ??
        findDistrictField(inspection);

    if (!districtField) {
        /*
         * We cannot safely generate a registry entry without knowing
         * which attribute identifies the district.
         */
        return undefined;
    }

    const nameField =
        inspection.nameField ??
        findNameField(inspection);

    const selectionReasons =
        getSelectionReasons(candidate, winner.score);

    const alternatives: CanonicalAlternative[] =
        ranked
            .slice(1)
            .map(item =>
                createAlternative(item.candidate)
            );

    return {
        url: inspection.url,

        title:
            inspection.title ??
            candidate.candidate.title ??
            inspection.layerName ??
            inspection.serviceName ??
            "Unnamed ArcGIS layer",

        city: candidate.candidate.city,

        state: candidate.candidate.state,

        placeFips: candidate.candidate.placeFips,

        districtType:
            candidate.classification.districtType ??
            "municipal-district",

        serviceType:
            inspection.serviceType,

        officialMunicipalSource:
            candidate.classification.officialMunicipalSource,

        districtField,

        nameField,

        geometryType:
            inspection.geometryType ??
            "unknown",

        score: winner.score,

        alternatives,

        selectionReasons,

        requiresReview:
            shouldRequireReview(
                candidate,
                winner.score,
                districtField
            )
    };
}


// =============================================================================
// Canonical scoring
// =============================================================================

function calculateCanonicalScore(
    candidate: InspectedCandidate
): number {

    const inspection = candidate.inspection;
    const classification = candidate.classification;

    let score = candidate.candidate.score;

    const title = normalizeText(
        inspection.title ??
        candidate.candidate.title ??
        ""
    );

    const serviceName = normalizeText(
        inspection.serviceName ??
        ""
    );

    const layerName = normalizeText(
        inspection.layerName ??
        ""
    );

    const combinedText =
        `${title} ${serviceName} ${layerName}`;


    // -------------------------------------------------------------------------
    // Official municipal source
    // -------------------------------------------------------------------------

    if (classification.officialMunicipalSource) {
        score += 100;
    }


    // -------------------------------------------------------------------------
    // Political boundary
    // -------------------------------------------------------------------------

    if (classification.isPoliticalBoundary) {
        score += 50;
    }


    // -------------------------------------------------------------------------
    // Explicit district terminology
    // -------------------------------------------------------------------------

    if (
        containsAny(combinedText, [
            "council district",
            "city council",
            "council",
            "ward",
            "aldermanic district",
            "municipal district"
        ])
    ) {
        score += 30;
    }


    // -------------------------------------------------------------------------
    // Boundary terminology
    // -------------------------------------------------------------------------

    if (
        containsAny(combinedText, [
            "boundary",
            "boundaries",
            "district boundary",
            "district boundaries"
        ])
    ) {
        score += 25;
    }


    // -------------------------------------------------------------------------
    // Polygon geometry
    // -------------------------------------------------------------------------

    if (
        inspection.geometryType &&
        isPolygonGeometry(
            inspection.geometryType
        )
    ) {
        score += 25;
    }


    // -------------------------------------------------------------------------
    // District field
    // -------------------------------------------------------------------------

    if (inspection.districtField) {
        score += 25;
    } else if (findDistrictField(inspection)) {
        score += 15;
    }


    // -------------------------------------------------------------------------
    // Name field
    // -------------------------------------------------------------------------

    if (inspection.nameField) {
        score += 10;
    } else if (findNameField(inspection)) {
        score += 5;
    }


    // -------------------------------------------------------------------------
    // Feature service
    // -------------------------------------------------------------------------

    if (
        inspection.serviceType === "FeatureServer"
    ) {
        score += 15;
    }


    // -------------------------------------------------------------------------
    // Map service
    // -------------------------------------------------------------------------

    if (
        inspection.serviceType === "MapServer"
    ) {
        score += 10;
    }


    // -------------------------------------------------------------------------
    // Query support
    // -------------------------------------------------------------------------

    if (inspection.supportsQuery) {
        score += 10;
    }


    // -------------------------------------------------------------------------
    // GeoJSON support
    // -------------------------------------------------------------------------

    if (inspection.supportsGeoJSON) {
        score += 5;
    }


    // -------------------------------------------------------------------------
    // Historical source
    // -------------------------------------------------------------------------

    if (isHistorical(combinedText)) {
        score -= 75;
    }


    // -------------------------------------------------------------------------
    // Rejected classification
    // -------------------------------------------------------------------------

    if (classification.shouldReject) {
        score -= 1000;
    }


    // -------------------------------------------------------------------------
    // Non-political classification
    // -------------------------------------------------------------------------

    if (!classification.isPoliticalBoundary) {
        score -= 100;
    }


    return score;
}


// =============================================================================
// Compare canonical sources
// =============================================================================

function compareCanonicalSources(
    a: CanonicalSource,
    b: CanonicalSource
): number {

    /*
     * Official municipal sources are preferred.
     */
    if (
        a.officialMunicipalSource !==
        b.officialMunicipalSource
    ) {
        return a.officialMunicipalSource
            ? -1
            : 1;
    }


    /*
     * Higher score wins.
     */
    if (a.score !== b.score) {
        return b.score - a.score;
    }


    /*
     * FeatureServer is generally preferable because it exposes
     * queryable features directly.
     */
    if (
        a.serviceType !==
        b.serviceType
    ) {

        if (
            a.serviceType ===
            "FeatureServer"
        ) {
            return -1;
        }

        if (
            b.serviceType ===
            "FeatureServer"
        ) {
            return 1;
        }
    }


    /*
     * Prefer an explicitly identified district field.
     */
    const aExplicit =
        a.districtField.length > 0;

    const bExplicit =
        b.districtField.length > 0;

    if (aExplicit !== bExplicit) {
        return aExplicit
            ? -1
            : 1;
    }


    /*
     * Stable deterministic fallback.
     */
    return a.url.localeCompare(b.url);
}


// =============================================================================
// District field detection
// =============================================================================

function findDistrictField(
    inspection: ArcGISInspection
): string | undefined {

    if (!inspection.fields) {
        return undefined;
    }

    const fields =
        inspection.fields;

    /*
     * Strongest candidates first.
     */
    const exactCandidates = [
        "district",
        "districtid",
        "district_id",
        "districtnum",
        "district_num",
        "districtnumber",
        "district_number",
        "ward",
        "wardid",
        "ward_id",
        "wardnum",
        "ward_num",
        "wardnumber",
        "ward_number",
        "councildistrict",
        "council_district",
        "councildistrictid",
        "council_district_id"
    ];

    for (const candidate of exactCandidates) {

        const field =
            fields.find(field =>
                normalizeFieldName(
                    field.name
                ) === normalizeFieldName(candidate)
            );

        if (field) {
            return field.name;
        }
    }


    /*
     * More permissive matching.
     */
    for (const field of fields) {

        const name =
            normalizeFieldName(
                field.name
            );

        if (
            name.includes("district") ||
            name.includes("ward")
        ) {
            return field.name;
        }
    }


    return undefined;
}


// =============================================================================
// Name field detection
// =============================================================================

function findNameField(
    inspection: ArcGISInspection
): string | undefined {

    if (!inspection.fields) {
        return undefined;
    }

    const exactCandidates = [
        "name",
        "districtname",
        "district_name",
        "wardname",
        "ward_name",
        "councildistrictname",
        "council_district_name",
        "label",
        "districtlabel",
        "district_label"
    ];

    for (const candidate of exactCandidates) {

        const field =
            inspection.fields.find(field =>
                normalizeFieldName(
                    field.name
                ) === normalizeFieldName(candidate)
            );

        if (field) {
            return field.name;
        }
    }


    /*
     * More permissive fallback.
     */
    for (const field of inspection.fields) {

        const name =
            normalizeFieldName(
                field.name
            );

        if (
            name.includes("district") &&
            name.includes("name")
        ) {
            return field.name;
        }

        if (
            name.includes("ward") &&
            name.includes("name")
        ) {
            return field.name;
        }
    }


    return undefined;
}


// =============================================================================
// Alternative source
// =============================================================================

function createAlternative(
    candidate: InspectedCandidate
): CanonicalAlternative {

    return {
        url:
            candidate.inspection.url,

        title:
            candidate.inspection.title ??
            candidate.candidate.title,

        serviceType:
            candidate.inspection.serviceType,

        officialMunicipalSource:
            candidate.classification
                .officialMunicipalSource,

        score:
            candidate.candidate.score
    };
}


// =============================================================================
// Selection reasons
// =============================================================================

function getSelectionReasons(
    candidate: InspectedCandidate,
    score: number
): string[] {

    const reasons: string[] = [];

    const inspection =
        candidate.inspection;

    const classification =
        candidate.classification;


    if (
        classification.officialMunicipalSource
    ) {
        reasons.push(
            "Official municipal source"
        );
    }


    if (
        classification.isPoliticalBoundary
    ) {
        reasons.push(
            "Identified as a political boundary"
        );
    }


    if (
        inspection.geometryType &&
        isPolygonGeometry(
            inspection.geometryType
        )
    ) {
        reasons.push(
            "Polygon geometry"
        );
    }


    if (
        inspection.districtField
    ) {
        reasons.push(
            `District field identified: ${inspection.districtField}`
        );
    }


    if (
        inspection.nameField
    ) {
        reasons.push(
            `Name field identified: ${inspection.nameField}`
        );
    }


    if (
        inspection.serviceType ===
        "FeatureServer"
    ) {
        reasons.push(
            "FeatureServer provides queryable features"
        );
    }


    if (
        inspection.supportsGeoJSON
    ) {
        reasons.push(
            "Supports GeoJSON output"
        );
    }


    reasons.push(
        `Canonical score: ${score}`
    );


    return reasons;
}


// =============================================================================
// Review requirements
// =============================================================================

function shouldRequireReview(
    candidate: InspectedCandidate,
    score: number,
    districtField: string
): boolean {

    /*
     * Never automatically accept rejected classifications.
     */
    if (
        candidate.classification.shouldReject
    ) {
        return true;
    }


    /*
     * A missing explicitly detected district field means
     * we had to infer it.
     */
    if (
        !candidate.inspection.districtField
    ) {
        return true;
    }


    /*
     * Low-confidence candidates require review.
     */
    if (score < 100) {
        return true;
    }


    /*
     * Unknown geometry requires review.
     */
    if (
        candidate.inspection.geometryType ===
        "unknown"
    ) {
        return true;
    }


    /*
     * Make sure the field actually exists.
     */
    if (
        candidate.inspection.fields &&
        !candidate.inspection.fields.some(
            field =>
                field.name ===
                districtField
        )
    ) {
        return true;
    }


    return false;
}


// =============================================================================
// Historical source detection
// =============================================================================

function isHistorical(
    text: string
): boolean {

    if (
        containsAny(text, [
            "historical",
            "historic",
            "old wards",
            "old districts",
            "previous wards",
            "previous districts",
            "former wards",
            "former districts",
            "superseded",
            "archive",
            "archived"
        ])
    ) {
        return true;
    }


    /*
     * A year isn't automatically historical because a dataset may
     * represent the current redistricting cycle.
     */
    const years =
        text.match(
            /\b(19|20)\d{2}\b/g
        );

    if (
        !years ||
        years.length === 0
    ) {
        return false;
    }


    const currentYear =
        new Date().getFullYear();


    return years.some(year => {

        const numericYear =
            Number(year);

        return (
            numericYear <
            currentYear - 4
        );
    });
}


// =============================================================================
// Geometry helpers
// =============================================================================

function isPolygonGeometry(
    geometryType: string
): boolean {

    const value =
        geometryType
            .toLowerCase();

    return (
        value ===
            "esrigeometrypolygon" ||
        value ===
            "esripolygon" ||
        value ===
            "polygon" ||
        value.includes("polygon")
    );
}


// =============================================================================
// Text helpers
// =============================================================================

function normalizeText(
    value: string
): string {

    return value
        .toLowerCase()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}


function normalizeFieldName(
    value: string
): string {

    return value
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
}


function containsAny(
    value: string,
    terms: string[]
): boolean {

    return terms.some(term =>
        value.includes(
            normalizeText(term)
        )
    );
}