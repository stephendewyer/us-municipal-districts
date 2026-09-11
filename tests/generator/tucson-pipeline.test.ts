import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type {
    ArcGISCandidateValidation,
    ArcGISInspection,
    CandidateClassification,
    CensusPlace,
    DiscoveryCandidate,
    InspectedCandidate
} from "../../generator/src/types.js";

import { buildDiscoveryResult } from "../../generator/src/pipeline.js";

// =============================================================================
// Fixtures
// =============================================================================

const TUCSON_PLACE: CensusPlace = {
    placeFips: "0477000",
    city: "Tucson",
    state: "AZ"
};

const TUCSON_WARDS_URL =
    "https://services1.arcgis.com/Ezk9fcjSUkeadg6u/arcgis/rest/services/TucsonWards2022/FeatureServer/156";

const TUCSON_GOLF_URL =
    "https://services3.arcgis.com/9coHY2fvuFjG9HQX/arcgis/rest/services/Tucson_City_Golf_Course_HFL/FeatureServer/21";

const TUCSON_WARDS_ITEM_ID =
    "cbb29b7016c04c43b3b51ba60db17643";

// =============================================================================
// Fixture helpers
// =============================================================================

function makeMatches(
    overrides: Partial<CandidateClassification["matches"]> = {}
): CandidateClassification["matches"] {
    return {
        thematic: [],
        census: [],
        parcel: [],
        housing: [],
        political: ["ward"],
        boundary: ["boundary", "ward"],
        official: ["City of Tucson"],
        ...overrides
    };
}

function makeClassification(
    overrides: Partial<CandidateClassification> = {}
): CandidateClassification {
    return {
        isBoundaryLayer: true,
        isPoliticalBoundary: true,
        isThematicDataset: false,
        isCensusDataset: false,
        isParcelDataset: false,
        isHousingDataset: false,
        officialMunicipalSource: true,
        districtType: "ward",
        temporalStatus: "undated",  
        sourceRole: "unknown",
        rejected: false,
        rejectionReasons: [],
        requiresReview: false,
        matches: makeMatches(),
        ...overrides
    };
}

function makeInspection(
    overrides: Partial<ArcGISInspection> = {}
): ArcGISInspection {
    return {
        url: TUCSON_WARDS_URL,
        isArcGIS: true,
        serviceType: "FeatureServer",
        isLayer: true,
        layerId: 156,
        title: "TucsonWards2022",
        geometryType: "esriGeometryPolygon",
        objectIdField: "OBJECTID",
        fields: [
            {
                name: "OBJECTID",
                type: "esriFieldTypeOID"
            },
            {
                name: "WARD",
                type: "esriFieldTypeInteger"
            },
            {
                name: "NAME",
                type: "esriFieldTypeString"
            }
        ],
        districtFields: ["WARD"],
        districtField: "WARD",
        nameFields: ["NAME"],
        nameField: "NAME",
        fieldSamples: [
            {
                field: "WARD",
                values: [
                    "1",
                    "2",
                    "3",
                    "4",
                    "5",
                    "6"
                ]
            },
            {
                field: "NAME",
                values: [
                    "Ward 1",
                    "Ward 2",
                    "Ward 3",
                    "Ward 4",
                    "Ward 5",
                    "Ward 6"
                ]
            }
        ],
        supportsQuery: true,
        supportsGeoJSON: true,
        supportsPagination: true,
        itemId: TUCSON_WARDS_ITEM_ID,
        ...overrides
    };
}

function makeValidation(
    overrides: Partial<ArcGISCandidateValidation> = {}
): ArcGISCandidateValidation {
    return {
        isLikelyPoliticalBoundary: true,
        confidence: 0.98,
        districtField: "WARD",
        sampleCount: 6,
        featureCount: 6,
        distinctDistrictValues: [
            "1",
            "2",
            "3",
            "4",
            "5",
            "6"
        ],
        districtValuePattern: "ward-number",
        geometryType: "esriGeometryPolygon",
        municipalityOverlap: 1,
        evidence: [
            "Polygon geometry",
            "Ward district field",
            "Multiple district values",
            "Municipal boundary dataset"
        ],
        ...overrides
    };
}

function makeCandidate(
    overrides: Partial<InspectedCandidate> = {}
): InspectedCandidate {
    const candidate: DiscoveryCandidate = {
        itemId: "test-item-id",
        placeFips: TUCSON_PLACE.placeFips,
        city: TUCSON_PLACE.city,
        state: TUCSON_PLACE.state,
        url: TUCSON_WARDS_URL,
        title: "Tucson Ward Boundaries",
        score: 90,
        requiresReview: false,
        reasons: [
            "Municipal ward boundary candidate"
        ],
        source: "arcgis",
        searchQuery: "Tucson AZ ward boundaries"
    };

    const inspection = makeInspection();
    const classification = makeClassification();
    const validation = makeValidation();

    return {
        candidate,
        inspection,
        classification,
        validation,
        ...overrides
    };
}

function makeTucsonWardsCandidate(
    overrides: Partial<InspectedCandidate> = {},
    validationOverrides: Partial<ArcGISCandidateValidation> = {}
): InspectedCandidate {
    const base = makeCandidate();

    return {
        ...base,

        candidate: {
            ...base.candidate,
            itemId: TUCSON_WARDS_ITEM_ID,
            placeFips: TUCSON_PLACE.placeFips,
            city: TUCSON_PLACE.city,
            state: TUCSON_PLACE.state,
            url: TUCSON_WARDS_URL,
            title: "TucsonWards2022",
            score: 100,
            requiresReview: false,
            reasons: [
                "Official Tucson ward boundary dataset"
            ],
            source: "arcgis",
            searchQuery: "Tucson AZ ward boundaries"
        },

        inspection: {
            ...base.inspection,
            url: TUCSON_WARDS_URL,
            title: "TucsonWards2022",
            itemId: TUCSON_WARDS_ITEM_ID
        },

        classification: {
            ...base.classification,
            officialMunicipalSource: true,
            districtType: "ward"
        },

        validation: {
            ...base.validation!,
            ...validationOverrides
        },

        ...overrides
    };
}

function makeGolfCandidate(): InspectedCandidate {
    const base = makeCandidate();

    return {
        ...base,

        candidate: {
            ...base.candidate,
            itemId: "golf-item-id",
            url: TUCSON_GOLF_URL,
            title: "Tucson City Golf Course HFL",
            score: 90,
            reasons: [
                "Contains Tucson in title"
            ]
        },

        inspection: {
            ...base.inspection,
            url: TUCSON_GOLF_URL,
            title: "Tucson City Golf Course HFL",
            districtFields: [],
            districtField: undefined,
            nameFields: ["NAME"],
            nameField: "NAME",
            fields: [
                {
                    name: "OBJECTID",
                    type: "esriFieldTypeOID"
                },
                {
                    name: "NAME",
                    type: "esriFieldTypeString"
                }
            ],
            fieldSamples: [
                {
                    field: "NAME",
                    values: [
                        "El Rio Golf Course",
                        "Silverbell Golf Course"
                    ]
                }
            ]
        },

        classification: makeClassification({
            isPoliticalBoundary: false,
            isThematicDataset: true,
            isCensusDataset: false,
            isParcelDataset: false,
            isHousingDataset: false,
            officialMunicipalSource: false,
            districtType: undefined,
            rejected: true,
            rejectionReasons: [
                "Thematic dataset",
                "Not a political district boundary"
            ],
            requiresReview: false,
            matches: makeMatches({
                thematic: [
                    "golf",
                    "course"
                ],
                political: [],
                boundary: [],
                official: []
            })
        }),

        validation: makeValidation({
            isLikelyPoliticalBoundary: false,
            confidence: 0.05,
            districtField: undefined,
            sampleCount: 0,
            featureCount: 2,
            distinctDistrictValues: [],
            districtValuePattern: "unknown",
            evidence: [
                "Thematic golf-course dataset"
            ]
        })
    };
}

// =============================================================================
// Tests
// =============================================================================

describe("Tucson discovery pipeline", () => {

    it("accepts a valid Tucson ward boundary candidate", () => {
        const candidate = makeTucsonWardsCandidate();

        const result = buildDiscoveryResult(
            TUCSON_PLACE,
            [candidate]
        );

        assert.strictEqual(
            result.validCandidates.length,
            1
        );

        assert.strictEqual(
            result.rejectedCandidates.length,
            0
        );

        assert.strictEqual(
            result.validCandidates[0].candidate.url,
            TUCSON_WARDS_URL
        );
    });

    it("rejects a thematic golf-course dataset", () => {
        const candidate = makeGolfCandidate();

        const result = buildDiscoveryResult(
            TUCSON_PLACE,
            [candidate]
        );

        assert.strictEqual(
            result.validCandidates.length,
            0
        );

        assert.strictEqual(
            result.rejectedCandidates.length,
            1
        );

        assert.strictEqual(
            result.rejectedCandidates[0].candidate.url,
            TUCSON_GOLF_URL
        );
    });

    it("rejects a candidate that is not classified as a political boundary", () => {
        const candidate = makeTucsonWardsCandidate({
            classification: makeClassification({
                isPoliticalBoundary: false,
                rejected: true,
                rejectionReasons: [
                    "Not classified as a political boundary"
                ]
            })
        });

        const result = buildDiscoveryResult(
            TUCSON_PLACE,
            [candidate]
        );

        assert.strictEqual(
            result.validCandidates.length,
            0
        );

        assert.strictEqual(
            result.rejectedCandidates.length,
            1
        );
    });

    it("rejects a candidate without validation", () => {
        const candidate = makeTucsonWardsCandidate({
            validation: undefined
        });

        const result = buildDiscoveryResult(
            TUCSON_PLACE,
            [candidate]
        );

        assert.strictEqual(
            result.validCandidates.length,
            0
        );

        assert.strictEqual(
            result.rejectedCandidates.length,
            1
        );
    });

    it("rejects validation that says the layer is not a political boundary", () => {
        const candidate = makeTucsonWardsCandidate(
            {},
            {
                isLikelyPoliticalBoundary: false,
                confidence: 0.95,
                evidence: [
                    "Layer does not appear to represent political districts"
                ]
            }
        );

        const result = buildDiscoveryResult(
            TUCSON_PLACE,
            [candidate]
        );

        assert.strictEqual(
            result.validCandidates.length,
            0
        );

        assert.strictEqual(
            result.rejectedCandidates.length,
            1
        );
    });

    it("rejects a candidate with low validation confidence", () => {
        const candidate = makeTucsonWardsCandidate(
            {},
            {
                confidence: 0.59
            }
        );

        const result = buildDiscoveryResult(
            TUCSON_PLACE,
            [candidate]
        );

        assert.strictEqual(
            result.validCandidates.length,
            0
        );

        assert.strictEqual(
            result.rejectedCandidates.length,
            1
        );
    });

    it("accepts a candidate at the validation confidence threshold", () => {
        const candidate = makeTucsonWardsCandidate(
            {},
            {
                confidence: 0.60
            }
        );

        const result = buildDiscoveryResult(
            TUCSON_PLACE,
            [candidate]
        );

        assert.strictEqual(
            result.validCandidates.length,
            1
        );
    });

    it("rejects a non-polygon candidate", () => {
        const candidate = makeTucsonWardsCandidate(
            {
                inspection: makeInspection({
                    geometryType: "esriGeometryPolyline"
                })
            },
            {
                geometryType: "esriGeometryPolyline"
            }
        );

        const result = buildDiscoveryResult(
            TUCSON_PLACE,
            [candidate]
        );

        assert.strictEqual(
            result.validCandidates.length,
            0
        );

        assert.strictEqual(
            result.rejectedCandidates.length,
            1
        );
    });

    it("rejects a candidate with fewer than two district values", () => {
        const candidate = makeTucsonWardsCandidate(
            {},
            {
                distinctDistrictValues: ["1"]
            }
        );

        const result = buildDiscoveryResult(
            TUCSON_PLACE,
            [candidate]
        );

        assert.strictEqual(
            result.validCandidates.length,
            0
        );

        assert.strictEqual(
            result.rejectedCandidates.length,
            1
        );
    });

    it("rejects a candidate without a district field", () => {
        const candidate = makeTucsonWardsCandidate(
            {
                inspection: makeInspection({
                    districtFields: [],
                    districtField: undefined
                })
            },
            {
                districtField: undefined
            }
        );

        const result = buildDiscoveryResult(
            TUCSON_PLACE,
            [candidate]
        );

        assert.strictEqual(
            result.validCandidates.length,
            0
        );

        assert.strictEqual(
            result.rejectedCandidates.length,
            1
        );
    });

    it("ranks the stronger Tucson ward candidate above a weaker candidate", () => {
        const strong = makeTucsonWardsCandidate();

        const weak = makeTucsonWardsCandidate({
            candidate: {
                ...strong.candidate,
                itemId: "weaker-item-id",
                url: "https://example.com/weaker/FeatureServer/0",
                title: "Tucson Ward Boundaries Alternative",
                score: 70,
                reasons: [
                    "Possible Tucson ward boundary dataset"
                ]
            },

            classification: {
                ...strong.classification,
                officialMunicipalSource: false
            },

            validation: {
                ...strong.validation!,
                confidence: 0.75
            }
        });

        const result = buildDiscoveryResult(
            TUCSON_PLACE,
            [weak, strong]
        );

        assert.ok(
            result.rankedCandidates.length >= 2
        );

        assert.strictEqual(
            result.rankedCandidates[0].candidate.candidate.url,
            TUCSON_WARDS_URL
        );
    });

    it("groups equivalent Tucson ward candidates", () => {
        const first = makeTucsonWardsCandidate();

        const second = makeTucsonWardsCandidate({
            candidate: {
                ...first.candidate,
                itemId: "equivalent-item-id",
                url: "https://example.com/tucson/FeatureServer/0",
                title: "Tucson Ward Boundaries Alternative"
            },

            inspection: {
                ...first.inspection,
                url: "https://example.com/tucson/FeatureServer/0",
                title: "Tucson Ward Boundaries Alternative"
            }
        });

        const result = buildDiscoveryResult(
            TUCSON_PLACE,
            [first, second]
        );

        assert.ok(
            result.equivalentGroups.length > 0
        );

        const group = result.equivalentGroups.find(
            group => group.candidates.length >= 2
        );

        assert.ok(group);
    });

    it("selects the TucsonWards2022 layer as the canonical source", () => {
        const primary = makeTucsonWardsCandidate();

        const alternative = makeTucsonWardsCandidate({
            candidate: {
                ...primary.candidate,
                itemId: "alternative-item-id",
                url: "https://example.com/alternative/FeatureServer/0",
                title: "Tucson Ward Boundaries Alternative",
                score: 70,
                reasons: [
                    "Alternative Tucson ward boundary dataset"
                ]
            },

            inspection: {
                ...primary.inspection,
                url: "https://example.com/alternative/FeatureServer/0",
                title: "Tucson Ward Boundaries Alternative"
            },

            classification: {
                ...primary.classification,
                officialMunicipalSource: false
            },

            validation: {
                ...primary.validation!,
                confidence: 0.75
            }
        });

        const result = buildDiscoveryResult(
            TUCSON_PLACE,
            [alternative, primary]
        );

        assert.ok(result.canonical);

        assert.strictEqual(
            result.canonical?.url,
            TUCSON_WARDS_URL
        );

        assert.strictEqual(
            result.canonical?.title,
            "TucsonWards2022"
        );
    });

    it("selects the same canonical source regardless of discovery order", () => {
        const primary = makeTucsonWardsCandidate();

        const alternative = makeTucsonWardsCandidate({
            candidate: {
                ...primary.candidate,
                itemId: "alternative-item-id",
                url: "https://example.com/alternative/FeatureServer/0",
                title: "Tucson Ward Boundaries Alternative",
                score: 70
            },

            inspection: {
                ...primary.inspection,
                url: "https://example.com/alternative/FeatureServer/0",
                title: "Tucson Ward Boundaries Alternative"
            },

            classification: {
                ...primary.classification,
                officialMunicipalSource: false
            },

            validation: {
                ...primary.validation!,
                confidence: 0.75
            }
        });

        const resultA = buildDiscoveryResult(
            TUCSON_PLACE,
            [primary, alternative]
        );

        const resultB = buildDiscoveryResult(
            TUCSON_PLACE,
            [alternative, primary]
        );

        assert.strictEqual(
            resultA.canonical?.url,
            resultB.canonical?.url
        );

        assert.strictEqual(
            resultA.canonical?.url,
            TUCSON_WARDS_URL
        );
    });

    it("marks canonical sources for manual review when review mode is enabled", () => {
        const candidate = makeTucsonWardsCandidate();

        const result = buildDiscoveryResult(
            TUCSON_PLACE,
            [candidate],
            {
                review: true
            }
        );

        assert.ok(result.canonical);

        assert.strictEqual(
            result.canonical?.requiresReview,
            true
        );

        assert.ok(
            result.canonicalSources.every(
                source => source.requiresReview === true
            )
        );
    });
});