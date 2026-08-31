import assert from "node:assert/strict";
import test from "node:test";

import {
    inspectArcGIS,
    getArcGISLayers,
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
            result.isLayer,
            true
        );

        assert.equal(
            result.layerId,
            0
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


test(
    "preserves ArcGIS URL casing when expanding a service",
    async () => {

        const requestedUrls:
            string[] = [];


        const fakeFetch:
            typeof fetch =
            async (
                input
            ) => {

                const requestedUrl =
                    typeof input === "string"
                        ? input
                        : input.toString();

                requestedUrls.push(
                    requestedUrl
                );


                return new Response(
                    JSON.stringify({
                        layers: [
                            {
                                id: 156,

                                name:
                                    "TucsonWards2022",

                                type:
                                    "Feature Layer",
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
            };


        const serviceUrl =
            "https://services1.arcgis.com/Ezk9fcjSUkeadg6u/ArcGIS/rest/services/TucsonWards2022/FeatureServer";


        const layers =
            await getArcGISLayers(
                serviceUrl,
                fakeFetch
            );


        assert.equal(
            requestedUrls.length,
            1
        );


        /*
         * This assertion is the important part.
         *
         * The request must contain:
         *
         *     TucsonWards2022
         *
         * and NOT:
         *
         *     tucsonwards2022
         */
        assert.match(
            requestedUrls[0],
            /\/TucsonWards2022\/FeatureServer/i
        );


        assert.ok(
            requestedUrls[0].includes(
                "/TucsonWards2022/"
            )
        );


        assert.deepEqual(
            layers,
            [
                {
                    id: 156,

                    name:
                        "TucsonWards2022",

                    type:
                        "Feature Layer",

                    url:
                        "https://services1.arcgis.com/Ezk9fcjSUkeadg6u/ArcGIS/rest/services/TucsonWards2022/FeatureServer/156",
                },
            ]
        );
    }
);


test(
    "inspects the real TucsonWards2022 layer",
    async () => {

        const url =
            "https://services1.arcgis.com/Ezk9fcjSUkeadg6u/ArcGIS/rest/services/TucsonWards2022/FeatureServer/156";


        const result =
            await inspectArcGIS(
                url
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
            result.isLayer,
            true
        );

        assert.equal(
            result.layerId,
            156
        );

        assert.equal(
            result.geometryType,
            "esriGeometryPolygon"
        );


        /*
         * The important Tucson-specific assertion.
         *
         * The actual field is "Label", so we should NOT
         * require Label to be detected as a political field.
         */
        assert.ok(
            result.fields?.some(
                field =>
                    field.name === "Label"
            )
        );


        assert.ok(
            result.title
                ?.toLowerCase()
                .includes("tucson")
        );
    }
);