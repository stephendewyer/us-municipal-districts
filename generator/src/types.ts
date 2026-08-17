export interface Place {
    placeFips: string;

    city: string;

    state: string;
}


export interface ArcGISCandidate {
    placeFips: string;

    city: string;

    state: string;

    candidateUrl: string;

    title: string;

    score: number;

    requiresReview: boolean;
}


export type ArcGISServiceType =
    | "FeatureServer"
    | "MapServer"
    | "unknown";


export interface ArcGISSpatialReference {
    wkid?: number;

    latestWkid?: number;

    wkt?: string;
}


export interface ArcGISInspection {

    url: string;

    isArcGIS: boolean;

    serviceType:
        | "FeatureServer"
        | "MapServer"
        | "unknown";

    isLayer: boolean;

    title?: string;

    serviceName?: string;

    layerName?: string;

    description?: string;

    geometryType?: GeometryType;

    fields: string[];

    districtFields: string[];

    nameField?: string;

    objectIdField?: string;

    featureCount?: number;

    supportsQuery: boolean;

    supportsGeometryQuery: boolean;

    supportsPagination: boolean;

    supportsGeoJSON: boolean;

    isPolygonLayer: boolean;

    isLikelyBoundaryLayer: boolean;

    isFeatureServer: boolean;

    isMapServer: boolean;
}


export interface ScoredCandidate
    extends ArcGISCandidate {

    score: number;

    reasons?: string[];
}


export interface DiscoveryResult {
    place: Place;

    candidates: ScoredCandidate[];
}


export interface DiscoveryRecord {
    placeFips: string;

    city: string;

    state: string;

    candidateUrl: string;

    title: string;

    score: number;

    requiresReview: boolean;

    reasons?: string[];
}


export type GeometryType =
    | "esriGeometryPoint"
    | "esriGeometryMultipoint"
    | "esriGeometryPolyline"
    | "esriGeometryPolygon"
    | "esriGeometryEnvelope";