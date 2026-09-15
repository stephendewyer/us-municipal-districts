import assert from "node:assert/strict";

import test from "node:test";

import {
    inspectArcGIS,
    getFeatureCount,
    getArcGISLayers
} from "../../generator/src/inspectArcGIS.js";

// =============================================================================
// FeatureServer inspection
// =============================================================================

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

// =============================================================================
// MapServer
// =============================================================================

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

// =============================================================================
// Non-ArcGIS
// =============================================================================

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

// =============================================================================
// URL casing
// =============================================================================

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
            /TucsonWards2022.*FeatureServer/i
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

// =============================================================================
// Real Tucson layer
// =============================================================================

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

// =============================================================================
// Feature count
// =============================================================================

test(
    "reads total feature count from an ArcGIS layer",
    async () => {
        const fetchImpl =
            async (
                input: string | URL
            ) => {
                const url =
                    String(input);

                assert.match(
                    url,
                    /\/query\?/
                );

                assert.match(
                    url,
                    /returnCountOnly=true/
                );

                return new Response(
                    JSON.stringify({
                        count: 8
                    }),
                    {
                        status: 200,
                        headers: {
                            "Content-Type":
                                "application/json"
                        }
                    }
                );
            };

        const count =
            await getFeatureCount(
                "https://example.com/arcgis/rest/services/CouncilDistricts/FeatureServer/0",
                fetchImpl
            );

        assert.strictEqual(
            count,
            8
        );
    }
);

// =============================================================================
// Feature count is not district count
// =============================================================================

test(
    "distinguishes total feature count from distinct district values",
    async () => {
        const requestedUrls: string[] = [];

        const fetchImpl =
            async (
                input: string | URL
            ) => {
                const url =
                    String(input);

                requestedUrls.push(
                    url
                );

                if (
                    url.includes(
                        "returnCountOnly=true"
                    )
                ) {
                    return new Response(
                        JSON.stringify({
                            count: 17
                        }),
                        {
                            status: 200,
                            headers: {
                                "Content-Type":
                                    "application/json"
                            }
                        }
                    );
                }

                if (
                    url.includes(
                        "returnDistinctValues=true"
                    )
                ) {
                    return new Response(
                        JSON.stringify({
                            features: [
                                {
                                    attributes: {
                                        DISTRICT:
                                            "1"
                                    }
                                },
                                {
                                    attributes: {
                                        DISTRICT:
                                            "2"
                                    }
                                },
                                {
                                    attributes: {
                                        DISTRICT:
                                            "3"
                                    }
                                }
                            ]
                        }),
                        {
                            status: 200,
                            headers: {
                                "Content-Type":
                                    "application/json"
                            }
                        }
                    );
                }

                return new Response(
                    JSON.stringify({}),
                    {
                        status: 200,
                        headers: {
                            "Content-Type":
                                "application/json"
                        }
                    }
                );
            };

        const count =
            await getFeatureCount(
                "https://example.com/arcgis/rest/services/CouncilDistricts/FeatureServer/0",
                fetchImpl
            );

        assert.strictEqual(
            count,
            17
        );

        assert.ok(
            requestedUrls.some(
                url =>
                    url.includes(
                        "returnCountOnly=true"
                    )
            )
        );

        /*
         * The distinct-value query is now owned by inspectArcGIS(),
         * so this assertion documents the two different ArcGIS query
         * mechanisms without requiring featureCount to be populated
         * during inspection.
         */
        assert.ok(
            requestedUrls.every(
                url =>
                    !url.includes(
                        "returnDistinctValues=true"
                    )
            )
        );
    }
);
