import assert from "node:assert/strict";
import test from "node:test";

import {
    arcgisRingsToGeoJSON
} from "../../generator/src/arcgisGeometry.js";


// =============================================================================
// Helpers
// =============================================================================

function square(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number
): number[][] {

    return [
        [minX, minY],
        [maxX, minY],
        [maxX, maxY],
        [minX, maxY],
        [minX, minY]
    ];
}


// =============================================================================
// Tests
// =============================================================================

test(
    "converts a single ArcGIS ring to Polygon",
    () => {

        const geometry =
            arcgisRingsToGeoJSON({
                rings: [
                    square(
                        0,
                        0,
                        10,
                        10
                    )
                ]
            });

        assert.equal(
            geometry.type,
            "Polygon"
        );

        assert.equal(
            geometry.coordinates.length,
            1
        );
    }
);


test(
    "converts disjoint outer rings to MultiPolygon",
    () => {

        const geometry =
            arcgisRingsToGeoJSON({
                rings: [
                    square(
                        0,
                        0,
                        10,
                        10
                    ),

                    square(
                        20,
                        20,
                        30,
                        30
                    )
                ]
            });

        assert.equal(
            geometry.type,
            "MultiPolygon"
        );

        assert.equal(
            geometry.coordinates.length,
            2
        );
    }
);


test(
    "recognizes a contained ring as a hole",
    () => {

        const geometry =
            arcgisRingsToGeoJSON({
                rings: [
                    square(
                        0,
                        0,
                        20,
                        20
                    ),

                    square(
                        5,
                        5,
                        15,
                        15
                    )
                ]
            });

        assert.equal(
            geometry.type,
            "Polygon"
        );

        assert.equal(
            geometry.coordinates.length,
            2
        );
    }
);


test(
    "recognizes an island inside a hole as a separate polygon",
    () => {

        const geometry =
            arcgisRingsToGeoJSON({
                rings: [
                    square(
                        0,
                        0,
                        30,
                        30
                    ),

                    square(
                        5,
                        5,
                        25,
                        25
                    ),

                    square(
                        10,
                        10,
                        20,
                        20
                    )
                ]
            });

        assert.equal(
            geometry.type,
            "MultiPolygon"
        );

        assert.equal(
            geometry.coordinates.length,
            2
        );
    }
);


test(
    "does not depend on ArcGIS ring order",
    () => {

        const geometry =
            arcgisRingsToGeoJSON({
                rings: [
                    square(
                        5,
                        5,
                        15,
                        15
                    ),

                    square(
                        0,
                        0,
                        20,
                        20
                    )
                ]
            });

        assert.equal(
            geometry.type,
            "Polygon"
        );

        assert.equal(
            geometry.coordinates.length,
            2
        );
    }
);


test(
    "closes an unclosed ArcGIS ring",
    () => {

        const geometry =
            arcgisRingsToGeoJSON({
                rings: [
                    [
                        [0, 0],
                        [10, 0],
                        [10, 10],
                        [0, 10]
                    ]
                ]
            });

        assert.equal(
            geometry.type,
            "Polygon"
        );

        const ring =
            geometry.coordinates[0];

        assert.deepEqual(
            ring[0],
            ring[ring.length - 1]
        );
    }
);


test(
    "rejects geometry containing no valid rings",
    () => {

        assert.throws(
            () =>
                arcgisRingsToGeoJSON({
                    rings: []
                }),
            /no valid rings/i
        );
    }
);


test(
    "ignores zero-area rings",
    () => {

        const geometry =
            arcgisRingsToGeoJSON({
                rings: [
                    [
                        [0, 0],
                        [1, 1],
                        [2, 2],
                        [0, 0]
                    ],

                    square(
                        0,
                        0,
                        10,
                        10
                    )
                ]
            });

        assert.equal(
            geometry.type,
            "Polygon"
        );

        assert.equal(
            geometry.coordinates.length,
            1
        );
    }
);