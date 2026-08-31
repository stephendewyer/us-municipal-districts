// =============================================================================
// Basic geographic types
// =============================================================================

export type StateAbbreviation = string;


export type DistrictType =
    | "ward"
    | "council-district"
    | "aldermanic-district"
    | "municipal-district";


// =============================================================================
// Census place
// =============================================================================

export type CensusPlaceType =
    | "incorporated-place"
    | "census-designated-place"
    | "other";


export interface CensusPlace {

    /**
     * Census place GEOID.
     */
    placeFips: string;

    /**
     * Municipality/census place name.
     */
    city: string;

    /**
     * Two-letter state abbreviation.
     */
    state: StateAbbreviation;

    /**
     * State FIPS code.
     */
    stateFips?: string;

    /**
     * Original Census place name.
     */
    placeName?: string;

    /**
     * Census place type.
     */
    placeType?: CensusPlaceType;
}


// =============================================================================
// ArcGIS item types
// =============================================================================

/**
 * Metadata returned directly by the ArcGIS Online
 * /sharing/rest/content/items/{itemId} endpoint.
 */
export interface ArcGISItem {

    /**
     * ArcGIS item ID.
     */
    id: string;

    /**
     * ArcGIS item title.
     */
    title: string;

    /**
     * ArcGIS item type.
     */
    type: ArcGISItemType;

    /**
     * ArcGIS REST service URL, when supplied by ArcGIS.
     */
    url?: string;

    /**
     * ArcGIS item owner.
     */
    owner?: string;

    /**
     * Item description.
     */
    description?: string;

    /**
     * Short item description.
     */
    snippet?: string;

    /**
     * Search tags.
     */
    tags?: string[];

    /**
     * ArcGIS access level.
     */
    access?: string;

    /**
     * Creation timestamp.
     */
    created?: number;

    /**
     * Modification timestamp.
     */
    modified?: number;

    /**
     * ArcGIS type keywords.
     */
    typeKeywords?: string[];

    /**
     * Item extent.
     */
    extent?: unknown;

    /**
     * Spatial reference information.
     */
    spatialReference?: unknown;

    /**
     * Organization information.
     */
    organizationId?: string;

    /**
     * Raw ArcGIS item metadata.
     *
     * Useful during discovery/debugging but should not
     * normally be written into the final registry.
     */
    raw?: unknown;
}


// =============================================================================
// ArcGIS item resolution
// =============================================================================

export type ArcGISItemType =
    | "Feature Service"
    | "Map Service"
    | "Feature Collection"
    | "Web Map"
    | "Group Layer"
    | "unknown";


export interface ArcGISItemResolution {

    /**
     * ArcGIS Online item ID.
     */
    id: string;

    /**
     * ArcGIS item title.
     */
    title?: string;

    /**
     * ArcGIS item type.
     */
    type: ArcGISItemType;

    /**
     * Authoritative service URL supplied by ArcGIS.
     *
     * This is optional because not every ArcGIS item has a
     * service URL.
     */
    url?: string;

    /**
     * ArcGIS item owner.
     */
    owner?: string;

    /**
     * ArcGIS item description.
     */
    description?: string;

    /**
     * ArcGIS item snippet.
     */
    snippet?: string;

    /**
     * ArcGIS item tags.
     */
    tags?: string[];

    /**
     * ArcGIS type keywords.
     */
    typeKeywords?: string[];

    /**
     * ArcGIS access level.
     */
    access?: string;

    /**
     * Creation timestamp.
     */
    created?: number;

    /**
     * Modification timestamp.
     */
    modified?: number;

    /**
     * Item size in bytes.
     */
    size?: number;

    /**
     * Owner folder ID.
     */
    ownerFolder?: string;

    /**
     * ArcGIS item culture.
     */
    culture?: string;

    /**
     * Original ArcGIS response.
     *
     * Useful during development/debugging.
     */
    raw?: unknown;
}


// =============================================================================
// Discovery candidate
// =============================================================================

/**
 * A candidate discovered through ArcGIS search and subsequently
 * associated with an ArcGIS item.
 *
 * This represents a candidate BEFORE layer inspection.
 */
export interface DiscoveryCandidate {

    /**
     * ArcGIS Online item ID.
     */
    itemId?: string;

    /**
     * Census place GEOID.
     */
    placeFips: string;

    /**
     * Municipality name.
     */
    city: string;

    /**
     * State abbreviation.
     */
    state: StateAbbreviation;

    /**
     * URL discovered or resolved during discovery.
     *
     * During the search stage this may be empty because the
     * authoritative URL is obtained from the ArcGIS item.
     */
    url: string;

    /**
     * Human-readable title, if discovered.
     */
    title?: string;

    /**
     * Initial discovery score.
     */
    score: number;

    /**
     * Whether the candidate requires manual review.
     */
    requiresReview: boolean;

    /**
     * Reasons contributing to the discovery score.
     */
    reasons: string[];

    /**
     * Source from which the candidate was discovered.
     */
    source?: string;

    /**
     * Search query that produced this candidate.
     */
    searchQuery?: string;
}


// =============================================================================
// ArcGIS service
// =============================================================================

export type ArcGISServiceType =
    | "FeatureServer"
    | "MapServer"
    | "unknown";


export type ArcGISGeometryType =
    | "esriGeometryPoint"
    | "esriGeometryMultipoint"
    | "esriGeometryPolyline"
    | "esriGeometryPolygon"
    | "esriGeometryEnvelope"
    | "point"
    | "multipoint"
    | "polyline"
    | "polygon"
    | "unknown";


// =============================================================================
// ArcGIS fields
// =============================================================================

export interface ArcGISField {

    /**
     * ArcGIS field name.
     */
    name: string;

    /**
     * Human-readable field alias.
     */
    alias?: string;

    /**
     * ArcGIS field type.
     */
    type?: string;

    /**
     * Maximum field length.
     */
    length?: number;

    /**
     * ArcGIS domain information.
     */
    domain?: unknown;
}


export interface ArcGISFieldSample {

    field: string;

    values: string[];
}


// =============================================================================
// ArcGIS inspection
// =============================================================================

export interface ArcGISInspection {

    url: string;

    isArcGIS: boolean;

    serviceType:
        | "FeatureServer"
        | "MapServer"
        | "unknown";

    isLayer: boolean;

    layerId?: number;

    title?: string;

    serviceName?: string;

    layerName?: string;

    description?: string;

    serviceDescription?: string;

    serviceUrl?: string;

    geometryType?: ArcGISGeometryType;

    spatialReference?: {
        wkid?: number;
        latestWkid?: number;
        wkt?: string;
    };

    objectIdField?: string;

    globalIdField?: string;

    displayField?: string;

    maxRecordCount?: number;

    fields?: ArcGISField[];

    districtFields: string[];

    districtField?: string;

    nameFields: string[];

    nameField?: string;

    fieldSamples: ArcGISFieldSample[];

    supportsQuery?: boolean;

    supportsGeoJSON?: boolean;

    supportsPagination?: boolean;

    itemId?: string;

    serviceItemId?: string;

    owner?: string;

    organization?: string;

    organizationId?: string;

    tags?: string[];

    typeKeywords?: string[];

    created?: string;

    modified?: string;
}

// =============================================================================
// ArcGIS validation
// =============================================================================

export interface ArcGISCandidateValidation {

    isLikelyPoliticalBoundary: boolean;

    confidence: number;

    districtField?: string;

    sampleCount: number;

    featureCount?: number;

    distinctDistrictValues: string[];

    districtValuePattern?:
        | "numeric"
        | "ward-number"
        | "district-number"
        | "named"
        | "unknown";

    geometryType?: ArcGISGeometryType;

    municipalityOverlap?: number;

    evidence: string[];
}


// =============================================================================
// ArcGIS query result
// =============================================================================

export interface ArcGISQueryResult {

    url: string;

    success: boolean;

    features: Array<{
        attributes: Record<string, unknown>;
        geometry?: unknown;
    }>;

    featureCount: number;

    exceededTransferLimit: boolean;

    fields: ArcGISField[];

    uniqueValues: Record<string, unknown[]>;

    error?: string;
}


// =============================================================================
// ArcGIS authority
// =============================================================================

export interface ArcGISAuthority {

    organizationName?: string;

    organizationId?: string;

    city?: string;

    state?: string;

    official: boolean;
}


// =============================================================================
// Classification
// =============================================================================

export interface ClassificationMatches {

    /**
     * Evidence suggesting the dataset is thematic.
     */
    thematic: string[];

    /**
     * Evidence suggesting a Census dataset.
     */
    census: string[];

    /**
     * Evidence suggesting a parcel/property dataset.
     */
    parcel: string[];

    /**
     * Evidence suggesting a housing dataset.
     */
    housing: string[];

    /**
     * Evidence suggesting a political boundary.
     */
    political: string[];

    /**
     * Evidence suggesting a generic boundary layer.
     */
    boundary: string[];

    /**
     * Evidence suggesting an official municipal source.
     */
    official: string[];
}


export interface CandidateClassification {

    /**
     * Whether the candidate represents a polygon boundary.
     */
    isBoundaryLayer: boolean;

    /**
     * Whether the candidate appears to represent an actual
     * political district.
     */
    isPoliticalBoundary: boolean;

    /**
     * Whether the dataset appears to be thematic.
     */
    isThematicDataset: boolean;

    /**
     * Whether the dataset appears to be Census-based.
     */
    isCensusDataset: boolean;

    /**
     * Whether the dataset appears to contain parcels.
     */
    isParcelDataset: boolean;

    /**
     * Whether the dataset appears to concern housing.
     */
    isHousingDataset: boolean;

    /**
     * Whether the source appears to be an official
     * municipal source.
     */
    officialMunicipalSource: boolean;

    /**
     * Political district type.
     */
    districtType?: DistrictType;

    /**
     * Whether the candidate should be rejected.
     */
    rejected: boolean;

    /**
     * Reasons this candidate was rejected.
     */
    rejectionReasons: string[];

    /**
     * Whether the candidate should receive manual review.
     */
    requiresReview: boolean;

    /**
     * Keyword evidence used during classification.
     */
    matches: ClassificationMatches;
}


// =============================================================================
// Inspected candidate
// =============================================================================

/**
 * A discovery candidate after ArcGIS inspection
 * and classification.
 */
export interface InspectedCandidate {

    candidate: DiscoveryCandidate;

    inspection: ArcGISInspection;

    classification: CandidateClassification;

    validation?: ArcGISCandidateValidation;
}


// =============================================================================
// Ranking
// =============================================================================

export interface CandidateScore {

    /**
     * Candidate being scored.
     */
    candidate: InspectedCandidate;

    /**
     * Final canonical-selection score.
     */
    score: number;

    /**
     * Reasons contributing to the score.
     */
    reasons: string[];
}


// =============================================================================
// Layer fingerprints
// =============================================================================

export interface LayerFingerprint {

    title?: string;

    serviceName?: string;

    layerName?: string;

    geometryType?: ArcGISGeometryType;

    fields: string[];

    districtFields: string[];

    nameFields: string[];

    featureCount?: number;
}


// =============================================================================
// Equivalent layer groups
// =============================================================================

export interface EquivalentLayerGroup {

    id: string;

    candidates: InspectedCandidate[];

    confidence: number;

    reasons: string[];
}


// =============================================================================
// Canonical source
// =============================================================================

export interface CanonicalSource {

    /**
     * Selected canonical ArcGIS layer URL.
     */
    url: string;

    /**
     * ArcGIS item ID associated with the source.
     */
    itemId?: string;

    title: string;

    city: string;

    state: StateAbbreviation;

    placeFips: string;

    districtType: DistrictType;

    serviceType: ArcGISServiceType;

    officialMunicipalSource: boolean;

    districtField: string;

    nameField?: string;

    geometryType: ArcGISGeometryType;

    score: number;

    alternatives: CanonicalAlternative[];

    selectionReasons: string[];

    requiresReview: boolean;
}


export interface CanonicalAlternative {

    url: string;

    /**
     * ArcGIS item ID, when known.
     */
    itemId?: string;

    title?: string;

    serviceType?: ArcGISServiceType;

    officialMunicipalSource?: boolean;

    score?: number;
}


// =============================================================================
// Registry
// =============================================================================

export interface RegistryEntry {

    placeFips: string;

    city: string;

    state: StateAbbreviation;

    districtType: DistrictType;

    source: RegistrySource;

    fields: RegistryFields;

    metadata: RegistryMetadata;
}


export interface RegistrySource {

    url: string;

    /**
     * ArcGIS item ID, when available.
     */
    itemId?: string;

    serviceType: ArcGISServiceType;

    title: string;

    official: boolean;
}


export interface RegistryFields {

    district: string;

    name?: string;
}


export interface RegistryMetadata {

    generatedAt: string;

    generatorVersion?: string;

    alternatives?: CanonicalAlternative[];

    requiresReview: boolean;
}


// =============================================================================
// Discovery result
// =============================================================================

export interface DiscoveryResult {

    place: CensusPlace;

    candidates: DiscoveryCandidate[];

    inspectedCandidates: InspectedCandidate[];

    validCandidates: InspectedCandidate[];

    rankedCandidates: CandidateScore[];

    rejectedCandidates: InspectedCandidate[];

    equivalentGroups: EquivalentLayerGroup[];

    /**
     * One canonical source selected from each equivalence group.
     */
    canonicalSources: CanonicalSource[];

    /**
     * Optional municipality-wide canonical source.
     *
     * This is the strongest source across all equivalence groups.
     */
    canonical?: CanonicalSource;

    registryEntry?: RegistryEntry;

    error?: string;
}


// =============================================================================
// ArcGIS search
// =============================================================================

export interface ArcGISSearchResult {

    /**
     * ArcGIS item ID.
     */
    id: string;

    /**
     * ArcGIS item title.
     */
    title: string;

    /**
     * ArcGIS item type.
     */
    type:
        | "Feature Service"
        | "Map Service"
        | "Feature Collection"
        | "Web Map"
        | "Group Layer"
        | string;

    /**
     * ArcGIS REST/service URL, when supplied by search.
     *
     * This is not treated as authoritative by discovery.
     * resolveArcGISItem() provides the authoritative URL.
     */
    url?: string;

    owner?: string;

    description?: string;

    snippet?: string;

    tags?: string[];

    access?: string;

    created?: number;

    modified?: number;

    typeKeywords?: string[];
}


// =============================================================================
// ArcGIS search response
// =============================================================================

export interface ArcGISSearchResponse {

    total?: number;

    start?: number;

    num?: number;

    nextStart?: number;

    results?: ArcGISSearchResult[];
}


// =============================================================================
// ArcGIS query options
// =============================================================================

export interface ArcGISQueryOptions {

    where?: string;

    outFields?: string[];

    resultRecordCount?: number;

    resultOffset?: number;

    returnGeometry?: boolean;

    maxUniqueValues?: number;
}


// =============================================================================
// Generator options
// =============================================================================

export interface GeneratorOptions {

    city?: string;

    state?: string;

    placeFips?: string;

    review?: boolean;

    verbose?: boolean;

    writeDiscovery?: boolean;

    outputDir?: string;
}