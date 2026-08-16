import registryData from "../data/registry.json" with { type: "json" };

export type BoundaryType =
    | "ward"
    | "council-district"
    | "city-council-district"
    | "aldermanic-district"
    | "municipal-district";

export type SourceType =
    | "official-municipal"
    | "official-county"
    | "official-state"
    | "federal"
    | "university"
    | "community"
    | "unknown";

export type GISFormat =
    | "arcgis-rest"
    | "geojson"
    | "geopackage"
    | "shapefile"
    | "unknown";

export type RegistryStatus =
    | "verified"
    | "needs-review"
    | "deprecated";

export interface FieldMapping {
    district?: string;
    name?: string;
    id?: string;
}

export interface MunicipalDistrictSource {
    url: string;

    sourceType: SourceType;

    format: GISFormat;

    verified: boolean;

    fieldMapping?: FieldMapping;

    lastVerified?: string;
}

export interface MunicipalDistrictRegistryEntry {
    placeFips: string;

    city: string;

    state: string;

    boundaryType: BoundaryType;

    source: MunicipalDistrictSource;

    status?: RegistryStatus;

    generatedFile?: string;
}

export interface MunicipalDistrictRegistry {
    version: string;

    generatedAt: string;

    entries: MunicipalDistrictRegistryEntry[];
}

export function loadRegistry(): MunicipalDistrictRegistry {
    return registryData as MunicipalDistrictRegistry;
}