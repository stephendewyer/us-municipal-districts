/**
 * The complete municipal district registry.
 */
export interface MunicipalDistrictRegistry {
    version: string;
    generatedAt: string;
    entries: MunicipalDistrictRegistryEntry[];
}
import type { BoundaryType, MunicipalDistrictRegistryEntry, MunicipalDistrictSource } from "./registry.js";
import type { Polygon, MultiPolygon } from "geojson";
export interface Coordinates {
    latitude: number;
    longitude: number;
}
export interface MunicipalDistrictProperties {
    id?: string;
    district?: string;
    name?: string;
    city: string;
    state: string;
    placeFips: string;
    boundaryType: BoundaryType;
    [key: string]: unknown;
}
export interface MunicipalDistrict {
    id: string;
    district: string;
    name: string;
    city: string;
    state: string;
    placeFips: string;
    boundaryType: BoundaryType;
    geometry: Polygon | MultiPolygon;
}
export interface MunicipalDistrictLookupOptions {
    city?: string;
    state?: string;
    placeFips?: string;
    boundaryType?: BoundaryType;
}
export interface MunicipalDistrictLookupResult {
    found: boolean;
    district: MunicipalDistrict | null;
    coordinates: Coordinates;
}
export type { MunicipalDistrictRegistryEntry, MunicipalDistrictSource };
//# sourceMappingURL=types.d.ts.map