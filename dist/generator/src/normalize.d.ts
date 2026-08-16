import type { FeatureCollection, Polygon, MultiPolygon } from "geojson";
export declare function normalizeGeoJSON(input: FeatureCollection, metadata: {
    city: string;
    state: string;
    placeFips: string;
}): FeatureCollection<Polygon | MultiPolygon>;
//# sourceMappingURL=normalize.d.ts.map