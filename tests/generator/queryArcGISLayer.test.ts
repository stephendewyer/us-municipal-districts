import assert from "node:assert/strict";
import test from "node:test";

import {
    queryArcGISLayer
} from "../../generator/src/queryArcGISLayer.js";


// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function createResponse(
    body: unknown,
    status = 200
): Response {

    return new Response(
        JSON.stringify(body),
        {
            status,
            headers: {
                "Content-Type":
                    "application/json"
            }
        }
    );
}


// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

test(
    "queryArcGISLayer builds a basic ArcGIS query URL",
    async () => {

        let requestedUrl:
            string | undefined;

        const result =
            await queryArcGISLayer(
                "https://example.com/FeatureServer/0",
                {},
                async input => {

                    requestedUrl =
                        String(input);

                    return createResponse({
                        features: []
                    });
                }
            );

        assert.equal(
            result.success,
            true
        );

        assert.ok(
            requestedUrl
        );

        const url =
            new URL(
                requestedUrl
            );

        assert.equal(
            url.pathname,
            "/FeatureServer/0/query"
        );

        assert.equal(
            url.searchParams.get(
                "where"
            ),
            "1=1"
        );

        assert.equal(
            url.searchParams.get(
                "outFields"
            ),
            "*"
        );

        assert.equal(
            url.searchParams.get(
                "returnGeometry"
            ),
            "false"
        );

        assert.equal(
            url.searchParams.get(
                "f"
            ),
            "json"
        );

        assert.equal(
            url.searchParams.get(
                "resultRecordCount"
            ),
            "100"
        );

        assert.equal(
            url.searchParams.get(
                "resultOffset"
            ),
            "0"
        );

        assert.equal(
            url.searchParams.has(
                "outSR"
            ),
            false
        );
    }
);


test(
    "queryArcGISLayer uses WGS 84 when geometry is requested",
    async () => {

        let requestedUrl:
            string | undefined;

        const result =
            await queryArcGISLayer(
                "https://example.com/FeatureServer/0",
                {
                    returnGeometry:
                        true
                },
                async input => {

                    requestedUrl =
                        String(input);

                    return createResponse({
                        features: [
                            {
                                attributes: {
                                    WARD:
                                        "1"
                                },

                                geometry: {
                                    rings: []
                                }
                            }
                        ]
                    });
                }
            );

        assert.equal(
            result.success,
            true
        );

        assert.ok(
            requestedUrl
        );

        const url =
            new URL(
                requestedUrl
            );

        assert.equal(
            url.searchParams.get(
                "returnGeometry"
            ),
            "true"
        );

        assert.equal(
            url.searchParams.get(
                "outSR"
            ),
            "4326"
        );
    }
);


test(
    "queryArcGISLayer allows an explicit output spatial reference",
    async () => {

        let requestedUrl:
            string | undefined;

        const result =
            await queryArcGISLayer(
                "https://example.com/FeatureServer/0",
                {
                    returnGeometry:
                        true,

                    outSR:
                        3857
                },
                async input => {

                    requestedUrl =
                        String(input);

                    return createResponse({
                        features: []
                    });
                }
            );

        assert.equal(
            result.success,
            true
        );

        assert.ok(
            requestedUrl
        );

        const url =
            new URL(
                requestedUrl
            );

        assert.equal(
            url.searchParams.get(
                "outSR"
            ),
            "3857"
        );
    }
);


test(
    "queryArcGISLayer does not send outSR when geometry is not requested",
    async () => {

        let requestedUrl:
            string | undefined;

        const result =
            await queryArcGISLayer(
                "https://example.com/FeatureServer/0",
                {
                    returnGeometry:
                        false,

                    outSR:
                        3857
                },
                async input => {

                    requestedUrl =
                        String(input);

                    return createResponse({
                        features: []
                    });
                }
            );

        assert.equal(
            result.success,
            true
        );

        assert.ok(
            requestedUrl
        );

        const url =
            new URL(
                requestedUrl
            );

        assert.equal(
            url.searchParams.get(
                "returnGeometry"
            ),
            "false"
        );

        assert.equal(
            url.searchParams.has(
                "outSR"
            ),
            false
        );
    }
);


test(
    "queryArcGISLayer includes where and outFields",
    async () => {

        let requestedUrl:
            string | undefined;

        const result =
            await queryArcGISLayer(
                "https://example.com/MapServer/5",
                {
                    where:
                        "WARD = '3'",

                    outFields: [
                        "WARD",
                        "DISTRICT"
                    ]
                },
                async input => {

                    requestedUrl =
                        String(input);

                    return createResponse({
                        features: []
                    });
                }
            );

        assert.equal(
            result.success,
            true
        );

        assert.ok(
            requestedUrl
        );

        const url =
            new URL(
                requestedUrl
            );

        assert.equal(
            url.searchParams.get(
                "where"
            ),
            "WARD = '3'"
        );

        assert.equal(
            url.searchParams.get(
                "outFields"
            ),
            "WARD,DISTRICT"
        );
    }
);


test(
    "queryArcGISLayer includes pagination parameters",
    async () => {

        let requestedUrl:
            string | undefined;

        const result =
            await queryArcGISLayer(
                "https://example.com/FeatureServer/0",
                {
                    resultRecordCount:
                        250,

                    resultOffset:
                        500
                },
                async input => {

                    requestedUrl =
                        String(input);

                    return createResponse({
                        features: []
                    });
                }
            );

        assert.equal(
            result.success,
            true
        );

        assert.ok(
            requestedUrl
        );

        const url =
            new URL(
                requestedUrl
            );

        assert.equal(
            url.searchParams.get(
                "resultRecordCount"
            ),
            "250"
        );

        assert.equal(
            url.searchParams.get(
                "resultOffset"
            ),
            "500"
        );
    }
);


test(
    "queryArcGISLayer normalizes a trailing slash in the URL",
    async () => {

        let requestedUrl:
            string | undefined;

        const result =
            await queryArcGISLayer(
                "https://example.com/FeatureServer/0///",
                {},
                async input => {

                    requestedUrl =
                        String(input);

                    return createResponse({
                        features: []
                    });
                }
            );

        assert.equal(
            result.success,
            true
        );

        assert.ok(
            requestedUrl
        );

        assert.equal(
            requestedUrl.startsWith(
                "https://example.com/FeatureServer/0/query?"
            ),
            true
        );
    }
);


test(
    "queryArcGISLayer normalizes returned features",
    async () => {

        const result =
            await queryArcGISLayer(
                "https://example.com/FeatureServer/0",
                {},
                async () =>
                    createResponse({
                        features: [
                            {
                                attributes: {
                                    WARD:
                                        "1",
                                    DISTRICT:
                                        "District 1"
                                }
                            },

                            {
                                attributes: {
                                    WARD:
                                        "2"
                                },

                                geometry: {
                                    rings: [
                                        [
                                            [
                                                -110,
                                                32
                                            ],
                                            [
                                                -109,
                                                32
                                            ],
                                            [
                                                -109,
                                                31
                                            ],
                                            [
                                                -110,
                                                32
                                            ]
                                        ]
                                    ]
                                }
                            }
                        ]
                    })
            );

        assert.equal(
            result.success,
            true
        );

        assert.equal(
            result.featureCount,
            2
        );

        assert.equal(
            result.features.length,
            2
        );

        assert.deepEqual(
            result.features[0].attributes,
            {
                WARD:
                    "1",

                DISTRICT:
                    "District 1"
            }
        );

        assert.equal(
            result.features[0].geometry,
            undefined
        );

        assert.deepEqual(
            result.features[1].attributes,
            {
                WARD:
                    "2"
            }
        );

        assert.deepEqual(
            result.features[1].geometry,
            {
                rings: [
                    [
                        [
                            -110,
                            32
                        ],
                        [
                            -109,
                            32
                        ],
                        [
                            -109,
                            31
                        ],
                        [
                            -110,
                            32
                        ]
                    ]
                ]
            }
        );
    }
);


test(
    "queryArcGISLayer normalizes fields",
    async () => {

        const result =
            await queryArcGISLayer(
                "https://example.com/FeatureServer/0",
                {},
                async () =>
                    createResponse({
                        fields: [
                            {
                                name:
                                    "WARD",

                                alias:
                                    "Ward",

                                type:
                                    "esriFieldTypeString",

                                length:
                                    50
                            },

                            {
                                name:
                                    "DISTRICT",

                                alias:
                                    "District",

                                type:
                                    "esriFieldTypeString"
                            }
                        ]
                    })
            );

        assert.equal(
            result.success,
            true
        );

        assert.deepEqual(
            result.fields,
            [
                {
                    name:
                        "WARD",

                    alias:
                        "Ward",

                    type:
                        "esriFieldTypeString",

                    length:
                        50
                },

                {
                    name:
                        "DISTRICT",

                    alias:
                        "District",

                    type:
                        "esriFieldTypeString"
                }
            ]
        );
    }
);


test(
    "queryArcGISLayer collects unique attribute values",
    async () => {

        const result =
            await queryArcGISLayer(
                "https://example.com/FeatureServer/0",
                {
                    maxUniqueValues:
                        10
                },
                async () =>
                    createResponse({
                        features: [
                            {
                                attributes: {
                                    WARD:
                                        "1",

                                    NAME:
                                        "Ward 1"
                                }
                            },

                            {
                                attributes: {
                                    WARD:
                                        "2",

                                    NAME:
                                        "Ward 2"
                                }
                            },

                            {
                                attributes: {
                                    WARD:
                                        "1",

                                    NAME:
                                        "Ward 1"
                                }
                            }
                        ]
                    })
            );

        assert.equal(
            result.success,
            true
        );

        assert.deepEqual(
            result.uniqueValues,
            {
                WARD: [
                    "1",
                    "2"
                ],

                NAME: [
                    "Ward 1",
                    "Ward 2"
                ]
            }
        );
    }
);


test(
    "queryArcGISLayer respects maxUniqueValues",
    async () => {

        const result =
            await queryArcGISLayer(
                "https://example.com/FeatureServer/0",
                {
                    maxUniqueValues:
                        2
                },
                async () =>
                    createResponse({
                        features: [
                            {
                                attributes: {
                                    WARD:
                                        "1"
                                }
                            },

                            {
                                attributes: {
                                    WARD:
                                        "2"
                                }
                            },

                            {
                                attributes: {
                                    WARD:
                                        "3"
                                }
                            }
                        ]
                    })
            );

        assert.equal(
            result.success,
            true
        );

        assert.deepEqual(
            result.uniqueValues.WARD,
            [
                "1",
                "2"
            ]
        );
    }
);


test(
    "queryArcGISLayer reports exceeded transfer limit",
    async () => {

        const result =
            await queryArcGISLayer(
                "https://example.com/FeatureServer/0",
                {},
                async () =>
                    createResponse({
                        features: [
                            {
                                attributes: {
                                    WARD:
                                        "1"
                                }
                            }
                        ],

                        exceededTransferLimit:
                            true
                    })
            );

        assert.equal(
            result.success,
            true
        );

        assert.equal(
            result.featureCount,
            1
        );

        assert.equal(
            result.exceededTransferLimit,
            true
        );
    }
);


test(
    "queryArcGISLayer handles an ArcGIS error response",
    async () => {

        const result =
            await queryArcGISLayer(
                "https://example.com/FeatureServer/0",
                {},
                async () =>
                    createResponse({
                        error: {
                            code:
                                400,

                            message:
                                "Invalid query",

                            details: [
                                "The where clause is invalid."
                            ]
                        }
                    })
            );

        assert.equal(
            result.success,
            false
        );

        assert.equal(
            result.featureCount,
            0
        );

        assert.deepEqual(
            result.features,
            []
        );

        assert.match(
            result.error ?? "",
            /Invalid query/
        );

        assert.match(
            result.error ?? "",
            /where clause is invalid/
        );
    }
);


test(
    "queryArcGISLayer handles HTTP errors",
    async () => {

        const result =
            await queryArcGISLayer(
                "https://example.com/FeatureServer/0",
                {},
                async () =>
                    new Response(
                        "Server error",
                        {
                            status:
                                500,

                            statusText:
                                "Internal Server Error"
                        }
                    )
            );

        assert.equal(
            result.success,
            false
        );

        assert.equal(
            result.featureCount,
            0
        );

        assert.deepEqual(
            result.features,
            []
        );

        assert.match(
            result.error ?? "",
            /ArcGIS query failed/
        );

        assert.match(
            result.error ?? "",
            /500/
        );
    }
);


test(
    "queryArcGISLayer handles fetch failures",
    async () => {

        const result =
            await queryArcGISLayer(
                "https://example.com/FeatureServer/0",
                {},
                async () => {
                    throw new Error(
                        "Network failure"
                    );
                }
            );

        assert.equal(
            result.success,
            false
        );

        assert.equal(
            result.featureCount,
            0
        );

        assert.deepEqual(
            result.features,
            []
        );

        assert.match(
            result.error ?? "",
            /Network failure/
        );
    }
);


test(
    "queryArcGISLayer ignores empty outFields and uses *",
    async () => {

        let requestedUrl:
            string | undefined;

        const result =
            await queryArcGISLayer(
                "https://example.com/FeatureServer/0",
                {
                    outFields: []
                },
                async input => {

                    requestedUrl =
                        String(input);

                    return createResponse({
                        features: []
                    });
                }
            );

        assert.equal(
            result.success,
            true
        );

        assert.ok(
            requestedUrl
        );

        const url =
            new URL(
                requestedUrl
            );

        assert.equal(
            url.searchParams.get(
                "outFields"
            ),
            "*"
        );
    }
);


test(
    "queryArcGISLayer ignores blank and malformed fields returned by ArcGIS",
    async () => {

        const result =
            await queryArcGISLayer(
                "https://example.com/FeatureServer/0",
                {},
                async () =>
                    createResponse({
                        fields: [
                            {
                                name:
                                    "WARD",

                                alias:
                                    "Ward"
                            },

                            {
                                alias:
                                    "Missing name"
                            },

                            {
                                name:
                                    ""
                            }
                        ]
                    })
            );

        assert.equal(
            result.success,
            true
        );

        assert.deepEqual(
            result.fields,
            [
                {
                    name:
                        "WARD",

                    alias:
                        "Ward"
                }
            ]
        );
    }
);


test(
    "queryArcGISLayer ignores null and empty attribute values when collecting unique values",
    async () => {

        const result =
            await queryArcGISLayer(
                "https://example.com/FeatureServer/0",
                {},
                async () =>
                    createResponse({
                        features: [
                            {
                                attributes: {
                                    WARD:
                                        null,

                                    DISTRICT:
                                        "",

                                    NAME:
                                        undefined
                                }
                            },

                            {
                                attributes: {
                                    WARD:
                                        "1",

                                    DISTRICT:
                                        "District 1"
                                }
                            }
                        ]
                    })
            );

        assert.equal(
            result.success,
            true
        );

        assert.deepEqual(
            result.uniqueValues,
            {
                WARD: [
                    "1"
                ],

                DISTRICT: [
                    "District 1"
                ]
            }
        );
    }
);