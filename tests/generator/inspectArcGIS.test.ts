import assert from "node:assert/strict";
import test from "node:test";

import {
    inspectArcGIS,
} from "../../generator/src/inspectArcGIS.js";

test(
    "inspects an ArcGIS FeatureServer layer",
    async () => {
        const fakeFetch:
            typeof fetch =
            async () =>
                new Response(
                    JSON.stringify({
                        name:
                            "Phoenix Council Districts",

                        description:
                            "Phoenix City Council District boundaries",

                        geometryType:
                            "esriGeometryPolygon",

                        hasZ: false,

                        hasM: false,

                        supportedQueryFormats:
                            "JSON, geoJSON, PBF",

                        fields: [
                            {
                                name:
                                    "OBJECTID",
                            },
                            {
                                name:
                                    "DISTRICT",
                            },
                            {
                                name:
                                    "REP_NAME",
                            },
                        ],
                    }),
                    {
                        status: 200,
                        headers: {
                            "content-type":
                                "application/json",
                        },
                    }
                );

        const result =
            await inspectArcGIS(
                "https://example.com/arcgis/rest/services/PhoenixCityCouncilDistricts/FeatureServer/0",
                fakeFetch
            );

        assert.equal(
            result.isArcGIS,
            true
        );

        assert.equal(
            result.serviceType,
            "FeatureServer"
        );

        assert.equal(
            result.geometryType,
            "esriGeometryPolygon"
        );

        assert.deepEqual(
            result.districtFields,
            ["DISTRICT"]
        );

        assert.equal(
            result.supportsGeoJSON,
            true
        );
    }
);

test(
    "recognizes a MapServer",
    async () => {
        const fakeFetch:
            typeof fetch =
            async () =>
                new Response(
                    JSON.stringify({
                        name:
                            "Council District",

                        geometryType:
                            "esriGeometryPolygon",

                        fields: [
                            {
                                name:
                                    "DISTRICT",
                            },
                        ],

                        supportedQueryFormats:
                            "JSON, geoJSON",
                    }),
                    {
                        status: 200,
                    }
                );

        const result =
            await inspectArcGIS(
                "https://example.com/arcgis/rest/services/Public/Council_Districts/MapServer/0",
                fakeFetch
            );

        assert.equal(
            result.serviceType,
            "MapServer"
        );

        assert.equal(
            result.geometryType,
            "esriGeometryPolygon"
        );
    }
);

test(
    "returns unknown for non-ArcGIS URLs",
    async () => {
        const result =
            await inspectArcGIS(
                "https://example.com/data/wards.geojson"
            );

        assert.equal(
            result.isArcGIS,
            false
        );

        assert.equal(
            result.serviceType,
            "unknown"
        );
    }
);