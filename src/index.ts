// =============================================================================
// Registry
// =============================================================================

export {
    loadRegistry,
    findRegistryEntry,
    findRegistryEntries
} from "./registry.js";

export type {
    MunicipalDistrictRegistry,
    MunicipalDistrictRegistryEntry,
    MunicipalDistrictSource
} from "./types.js";


// =============================================================================
// Lookup
// =============================================================================

export {
    searchRegistry,
    searchMunicipalDistricts,
    findMunicipality,
    findMunicipalDistrictSources,
    findBoundarySources,
    lookupMunicipalDistrict
} from "./lookup.js";


// =============================================================================
// Public types
// =============================================================================

export type {
    BoundaryType,
    Coordinates,
    MunicipalDistrict,
    MunicipalDistrictLookupOptions,
    MunicipalDistrictLookupResult,
    MunicipalDistrictFieldMapping
} from "./types.js";