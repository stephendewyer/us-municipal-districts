import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
export type DistrictType = "ward" | "council_district" | "aldermanic_district" | "borough" | "municipal_district" | "other";
export type MunicipalGeometry = Feature<Polygon | MultiPolygon>;
export interface MunicipalDistrict {
    id: string;
    district: string;
    name: string;
    city: string;
    state: string;
    placeFips: string;
    districtType: DistrictType;
    geometry: Polygon | MultiPolygon;
}
export interface MunicipalityRecord {
    placeFips: string;
    city: string;
    state: string;
    districtType: DistrictType;
    data: string;
    source: {
        name: string;
        url: string;
        accessed: string;
        license?: string;
        attribution?: string;
    };
}
export interface MunicipalRegistry {
    version: string;
    generatedAt: string;
    municipalities: Record<string, MunicipalityRecord>;
}
export interface MunicipalDistrictCollection extends FeatureCollection<Polygon | MultiPolygon> {
}
//# sourceMappingURL=types.d.ts.map