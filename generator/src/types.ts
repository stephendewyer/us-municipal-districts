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
// Discovery candidate
// =============================================================================

/**
 * A candidate discovered through ArcGIS search.
 *
 * This represents the candidate BEFORE ArcGIS inspection.
 */
export interface DiscoveryCandidate {
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
     * URL discovered during the search process.
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


// =============================================================================
// ArcGIS inspection
// =============================================================================

export interface ArcGISInspection {

    /**
     * URL inspected.
     */
    url: string;

    /**
     * Whether the URL appears to be an ArcGIS REST service.
     */
    isArcGIS: boolean;

    /**
     * ArcGIS service type.
     */
    serviceType: ArcGISServiceType;

    /**
     * Whether this URL represents a specific layer.
     */
    isLayer: boolean;

    /**
     * Human-readable layer/service title.
     */
    title?: string;

    /**
     * ArcGIS service name.
     */
    serviceName?: string;

    /**
     * ArcGIS layer name.
     */
    layerName?: string;

    /**
     * Description supplied by ArcGIS.
     */
    description?: string;

    /**
     * Geometry type.
     */
    geometryType?: ArcGISGeometryType;

    /**
     * ArcGIS fields.
     */
    fields?: ArcGISField[];

    /**
     * Object ID field.
     */
    objectIdField?: string;

    /**
     * Maximum records returned by the service.
     */
    maxRecordCount?: number;

    /**
     * Spatial reference information.
     */
    spatialReference?: {
        wkid?: number;
        latestWkid?: number;
        wkt?: string;
    };

    /**
     * Whether the service supports querying.
     */
    supportsQuery?: boolean;

    /**
     * Whether the service supports GeoJSON output.
     */
    supportsGeoJSON?: boolean;

    /**
     * Whether the service supports pagination.
     */
    supportsPagination?: boolean;

    /**
     * ArcGIS service root URL.
     */
    serviceUrl?: string;

    /**
     * Most likely district field.
     */
    districtField?: string;

    /**
     * All fields identified as possible district fields.
     */
    districtFields: string[];

    /**
     * Most likely human-readable name field.
     */
    nameField?: string;

    /**
     * All fields identified as possible name fields.
     */
    nameFields: string[];

    /**
     * Raw ArcGIS response.
     *
     * Useful during development.
     *
     * Should not normally be written into the generated registry.
     */
    raw?: unknown;
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
     * Whether the dataset appears to be thematic rather than
     * the actual district boundary.
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
     * Whether the candidate should be rejected from
     * canonical selection.
     */
    rejected: boolean;

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

    /**
     * Original discovery candidate.
     */
    candidate: DiscoveryCandidate;

    /**
     * ArcGIS inspection result.
     */
    inspection: ArcGISInspection;

    /**
     * Classification result.
     */
    classification: CandidateClassification;
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

/**
 * Normalized representation of an ArcGIS layer used
 * for duplicate/equivalence detection.
 */
export interface LayerFingerprint {

    /**
     * Normalized layer title.
     */
    title?: string;

    /**
     * Normalized service name.
     */
    serviceName?: string;

    /**
     * Normalized layer name.
     */
    layerName?: string;

    /**
     * Normalized geometry type.
     */
    geometryType?: ArcGISGeometryType;

    /**
     * Normalized field names.
     */
    fields: string[];

    /**
     * Fields that appear to identify districts.
     */
    districtFields: string[];

    /**
     * Fields that appear to contain human-readable
     * district names.
     */
    nameFields: string[];

    /**
     * Feature count, if available.
     */
    featureCount?: number;
}


// =============================================================================
// Equivalent layer groups
// =============================================================================

/**
 * Group of ArcGIS layers believed to represent the
 * same underlying municipal political boundary dataset.
 */
export interface EquivalentLayerGroup {

    /**
     * Candidates in this equivalence group.
     */
    candidates: InspectedCandidate[];

    /**
     * Confidence that the candidates represent
     * the same underlying dataset.
     *
     * 0 = no confidence
     * 1 = complete confidence.
     */
    confidence: number;

    /**
     * Evidence supporting the equivalence.
     */
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
     * Human-readable title.
     */
    title: string;

    /**
     * Municipality.
     */
    city: string;

    /**
     * State.
     */
    state: StateAbbreviation;

    /**
     * Census place FIPS.
     */
    placeFips: string;

    /**
     * Political district type.
     */
    districtType: DistrictType;

    /**
     * ArcGIS service type.
     */
    serviceType: ArcGISServiceType;

    /**
     * Whether the source appears to be maintained
     * by the municipality.
     */
    officialMunicipalSource: boolean;

    /**
     * District identifier field.
     */
    districtField: string;

    /**
     * Human-readable district name field.
     */
    nameField?: string;

    /**
     * Geometry type.
     */
    geometryType: ArcGISGeometryType;

    /**
     * Canonical selection score.
     */
    score: number;

    /**
     * Other equivalent sources.
     */
    alternatives: CanonicalAlternative[];

    /**
     * Reasons this source was selected.
     */
    selectionReasons: string[];

    /**
     * Whether manual review is required.
     */
    requiresReview: boolean;
}


export interface CanonicalAlternative {

    /**
     * Alternative source URL.
     */
    url: string;

    /**
     * Alternative title.
     */
    title?: string;

    /**
     * ArcGIS service type.
     */
    serviceType?: ArcGISServiceType;

    /**
     * Whether the source appears official.
     */
    officialMunicipalSource?: boolean;

    /**
     * Selection score.
     */
    score?: number;
}


// =============================================================================
// Registry
// =============================================================================

export interface RegistryEntry {

    /**
     * Census place FIPS.
     */
    placeFips: string;

    /**
     * Municipality.
     */
    city: string;

    /**
     * State abbreviation.
     */
    state: StateAbbreviation;

    /**
     * Political district type.
     */
    districtType: DistrictType;

    /**
     * Canonical boundary source.
     */
    source: RegistrySource;

    /**
     * Fields used to extract district information.
     */
    fields: RegistryFields;

    /**
     * Generator metadata.
     */
    metadata: RegistryMetadata;
}


export interface RegistrySource {

    /**
     * Canonical ArcGIS layer URL.
     */
    url: string;

    /**
     * ArcGIS service type.
     */
    serviceType: ArcGISServiceType;

    /**
     * Human-readable source title.
     */
    title: string;

    /**
     * Whether the source appears official.
     */
    official: boolean;
}


export interface RegistryFields {

    /**
     * District identifier field.
     */
    district: string;

    /**
     * Human-readable district name field.
     */
    name?: string;
}


export interface RegistryMetadata {

    /**
     * Date/time registry entry was generated.
     */
    generatedAt: string;

    /**
     * Generator version.
     */
    generatorVersion?: string;

    /**
     * Other equivalent sources.
     */
    alternatives?: CanonicalAlternative[];

    /**
     * Whether manual review is required.
     */
    requiresReview: boolean;
}


// =============================================================================
// Discovery result
// =============================================================================

/**
 * Complete result of discovering municipal political
 * district sources for ONE Census municipality.
 *
 * The pipeline intentionally produces exactly one
 * DiscoveryResult per municipality.
 */
export interface DiscoveryResult {

    /**
     * Census municipality being processed.
     */
    place: CensusPlace;

    /**
     * Raw candidates returned by ArcGIS discovery.
     */
    candidates: DiscoveryCandidate[];

    /**
     * Candidates that were successfully inspected
     * and classified.
     */
    inspectedCandidates: InspectedCandidate[];

    /**
     * Candidates that survived classification.
     */
    validCandidates: InspectedCandidate[];

    /**
     * Valid candidates ranked from strongest to weakest.
     */
    rankedCandidates: CandidateScore[];

    /**
     * Candidates rejected during classification.
     */
    rejectedCandidates: InspectedCandidate[];

    /**
     * Groups of equivalent ArcGIS sources.
     */
    equivalentGroups: EquivalentLayerGroup[];

    /**
     * One municipality-level canonical source.
     */
    canonical?: CanonicalSource;

    /**
     * Registry entry generated from the canonical source.
     */
    registryEntry?: RegistryEntry;

    /**
     * Error encountered while processing this municipality.
     *
     * A failed municipality still produces a DiscoveryResult.
     */
    error?: string;
}


// =============================================================================
// Generator options
// =============================================================================

export interface GeneratorOptions {

    /**
     * Process only a specific city.
     */
    city?: string;

    /**
     * Process only a specific state.
     */
    state?: string;

    /**
     * Process a specific Census place FIPS.
     */
    placeFips?: string;

    /**
     * Require manual review before writing registry entries.
     */
    review?: boolean;

    /**
     * Print detailed information.
     */
    verbose?: boolean;

    /**
     * Write intermediate discovery results.
     */
    writeDiscovery?: boolean;

    /**
     * Generator output directory.
     */
    outputDir?: string;
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
        | "Map Service";

    /**
     * ArcGIS REST URL.
     */
    url: string;

    /**
     * ArcGIS item owner.
     */
    owner?: string;

    /**
     * ArcGIS description.
     */
    description?: string;

    /**
     * ArcGIS snippet.
     */
    snippet?: string;

    /**
     * ArcGIS tags.
     */
    tags?: string[];

    /**
     * Access level.
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
}