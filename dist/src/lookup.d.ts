import type { MunicipalDistrict } from "./types.js";
export declare function getMunicipalDistricts(placeFips: string): Promise<MunicipalDistrict[]>;
export declare function getMunicipalDistrict(options: {
    latitude: number;
    longitude: number;
    placeFips: string;
}): Promise<MunicipalDistrict | null>;
//# sourceMappingURL=lookup.d.ts.map