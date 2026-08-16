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

export interface ArcGISInspection {
    url: string;

    serviceName?: string;

    serviceType: ArcGISServiceType;

    description?: string;

    fields: string[];

    geometryType?: string;

    layerName?: string;

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