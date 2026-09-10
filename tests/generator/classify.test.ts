import assert from "node:assert/strict";
import test from "node:test";

import {
    classifyCandidate
} from "../../generator/src/classify.js";

import type {
    ArcGISInspection,
    DiscoveryCandidate
} from "../../generator/src/types.js";


// =============================================================================
// Test fixtures
// =============================================================================

function createCandidate(
    overrides: Partial<DiscoveryCandidate> = {}
): DiscoveryCandidate {

    return {
        placeFips: "0477000",
        city: "Tucson",
        state: "AZ",
        url:
            "https://example.com/arcgis/rest/services/test/FeatureServer/0",
        title: "Test Layer",
        score: 100,
        requiresReview: false,
        reasons: [],
        ...overrides
    };
}


function createInspection(
    overrides: Partial<ArcGISInspection> = {}
): ArcGISInspection {

    return {
        url:
            "https://example.com/arcgis/rest/services/test/FeatureServer/0",

        isArcGIS: true,

        serviceType:
            "FeatureServer",

        isLayer:
            true,

        geometryType:
            "esriGeometryPolygon",

        districtFields: [],

        nameFields: [],

        fieldSamples: [],

        ...overrides
    };
}


// =============================================================================
// Political boundary tests
// =============================================================================

test(
    "accepts a real ward boundary with a WARD field",
    () => {

        const candidate =
            createCandidate({
                title:
                    "Tucson Ward Boundaries"
            });

        const inspection =
            createInspection({
                title:
                    "Tucson Ward Boundaries",

                serviceName:
                    "TucsonWards",

                layerName:
                    "Ward Boundaries",

                description:
                    "City of Tucson ward boundary districts",

                fields: [
                    {
                        name:
                            "WARD"
                    },
                    {
                        name:
                            "NAME"
                    }
                ],

                districtFields: [
                    "WARD"
                ],

                nameFields: [
                    "NAME"
                ]
            });


        const result =
            classifyCandidate(
                candidate,
                inspection
            );


        assert.equal(
            result.isPoliticalBoundary,
            true
        );

        assert.equal(
            result.isBoundaryLayer,
            true
        );

        assert.equal(
            result.rejected,
            false
        );

        assert.equal(
            result.districtType,
            "ward"
        );

        assert.ok(
            result.matches.political.length > 0
        );
    }
);


test(
    "rejects a thematic polygon layer with a WARD attribute",
    () => {

        const candidate =
            createCandidate({
                title:
                    "TPRD_GOLF"
            });

        const inspection =
            createInspection({
                title:
                    "TPRD_GOLF",

                serviceName:
                    "Tucson_City_Golf_Course_HFL",

                layerName:
                    "Golf Courses",

                description:
                    "Tucson golf course project and park data",

                fields: [
                    {
                        name:
                            "WARD"
                    },
                    {
                        name:
                            "NAME"
                    }
                ],

                districtFields: [
                    "WARD"
                ],

                nameFields: [
                    "NAME"
                ]
            });


        const result =
            classifyCandidate(
                candidate,
                inspection
            );


        assert.equal(
            result.isPoliticalBoundary,
            false
        );

        assert.equal(
            result.isBoundaryLayer,
            false
        );

        assert.equal(
            result.rejected,
            true
        );

        assert.equal(
            result.districtType,
            undefined
        );

        assert.equal(
            result.isThematicDataset,
            true
        );

        assert.ok(
            result.matches.thematic.includes(
                "golf"
            )
        );

        assert.ok(
            result.matches.thematic.includes(
                "park"
            )
        );

        assert.ok(
            result.rejectionReasons.some(
                reason =>
                    reason.includes(
                        "political district field"
                    )
            )
        );
    }
);


// =============================================================================
// Political identity tests
// =============================================================================

test(
    "accepts a polygon whose title clearly identifies a council district",
    () => {

        const candidate =
            createCandidate({
                title:
                    "Phoenix City Council Districts",

                city:
                    "Phoenix",

                state:
                    "AZ",

                placeFips:
                    "0455000"
            });

        const inspection =
            createInspection({
                title:
                    "Phoenix City Council Districts",

                serviceName:
                    "PhoenixCouncilDistricts",

                layerName:
                    "Council Districts",

                fields: [
                    {
                        name:
                            "DISTRICT"
                    },
                    {
                        name:
                            "NAME"
                    }
                ],

                districtFields: [
                    "DISTRICT"
                ],

                nameFields: [
                    "NAME"
                ]
            });


        const result =
            classifyCandidate(
                candidate,
                inspection
            );


        assert.equal(
            result.isPoliticalBoundary,
            true
        );

        assert.equal(
            result.rejected,
            false
        );

        assert.equal(
            result.districtType,
            "council-district"
        );

        assert.ok(
            result.matches.political.includes(
                "council district"
            )
        );
    }
);


test(
    "does not infer ward district type from a field alone",
    () => {

        const candidate =
            createCandidate({
                title:
                    "Tucson Golf Courses"
            });

        const inspection =
            createInspection({
                title:
                    "Tucson Golf Courses",

                serviceName:
                    "TucsonGolfCourses",

                layerName:
                    "Golf Courses",

                description:
                    "Golf course boundaries",

                fields: [
                    {
                        name:
                            "WARD"
                    }
                ],

                districtFields: [
                    "WARD"
                ]
            });


        const result =
            classifyCandidate(
                candidate,
                inspection
            );


        assert.equal(
            result.districtType,
            undefined
        );
    }
);