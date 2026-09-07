import {
    booleanPointInPolygon,
    point,
    pointOnFeature
} from "@turf/turf";

import type {
    Feature,
    MultiPolygon,
    Polygon,
    Position
} from "geojson";


// =============================================================================
// Types
// =============================================================================

export type GeoJSONPolygonGeometry =
    Polygon | MultiPolygon;

export interface ArcGISPolygonGeometry {

    rings:
        number[][][];

    spatialReference?: {

        wkid?:
            number;

        latestWkid?:
            number;
    };
}


// =============================================================================
// Public API
// =============================================================================

/**
 * Convert an ArcGIS polygon geometry into a GeoJSON
 * Polygon or MultiPolygon.
 *
 * ArcGIS represents polygon geometry as an array of rings.
 *
 * Ring orientation is intentionally NOT used to determine
 * whether a ring is an exterior or a hole.
 *
 * Instead, rings are organized using spatial containment:
 *
 *   depth 0 -> exterior polygon
 *   depth 1 -> hole
 *   depth 2 -> nested exterior polygon
 *   depth 3 -> nested hole
 *
 * This makes the conversion independent of ArcGIS ring
 * ordering and winding direction.
 */
export function arcgisRingsToGeoJSON(
    geometry:
        ArcGISPolygonGeometry
): GeoJSONPolygonGeometry {

    const rings =
        normalizeRings(
            geometry.rings
        );

    if (
        rings.length === 0
    ) {
        throw new Error(
            "ArcGIS polygon geometry contains no valid rings."
        );
    }

    const ringInfos =
        rings
            .map(
                (ring, index) => ({
                    index,
                    ring,
                    area:
                        Math.abs(
                            signedRingArea(
                                ring
                            )
                        )
                })
            )
            .filter(
                item =>
                    item.area > 0
            );

    if (
        ringInfos.length === 0
    ) {
        throw new Error(
            "ArcGIS polygon geometry contains no " +
            "non-zero-area rings."
        );
    }

    /*
     * Process larger rings first.
     *
     * This ensures that when determining a ring's parent,
     * all possible containing rings have already been
     * considered.
     */
    ringInfos.sort(
        (a, b) =>
            b.area - a.area
    );

    const parents:
        Array<number | undefined> =
        new Array(
            ringInfos.length
        ).fill(undefined);

    /*
     * Determine the smallest containing ring for each ring.
     */
    for (
        let i = 0;
        i < ringInfos.length;
        i++
    ) {

        const child =
            ringInfos[i];

        const childPoint =
            representativePoint(
                child.ring
            );

        let bestParent:
            number | undefined;

        let bestParentArea =
            Number.POSITIVE_INFINITY;

        for (
            let j = 0;
            j < i;
            j++
        ) {

            const possibleParent =
                ringInfos[j];

            if (
                possibleParent.area <=
                child.area
            ) {
                continue;
            }

            const parentPolygon:
                Feature<Polygon> = {

                type:
                    "Feature",

                properties:
                    {},

                geometry: {

                    type:
                        "Polygon",

                    coordinates: [
                        possibleParent.ring
                    ]
                }
            };

            if (
                booleanPointInPolygon(
                    childPoint,
                    parentPolygon,
                    {
                        ignoreBoundary:
                            false
                    }
                )
            ) {

                if (
                    possibleParent.area <
                    bestParentArea
                ) {

                    bestParent =
                        j;

                    bestParentArea =
                        possibleParent.area;
                }
            }
        }

        parents[i] =
            bestParent;
    }

    /*
     * Calculate nesting depth.
     *
     * Even depth:
     *     exterior polygon
     *
     * Odd depth:
     *     hole
     */
    const depths:
        number[] =
        new Array(
            ringInfos.length
        ).fill(0);

    for (
        let i = 0;
        i < ringInfos.length;
        i++
    ) {

        depths[i] =
            calculateDepth(
                i,
                parents,
                depths
            );
    }

    /*
     * Every even-depth ring represents an exterior.
     *
     * Its immediate odd-depth children become holes.
     *
     * A depth-2 ring is therefore another exterior polygon,
     * which is why nested islands correctly produce a
     * MultiPolygon.
     */
    const polygons:
        Position[][][] = [];

    for (
        let i = 0;
        i < ringInfos.length;
        i++
    ) {

        if (
            depths[i] % 2 !== 0
        ) {
            continue;
        }

        const exterior =
            ringInfos[i].ring;

        const holes:
            Position[][] = [];

        for (
            let j = 0;
            j < ringInfos.length;
            j++
        ) {

            if (
                parents[j] === i &&
                depths[j] ===
                    depths[i] + 1
            ) {

                holes.push(
                    ringInfos[j].ring
                );
            }
        }

        polygons.push([
            exterior,
            ...holes
        ]);
    }

    if (
        polygons.length === 0
    ) {
        throw new Error(
            "Unable to construct a GeoJSON polygon " +
            "from ArcGIS rings."
        );
    }

    if (
        polygons.length === 1
    ) {

        return {

            type:
                "Polygon",

            coordinates:
                polygons[0]
        };
    }

    return {

        type:
            "MultiPolygon",

        coordinates:
            polygons
    };
}


// =============================================================================
// Ring normalization
// =============================================================================

function normalizeRings(
    rings:
        unknown
): Position[][] {

    if (
        !Array.isArray(rings)
    ) {
        return [];
    }

    return rings
        .filter(
            isRing
        )
        .map(
            closeRing
        );
}


function isRing(
    value:
        unknown
): value is Position[] {

    if (
        !Array.isArray(value)
    ) {
        return false;
    }

    if (
        value.length < 3
    ) {
        return false;
    }

    return value.every(
        position =>
            Array.isArray(position) &&
            position.length >= 2 &&
            typeof position[0] === "number" &&
            typeof position[1] === "number" &&
            Number.isFinite(
                position[0]
            ) &&
            Number.isFinite(
                position[1]
            )
    );
}


function closeRing(
    ring:
        Position[]
): Position[] {

    if (
        ring.length === 0
    ) {
        return ring;
    }

    const first =
        ring[0];

    const last =
        ring[
            ring.length - 1
        ];

    if (
        first[0] === last[0] &&
        first[1] === last[1]
    ) {
        return ring;
    }

    return [
        ...ring,
        [
            first[0],
            first[1]
        ]
    ];
}


// =============================================================================
// Ring area
// =============================================================================

function signedRingArea(
    ring:
        Position[]
): number {

    let area =
        0;

    for (
        let i = 0;
        i < ring.length - 1;
        i++
    ) {

        const x1 =
            ring[i][0];

        const y1 =
            ring[i][1];

        const x2 =
            ring[i + 1][0];

        const y2 =
            ring[i + 1][1];

        area +=
            x1 * y2 -
            x2 * y1;
    }

    return area / 2;
}


// =============================================================================
// Ring containment
// =============================================================================

function representativePoint(
    ring:
        Position[]
) {

    const polygon:
        Feature<Polygon> = {

        type:
            "Feature",

        properties:
            {},

        geometry: {

            type:
                "Polygon",

            coordinates: [
                ring
            ]
        }
    };

    const representative =
        pointOnFeature(
            polygon
        );

    return point(
        representative.geometry.coordinates
    );
}


// =============================================================================
// Nesting depth
// =============================================================================

function calculateDepth(
    index:
        number,

    parents:
        Array<number | undefined>,

    depths:
        number[]
): number {

    if (
        parents[index] === undefined
    ) {
        return 0;
    }

    /*
     * A depth of zero can be legitimate for a root ring, so
     * only use the cached value when the ring has a parent.
     */
    const parent =
        parents[index]!;

    if (
        parent === index
    ) {
        throw new Error(
            "Invalid ArcGIS ring containment hierarchy."
        );
    }

    /*
     * Calculate recursively. The number of rings in an
     * individual municipal feature should be small enough
     * that this remains safe.
     */
    const depth =
        calculateDepth(
            parent,
            parents,
            depths
        ) + 1;

    depths[index] =
        depth;

    return depth;
}