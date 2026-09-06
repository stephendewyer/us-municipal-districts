import assert from "node:assert/strict";
import test from "node:test";

import {
    MUNICIPALITY_VALIDATION_THRESHOLD,
    validateMunicipality
} from "../../generator/src/municipalityValidation.js";

import type {
    ArcGISInspection,
    CensusPlace,
    InspectedCandidate
} from "../../generator/src/types.js";


// =============================================================================
// Test fixtures
// =============================================================================

const TUCSON: CensusPlace = {
    city: "Tucson",
    state: "AZ",
    placeFips: "0477000"
};


/**
 * Create the smallest practical InspectedCandidate fixture for
 * municipality validation tests.
 *
 * The validation logic under test only depends on the inspection
 * metadata, so the other candidate/classification fields are fixed
 * test values.
 */
function createCandidate(
    inspection: Partial<ArcGISInspection> = {}
): InspectedCandidate {

    const baseInspection: ArcGISInspection = {
        url: "https://example.com/FeatureServer/0",
        isArcGIS: true,
        serviceType: "FeatureServer",
        isLayer: true,
        geometryType: "polygon",

        fields: [],
        districtFields: [],
        nameFields: [],
        fieldSamples: [],

        ...inspection
    };

    return {
        candidate: {
            url: "https://example.com/FeatureServer/0",
            title: baseInspection.title ?? "Test Layer",
            placeFips: TUCSON.placeFips,
            city: TUCSON.city,
            state: TUCSON.state,
            score: 100,
            requiresReview: false,
            reasons: [],
            source: "arcgis",
            searchQuery: "Tucson wards"
        },

        inspection: baseInspection,

        classification: {
            isBoundaryLayer: true,
            isPoliticalBoundary: true,
            isThematicDataset: false,
            isCensusDataset: false,
            isParcelDataset: false,
            isHousingDataset: false,
            officialMunicipalSource: true,
            districtType: "ward",
            rejected: false,
            rejectionReasons: [],
            requiresReview: false,
            matches: {
                thematic: [],
                census: [],
                parcel: [],
                housing: [],
                political: [],
                boundary: [],
                official: []
            }
        }
    };
}

// =============================================================================
// Basic municipality matching
// =============================================================================

test(
    "passes when municipality name appears in layer metadata",
    () => {

        const candidate =
            createCandidate({
                title: "Tucson Wards"
            });

        const result =
            validateMunicipality(
                candidate,
                TUCSON
            );

        assert.equal(
            result.likelyMunicipalityMatch,
            true
        );

        assert.ok(
            result.score >=
            MUNICIPALITY_VALIDATION_THRESHOLD
        );
    }
);


test(
    "passes when municipality name appears in service name",
    () => {

        const candidate =
            createCandidate({
                serviceName: "Tucson Municipal GIS"
            });

        const result =
            validateMunicipality(
                candidate,
                TUCSON
            );

        assert.equal(
            result.likelyMunicipalityMatch,
            true
        );
    }
);


test(
    "passes when municipality name appears in layer name",
    () => {

        const candidate =
            createCandidate({
                layerName: "Tucson City Council Districts"
            });

        const result =
            validateMunicipality(
                candidate,
                TUCSON
            );

        assert.equal(
            result.likelyMunicipalityMatch,
            true
        );
    }
);


test(
    "passes when municipality name appears in description",
    () => {

        const candidate =
            createCandidate({
                description:
                    "Official City of Tucson ward boundaries."
            });

        const result =
            validateMunicipality(
                candidate,
                TUCSON
            );

        assert.equal(
            result.likelyMunicipalityMatch,
            true
        );

        assert.ok(
            result.reasons.some(
                reason =>
                    reason.includes(
                        "municipality name"
                    )
            )
        );
    }
);


// =============================================================================
// "City of" matching
// =============================================================================

test(
    "gives additional weight to 'City of Tucson'",
    () => {

        const candidate =
            createCandidate({
                description:
                    "City of Tucson council districts"
            });

        const result =
            validateMunicipality(
                candidate,
                TUCSON
            );

        assert.equal(
            result.likelyMunicipalityMatch,
            true
        );

        assert.ok(
            result.reasons.some(
                reason =>
                    reason.includes(
                        'layer metadata contains "city of tucson"'
                    )
            )
        );
    }
);


// =============================================================================
// Field metadata
// =============================================================================

test(
    "passes when municipality name appears in field metadata",
    () => {

        const candidate =
            createCandidate({
                fields: [
                    {
                        name: "TUCSON_WARD",
                        alias: "Tucson Ward"
                    }
                ]
            });

        const result =
            validateMunicipality(
                candidate,
                TUCSON
            );

        assert.equal(
            result.likelyMunicipalityMatch,
            true
        );
    }
);


test(
    "passes when municipality name appears in district fields",
    () => {

        const candidate =
            createCandidate({
                districtFields: [
                    "TUCSON_WARD"
                ]
            });

        const result =
            validateMunicipality(
                candidate,
                TUCSON
            );

        assert.equal(
            result.likelyMunicipalityMatch,
            true
        );
    }
);


test(
    "passes when municipality name appears in name fields",
    () => {

        const candidate =
            createCandidate({
                nameFields: [
                    "TUCSON_COUNCIL_DISTRICT"
                ]
            });

        const result =
            validateMunicipality(
                candidate,
                TUCSON
            );

        assert.equal(
            result.likelyMunicipalityMatch,
            true
        );
    }
);


// =============================================================================
// Owner / organization
// =============================================================================

test(
    "passes when ArcGIS owner contains municipality name",
    () => {

        const candidate =
            createCandidate({
                owner: "City_Of_Tucson"
            });

        const result =
            validateMunicipality(
                candidate,
                TUCSON
            );

        assert.equal(
            result.likelyMunicipalityMatch,
            true
        );

        assert.ok(
            result.reasons.some(
                reason =>
                    reason.includes(
                        "owner/organization"
                    )
            )
        );
    }
);


test(
    "passes when organization contains municipality name",
    () => {

        const candidate =
            createCandidate({
                organization: "City of Tucson GIS"
            });

        const result =
            validateMunicipality(
                candidate,
                TUCSON
            );

        assert.equal(
            result.likelyMunicipalityMatch,
            true
        );
    }
);


// =============================================================================
// Municipal terminology
// =============================================================================

test(
    "adds positive evidence for municipal terminology",
    () => {

        const candidate =
            createCandidate({
                description:
                    "Municipal ward boundary dataset"
            });

        const result =
            validateMunicipality(
                candidate,
                TUCSON
            );

        assert.ok(
            result.reasons.some(
                reason =>
                    reason.includes(
                        "municipal terminology"
                    )
            )
        );
    }
);


// =============================================================================
// Negative geographic-level evidence
// =============================================================================

test(
    "penalizes county-level metadata",
    () => {

        const candidate =
            createCandidate({
                description:
                    "Pima County ward and district boundaries"
            });

        const result =
            validateMunicipality(
                candidate,
                TUCSON
            );

        assert.ok(
            result.reasons.some(
                reason =>
                    reason.includes(
                        "county-level"
                    )
            )
        );
    }
);


test(
    "penalizes state-level metadata",
    () => {

        const candidate =
            createCandidate({
                description:
                    "Arizona statewide district boundaries"
            });

        const result =
            validateMunicipality(
                candidate,
                TUCSON
            );

        assert.ok(
            result.reasons.some(
                reason =>
                    reason.includes(
                        "state-level"
                    )
            )
        );
    }
);


test(
    "penalizes congressional metadata",
    () => {

        const candidate =
            createCandidate({
                description:
                    "Congressional district boundaries"
            });

        const result =
            validateMunicipality(
                candidate,
                TUCSON
            );

        assert.ok(
            result.reasons.some(
                reason =>
                    reason.includes(
                        "federal-level"
                    )
            )
        );
    }
);


// =============================================================================
// Other municipality detection
// =============================================================================

test(
    "penalizes metadata associated with another municipality",
    () => {

        const candidate =
            createCandidate({
                description:
                    "City of Phoenix ward boundaries"
            });

        const result =
            validateMunicipality(
                candidate,
                TUCSON
            );

        assert.ok(
            result.reasons.some(
                reason =>
                    reason.includes(
                        "another municipality"
                    )
            )
        );
    }
);


// =============================================================================
// Tags and type keywords
// =============================================================================

test(
    "passes when municipality name appears in tags",
    () => {

        const candidate =
            createCandidate({
                tags: [
                    "Tucson",
                    "wards",
                    "elections"
                ]
            });

        const result =
            validateMunicipality(
                candidate,
                TUCSON
            );

        assert.equal(
            result.likelyMunicipalityMatch,
            true
        );
    }
);


test(
    "passes when municipality name appears in type keywords",
    () => {

        const candidate =
            createCandidate({
                typeKeywords: [
                    "Tucson",
                    "Municipal",
                    "Ward"
                ]
            });

        const result =
            validateMunicipality(
                candidate,
                TUCSON
            );

        assert.equal(
            result.likelyMunicipalityMatch,
            true
        );
    }
);


// =============================================================================
// Negative case
// =============================================================================

test(
    "fails when candidate contains no meaningful municipality evidence",
    () => {

        const candidate =
            createCandidate({
                title: "Generic District Boundaries",
                description:
                    "A collection of geographic boundaries."
            });

        const result =
            validateMunicipality(
                candidate,
                TUCSON
            );

        assert.equal(
            result.likelyMunicipalityMatch,
            false
        );

        assert.ok(
            result.score <
            MUNICIPALITY_VALIDATION_THRESHOLD
        );
    }
);


// =============================================================================
// Normalization
// =============================================================================

test(
    "matches municipality names despite underscores and hyphens",
    () => {

        const candidate =
            createCandidate({
                title:
                    "City_of_Tucson-Ward Boundaries"
            });

        const result =
            validateMunicipality(
                candidate,
                TUCSON
            );

        assert.equal(
            result.likelyMunicipalityMatch,
            true
        );
    }
);


// =============================================================================
// Threshold behavior
// =============================================================================

test(
    "returns the municipality validation score and reasons",
    () => {

        const candidate =
            createCandidate({
                title: "Tucson Wards"
            });

        const result =
            validateMunicipality(
                candidate,
                TUCSON
            );

        assert.equal(
            typeof result.score,
            "number"
        );

        assert.ok(
            Array.isArray(result.reasons)
        );

        assert.ok(
            result.reasons.some(
                reason =>
                    reason.includes(
                        "municipality validation score"
                    )
            )
        );
    }
);