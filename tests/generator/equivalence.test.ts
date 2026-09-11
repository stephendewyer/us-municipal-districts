import { test } from "node:test";
import assert from "node:assert/strict";

import type {
    ArcGISInspection,
    ArcGISCandidateValidation,
    CandidateClassification,
    CensusPlace,
    DiscoveryCandidate,
    InspectedCandidate
} from "../../generator/src/types.js";

import {
    compareCandidates,
    detectEquivalentLayers
} from "../../generator/src/equivalence.js";


// =============================================================================
// Test fixtures
// =============================================================================

const TUCSON_PLACE: CensusPlace = {
    placeFips: "0477000",
    city: "Tucson",
    state: "AZ",
    placeType: "incorporated-place"
};


function createClassification(
    options: {
        districtType?: CandidateClassification["districtType"];
        isPoliticalBoundary?: boolean;
        isBoundaryLayer?: boolean;
        rejected?: boolean;
        requiresReview?: boolean;
    } = {}
): CandidateClassification {

    return {

        isBoundaryLayer:
            options.isBoundaryLayer ??
            true,

        isPoliticalBoundary:
            options.isPoliticalBoundary ??
            true,

        isThematicDataset:
            false,

        isCensusDataset:
            false,

        isParcelDataset:
            false,

        isHousingDataset:
            false,

        officialMunicipalSource:
            false,

        districtType:
            options.districtType ??
            "ward",

        temporalStatus: "undated",
        
        sourceRole: "unknown",

        rejected:
            options.rejected ??
            false,

        rejectionReasons: [],

        requiresReview:
            options.requiresReview ??
            false,

        matches: {

            thematic: [],

            census: [],

            parcel: [],

            housing: [],

            political: [
                "ward"
            ],

            boundary: [
                "boundary"
            ],

            official: []
        }
    };
}


function createValidation(
    options: {
        confidence?: number;
        districtField?: string;
        nameField?: string;
        geometryType?: "esriGeometryPolygon" | "esriGeometryPoint";
    } = {}
): ArcGISCandidateValidation {

    return {

        isLikelyPoliticalBoundary:
            true,

        confidence:
            options.confidence ??
            90,

        districtField:
            options.districtField ??
            "WARD",

        sampleCount:
            10,

        distinctDistrictValues: [
            "1",
            "2",
            "3",
            "4",
            "5"
        ],

        districtValuePattern:
            "ward-number",

        geometryType:
            options.geometryType ??
            "esriGeometryPolygon",

        evidence: [
            "equivalence regression fixture"
        ]
    };
}


function createCandidate(
    options: {
        place?: CensusPlace;
        url: string;
        title: string;
        serviceName?: string;
        layerName?: string;
        serviceType?: "FeatureServer" | "MapServer";
        districtField?: string;
        nameField?: string;
        fields?: string[];
        districtType?: CandidateClassification["districtType"];
        isPoliticalBoundary?: boolean;
        isBoundaryLayer?: boolean;
        rejected?: boolean;
        confidence?: number;
        geometryType?: "esriGeometryPolygon" | "esriGeometryPoint";
    }
): InspectedCandidate {

    const place =
        options.place ??
        TUCSON_PLACE;

    const districtField =
        options.districtField ??
        "WARD";

    const nameField =
        options.nameField ??
        "NAME";

    const geometryType =
        options.geometryType ??
        "esriGeometryPolygon";

    const classification =
        createClassification({
            districtType:
                options.districtType ??
                "ward",

            isPoliticalBoundary:
                options.isPoliticalBoundary ??
                true,

            isBoundaryLayer:
                options.isBoundaryLayer ??
                true,

            rejected:
                options.rejected ??
                false
        });

    const candidate:
        DiscoveryCandidate = {

        placeFips:
            place.placeFips,

        city:
            place.city,

        state:
            place.state,

        url:
            options.url,

        title:
            options.title,

        score:
            0,

        requiresReview:
            false,

        reasons: [
            "equivalence regression fixture"
        ],

        source:
            "arcgis"
    };

    const inspection:
        ArcGISInspection = {

        url:
            options.url,

        isArcGIS:
            true,

        serviceType:
            options.serviceType ??
            "FeatureServer",

        isLayer:
            true,

        layerId:
            1,

        title:
            options.title,

        serviceName:
            options.serviceName ??
            "CityWards",

        layerName:
            options.layerName ??
            options.title,

        geometryType,

        fields:
            (
                options.fields ??
                [
                    districtField,
                    nameField,
                    "OBJECTID"
                ]
            ).map(
                name => ({
                    name
                })
            ),

        districtFields: [
            districtField
        ],

        districtField,

        nameFields: [
            nameField
        ],

        nameField,

        fieldSamples: [],

        supportsQuery:
            true,

        supportsGeoJSON:
            true,

        supportsPagination:
            true
    };

    return {

        candidate,

        inspection,

        classification,

        validation:
            createValidation({
                confidence:
                    options.confidence ??
                    90,

                districtField,

                nameField,

                geometryType
            })
    };
}


// =============================================================================
// Equivalence tests
// =============================================================================

test(
    "equivalent: same ward boundary with different temporal versions",
    () => {

        const historical =
            createCandidate({

                url:
                    "https://example.gov/rest/services/Wards_2019/FeatureServer/1",

                title:
                    "Tucson Wards 2019",

                serviceName:
                    "CityWards",

                layerName:
                    "Tucson Wards 2019"
            });

        const current =
            createCandidate({

                url:
                    "https://example.gov/rest/services/Wards_2026/FeatureServer/1",

                title:
                    "Tucson Wards 2026",

                serviceName:
                    "CityWards",

                layerName:
                    "Tucson Wards 2026"
            });

        const result =
            compareCandidates(
                historical,
                current
            );

        assert.equal(
            result.equivalent,
            true
        );

        assert.ok(
            result.confidence >= 0.60
        );
    }
);


test(
    "equivalent: same dataset structure hosted at different ArcGIS URLs",
    () => {

        const first =
            createCandidate({

                url:
                    "https://server-a.example.gov/rest/services/Wards/FeatureServer/1",

                title:
                    "City Wards",

                serviceName:
                    "CityWards",

                layerName:
                    "City Wards"
            });

        const second =
            createCandidate({

                url:
                    "https://server-b.example.gov/rest/services/Wards/FeatureServer/7",

                title:
                    "City Wards",

                serviceName:
                    "CityWards",

                layerName:
                    "City Wards"
            });

        const result =
            compareCandidates(
                first,
                second
            );

        assert.equal(
            result.equivalent,
            true
        );

        assert.ok(
            result.confidence >= 0.60
        );
    }
);


test(
    "not equivalent: candidates from different municipalities",
    () => {

        const otherPlace:
            CensusPlace = {

            placeFips:
                "0455000",

            city:
                "Phoenix",

            state:
                "AZ",

            placeType:
                "incorporated-place"
        };

        const tucson =
            createCandidate({

                url:
                    "https://example.gov/rest/services/Wards/FeatureServer/1",

                title:
                    "City Wards"
            });

        const phoenix =
            createCandidate({

                place:
                    otherPlace,

                url:
                    "https://example.gov/rest/services/Wards/FeatureServer/1",

                title:
                    "City Wards"
            });

        const result =
            compareCandidates(
                tucson,
                phoenix
            );

        assert.equal(
            result.equivalent,
            false
        );

        assert.equal(
            result.confidence,
            0
        );

        assert.ok(
            result.reasons.some(
                reason =>
                    reason.includes(
                        "different municipalities"
                    )
            )
        );
    }
);


test(
    "not equivalent: different political district types",
    () => {

        const ward =
            createCandidate({

                url:
                    "https://example.gov/rest/services/Wards/FeatureServer/1",

                title:
                    "City Districts",

                districtType:
                    "ward"
            });

        const council =
            createCandidate({

                url:
                    "https://example.gov/rest/services/CouncilDistricts/FeatureServer/1",

                title:
                    "City Districts",

                districtType:
                    "council-district"
            });

        const result =
            compareCandidates(
                ward,
                council
            );

        assert.equal(
            result.equivalent,
            false
        );

        assert.equal(
            result.confidence,
            0
        );

        assert.ok(
            result.reasons.some(
                reason =>
                    reason.includes(
                        "different political district types"
                    )
            )
        );
    }
);


test(
    "not equivalent: rejected candidate is excluded from equivalence grouping",
    () => {

        const valid =
            createCandidate({

                url:
                    "https://example.gov/rest/services/Wards/FeatureServer/1",

                title:
                    "City Wards"
            });

        const rejected =
            createCandidate({

                url:
                    "https://example.gov/rest/services/Wards/FeatureServer/2",

                title:
                    "City Wards",

                rejected:
                    true
            });

        const groups =
            detectEquivalentLayers([
                valid,
                rejected
            ]);

        assert.equal(
            groups.length,
            1
        );

        assert.equal(
            groups[0]?.candidates.length,
            1
        );

        assert.equal(
            groups[0]?.candidates[0]?.candidate.url,
            valid.candidate.url
        );
    }
);


test(
    "not equivalent: non-political boundary candidate is excluded",
    () => {

        const political =
            createCandidate({

                url:
                    "https://example.gov/rest/services/Wards/FeatureServer/1",

                title:
                    "City Wards"
            });

        const thematic =
            createCandidate({

                url:
                    "https://example.gov/rest/services/WardAnalysis/FeatureServer/1",

                title:
                    "Ward Analysis",

                isPoliticalBoundary:
                    false
            });

        const groups =
            detectEquivalentLayers([
                political,
                thematic
            ]);

        assert.equal(
            groups.length,
            1
        );

        assert.equal(
            groups[0]?.candidates.length,
            1
        );
    }
);


test(
    "not equivalent: different geometry types",
    () => {

        const polygon =
            createCandidate({

                url:
                    "https://example.gov/rest/services/Wards/FeatureServer/1",

                title:
                    "City Wards",

                geometryType:
                    "esriGeometryPolygon"
            });

        const point =
            createCandidate({

                url:
                    "https://example.gov/rest/services/WardCenters/FeatureServer/1",

                title:
                    "City Wards",

                geometryType:
                    "esriGeometryPoint"
            });

        const groups =
            detectEquivalentLayers([
                polygon,
                point
            ]);

        assert.equal(
            groups.length,
            1
        );

        assert.equal(
            groups[0]?.candidates.length,
            1
        );
    }
);


test(
    "grouping: temporal versions are placed in one group",
    () => {

        const version2019 =
            createCandidate({

                url:
                    "https://example.gov/rest/services/Wards_2019/FeatureServer/1",

                title:
                    "City Wards 2019",

                serviceName:
                    "CityWards",

                layerName:
                    "City Wards 2019"
            });

        const version2023 =
            createCandidate({

                url:
                    "https://example.gov/rest/services/Wards_2023/FeatureServer/2",

                title:
                    "City Wards 2023",

                serviceName:
                    "CityWards",

                layerName:
                    "City Wards 2023"
            });

        const version2026 =
            createCandidate({

                url:
                    "https://example.gov/rest/services/Wards_2026/FeatureServer/3",

                title:
                    "City Wards 2026",

                serviceName:
                    "CityWards",

                layerName:
                    "City Wards 2026"
            });

        const groups =
            detectEquivalentLayers([
                version2019,
                version2023,
                version2026
            ]);

        assert.equal(
            groups.length,
            1
        );

        assert.equal(
            groups[0]?.candidates.length,
            3
        );
    }
);


test(
    "grouping: group IDs are deterministic regardless of candidate order",
    () => {

        const first =
            createCandidate({

                url:
                    "https://example.gov/rest/services/Wards_2019/FeatureServer/1",

                title:
                    "City Wards 2019",

                serviceName:
                    "CityWards",

                layerName:
                    "City Wards 2019"
            });

        const second =
            createCandidate({

                url:
                    "https://example.gov/rest/services/Wards_2026/FeatureServer/2",

                title:
                    "City Wards 2026",

                serviceName:
                    "CityWards",

                layerName:
                    "City Wards 2026"
            });

        const firstResult =
            detectEquivalentLayers([
                first,
                second
            ]);

        const secondResult =
            detectEquivalentLayers([
                second,
                first
            ]);

        assert.equal(
            firstResult.length,
            1
        );

        assert.equal(
            secondResult.length,
            1
        );

        assert.equal(
            firstResult[0]?.id,
            secondResult[0]?.id
        );
    }
);