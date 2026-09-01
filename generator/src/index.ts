// =============================================================================
// Discovery
// =============================================================================

export {
    discoverArcGIS as discover,
} from "./discover.js";


// =============================================================================
// Classification
// =============================================================================

export {
    classifyCandidate,
} from "./classify.js";


// =============================================================================
// ArcGIS inspection
// =============================================================================

export {
    inspectArcGIS,
} from "./inspectArcGIS.js";


// =============================================================================
// Deduplication
// =============================================================================

export {
    dedupeCandidates,
    groupEquivalentCandidates,
    compareCandidates,
    createLayerFingerprint,
} from "./dedupe.js";


// =============================================================================
// Canonical source selection
// =============================================================================

export {
    selectCanonicalSource,
} from "./canonical.js";


// =============================================================================
// Census places
// =============================================================================

export {
    loadCensusPlaces,
    findCensusPlace,
    findCensusPlacesByName,
    findCensusPlaceByFips,
} from "./censusPlaces.js";


// =============================================================================
// Types
// =============================================================================

export type {
    StateAbbreviation,
    DistrictType,

    CensusPlace,

    DiscoveryCandidate,
    DiscoveryResult,
    ArcGISGeometryType,
    ArcGISField,
    ArcGISInspection,

    ClassificationMatches,
    CandidateClassification,

    InspectedCandidate,

    CandidateScore,

    LayerFingerprint,
    EquivalentLayerGroup,

    CanonicalSource,
    CanonicalAlternative,

    // Canonical municipal registry types
    MunicipalDistrictRegistry,
    MunicipalDistrictRegistryEntry,
    MunicipalDistrictSource,
    MunicipalDistrictFieldMapping,
    MunicipalDistrictMetadata,
    MunicipalDistrictAlternative,
    ArcGISServiceType,
    GeneratorOptions,
} from "./types.js";