
export interface MunicipalArcGISAuthority {
    city: string;
    state: string;
    organizationId?: string;
    organizationName?: string;
}

export const MUNICIPAL_ARCGIS_AUTHORITIES:
    MunicipalArcGISAuthority[] = [
        { 
            city: "tucson", 
            state: "az", 
            organizationId: "9coHY2fvuFjG9HQX", 
            organizationName: "City of Tucson" 
        },
        {
            city: "phoenix",
            state: "az",
            organizationId: "REPLACE_WITH_PHOENIX_ORG_ID",
            organizationName: "City of Phoenix"
        },
        {
            city: "chicago",
            state: "il",
            organizationId: "REPLACE_WITH_CHICAGO_ORG_ID",
            organizationName: "City of Chicago"
        }
    ];