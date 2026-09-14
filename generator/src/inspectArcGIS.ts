import { performance } from "node:perf_hooks";

import type {
    ArcGISField,
    ArcGISFieldSample,
    ArcGISInspection,
    ArcGISGeometryType,
    ArcGISServiceType
} from "./types.js";

type FetchLike = typeof fetch;

type JsonObject = Record<string, unknown>;

function formatTimingMs(value: number): string {
    return `${value.toFixed(0)} ms`;
}


// =============================================================================
// Public API
// =============================================================================

/**
 * Inspect an ArcGIS REST service or layer.
 *
 * Inspection gathers service metadata and lightweight field evidence.
 *
 * This function does NOT:
 * - determine whether a dataset is political
 * - determine whether it represents municipal districts
 * - validate a boundary
 * - rank candidates
 * - select a canonical source
 */
export async function inspectArcGIS(
    url: string,
    fetchImpl: FetchLike = fetch
): Promise<ArcGISInspection> {

    /*
     * Start the overall inspection timer before any work is performed.
     *
     * This is intentionally separate from the individual stage timers
     * below so that "total" represents the actual elapsed runtime of
     * inspectArcGIS(), rather than the sum of selected measurements.
     */
    const totalStart =
        performance.now();

    /*
     * Preserve URL casing.
     */
    const requestUrl =
        normalizeArcGISUrl(url);

    const inspection:
        ArcGISInspection = {
        url: requestUrl,

        isArcGIS: false,

        serviceType:
            "unknown",

        isLayer: false,

        layerId: undefined,

        districtFields: [],

        nameFields: [],

        fieldSamples: []
    };

    let parsedUrl: URL;

    try {
        parsedUrl =
            new URL(requestUrl);
    } catch {
        return inspection;
    }

    if (
        !isArcGISRestUrl(
            parsedUrl
        )
    ) {
        return inspection;
    }

    inspection.isArcGIS =
        true;

    const serviceType =
        detectServiceType(
            parsedUrl.pathname
        );

    inspection.serviceType =
        serviceType;

    if (
        serviceType === "unknown"
    ) {
        return inspection;
    }

    const layerId =
        extractLayerNumber(
            parsedUrl.pathname
        );

    inspection.isLayer =
        layerId !== undefined;

    inspection.layerId =
        layerId;

    // =========================================================================
    // Metadata
    // =========================================================================

    const metadataStart =
        performance.now();

    const metadata =
        await fetchJson(
            requestUrl,
            fetchImpl
        );

    const metadataMs =
        performance.now() -
        metadataStart;

    inspection.objectIdField =
        stringValue(
            metadata?.objectIdField
        );

    inspection.maxRecordCount =
        numberValue(
            metadata?.maxRecordCount
        );

    inspection.spatialReference =
        extractSpatialReference(
            metadata?.spatialReference
        );

    if (!metadata) {
        return inspection;
    }

    inspection.title =
        stringValue(
            metadata.name
        ) ??
        stringValue(
            metadata.mapName
        ) ??
        stringValue(
            metadata.title
        );

    inspection.description =
        stringValue(
            metadata.description
        );

    inspection.serviceDescription =
        stringValue(
            metadata.serviceDescription
        );

    inspection.serviceName =
        stringValue(
            metadata.serviceName
        );

    inspection.layerName =
        inspection.isLayer
            ? stringValue(
                metadata.name
            )
            : undefined;

    inspection.geometryType =
        normalizeGeometryType(
            metadata.geometryType
        );

    const fields =
        extractFields(
            metadata.fields
        );

    inspection.fields =
        fields;

    inspection.supportsQuery =
        detectSupportsQuery(
            metadata
        );

    inspection.supportsGeoJSON =
        detectSupportsGeoJSON(
            metadata
        );

    inspection.supportsPagination =
        detectSupportsPagination(
            metadata
        );

    inspection.districtFields =
        findDistrictFields(
            fields
        );

    inspection.districtField =
        selectBestDistrictField(
            fields,
            inspection.districtFields
        );

    // =========================================================================
    // Query evidence
    // =========================================================================

    let featureCountMs = 0;
    let distinctValuesMs = 0;

    if (
        inspection.isLayer &&
        inspection.supportsQuery
    ) {
        const featureCountStart =
            performance.now();

        inspection.featureCount =
            await getFeatureCount(
                requestUrl,
                fetchImpl
            );

        featureCountMs =
            performance.now() -
            featureCountStart;

        if (inspection.districtField) {
            const distinctValuesStart =
                performance.now();

            inspection.distinctDistrictValues =
                await extractDistinctDistrictValues(
                    requestUrl,
                    inspection.districtField,
                    fetchImpl
                );

            distinctValuesMs =
                performance.now() -
                distinctValuesStart;
        }
    }

    // =========================================================================
    // Post-processing
    // =========================================================================

    /*
     * Everything below this point is synchronous post-processing of the
     * metadata already fetched above.
     *
     * This timer intentionally begins AFTER:
     *
     * - metadata fetch
     * - feature-count query
     * - distinct-district-values query
     *
     * and intentionally covers:
     *
     * - name-field detection
     * - name-field selection
     * - service-root extraction
     * - item/source metadata extraction
     * - field-sample extraction
     */
    const postProcessingStart =
        performance.now();

    inspection.nameFields =
        findNameFields(
            fields
        );

    inspection.nameField =
        selectBestNameField(
            fields,
            inspection.nameFields
        );

    inspection.serviceUrl =
        getServiceRootUrl(
            requestUrl
        );

    inspection.itemId =
        stringValue(
            metadata.itemId
        );

    inspection.owner =
        stringValue(
            metadata.owner
        );

    inspection.tags =
        stringArray(
            metadata.tags
        );

    inspection.typeKeywords =
        stringArray(
            metadata.typeKeywords
        );

    inspection.organization =
        stringValue(
            metadata.organization
        );

    inspection.organizationId =
        stringValue(
            metadata.organizationId
        );

    inspection.created =
        timestampToString(
            metadata.created
        );

    inspection.modified =
        timestampToString(
            metadata.modified
        );

    inspection.serviceItemId =
        stringValue(
            metadata.serviceItemId
        );

    inspection.displayField =
        stringValue(
            metadata.displayField
        );

    inspection.globalIdField =
        stringValue(
            metadata.globalIdField
        );

    inspection.fieldSamples =
        extractFieldSamples(
            metadata
        );

    const postProcessingMs =
        performance.now() -
        postProcessingStart;

    // =========================================================================
    // Timing
    // =========================================================================

    const totalMs =
        performance.now() -
        totalStart;

    console.log(
        "INSPECTION TIMING:",
        {
            title:
                inspection.title ??
                inspection.layerName ??
                requestUrl,

            metadata:
                formatTimingMs(
                    metadataMs
                ),

            featureCount:
                formatTimingMs(
                    featureCountMs
                ),

            distinctValues:
                formatTimingMs(
                    distinctValuesMs
                ),

            postProcessing:
                formatTimingMs(
                    postProcessingMs
                ),

            total:
                formatTimingMs(
                    totalMs
                )
        }
    );

    return inspection;
}


async function extractDistinctDistrictValues(
    layerUrl: string,
    districtField: string,
    fetchImpl: FetchLike = fetch
): Promise<string[]> {

    /*
     * =========================================================================
     * Fast path: request distinct district values directly from ArcGIS.
     * =========================================================================
     *
     * This avoids walking through potentially thousands of features on large
     * thematic datasets such as "Eviction Filings by Council Districts".
     */
    try {

        const queryUrl =
            new URL(
                `${layerUrl}/query`
            );

        queryUrl.searchParams.set(
            "where",
            "1=1"
        );

        queryUrl.searchParams.set(
            "outFields",
            districtField
        );

        queryUrl.searchParams.set(
            "returnGeometry",
            "false"
        );

        queryUrl.searchParams.set(
            "returnDistinctValues",
            "true"
        );

        queryUrl.searchParams.set(
            "f",
            "json"
        );

        const response =
            await fetchImpl(
                queryUrl.toString(),
                {
                    headers: {
                        Accept:
                            "application/json"
                    }
                }
            );

        if (response.ok) {

            const data: unknown =
                await response.json();

            if (
                isObject(data) &&
                !(
                    "error" in data &&
                    data.error
                )
            ) {

                const features =
                    Array.isArray(data.features)
                        ? data.features
                        : [];

                const distinctValues =
                    new Set<string>();

                for (const feature of features) {

                    if (!isObject(feature)) {
                        continue;
                    }

                    const attributes =
                        feature.attributes;

                    if (!isObject(attributes)) {
                        continue;
                    }

                    const value =
                        attributes[districtField];

                    if (
                        value === undefined ||
                        value === null
                    ) {
                        continue;
                    }

                    const normalized =
                        String(value).trim();

                    if (normalized) {
                        distinctValues.add(
                            normalized
                        );
                    }
                }

                /*
                 * A successful response containing values is enough.
                 * No pagination is necessary.
                 */
                if (
                    distinctValues.size > 0
                ) {
                    return [
                        ...distinctValues
                    ];
                }
            }
        }

    } catch {
        /*
         * Fall through to the paginated fallback below.
         */
    }

    /*
     * =========================================================================
     * Fallback: paginated feature queries.
     * =========================================================================
     *
     * Preserve the existing behavior for ArcGIS services that do not support
     * returnDistinctValues or return an otherwise unusable response.
     */
    const values =
        new Set<string>();

    const pageSize =
        100;

    let resultOffset =
        0;

    try {

        while (true) {

            const queryUrl =
                new URL(
                    `${layerUrl}/query`
                );

            queryUrl.searchParams.set(
                "where",
                "1=1"
            );

            queryUrl.searchParams.set(
                "outFields",
                districtField
            );

            queryUrl.searchParams.set(
                "returnGeometry",
                "false"
            );

            queryUrl.searchParams.set(
                "resultRecordCount",
                String(pageSize)
            );

            queryUrl.searchParams.set(
                "resultOffset",
                String(resultOffset)
            );

            queryUrl.searchParams.set(
                "f",
                "json"
            );

            const response =
                await fetchImpl(
                    queryUrl.toString(),
                    {
                        headers: {
                            Accept:
                                "application/json"
                        }
                    }
                );

            if (!response.ok) {
                return [
                    ...values
                ];
            }

            const data: unknown =
                await response.json();

            if (!isObject(data)) {
                return [
                    ...values
                ];
            }

            if (
                "error" in data &&
                data.error
            ) {
                return [
                    ...values
                ];
            }

            const features =
                Array.isArray(data.features)
                    ? data.features
                    : [];

            /*
             * Extract district values from this page.
             */
            for (const feature of features) {

                if (!isObject(feature)) {
                    continue;
                }

                const attributes =
                    feature.attributes;

                if (!isObject(attributes)) {
                    continue;
                }

                const value =
                    attributes[districtField];

                if (
                    value === undefined ||
                    value === null
                ) {
                    continue;
                }

                const normalized =
                    String(value).trim();

                if (normalized) {
                    values.add(
                        normalized
                    );
                }
            }

            /*
             * No features means there are no more pages.
             */
            if (
                features.length === 0
            ) {
                break;
            }

            /*
             * ArcGIS indicates that additional records are
             * available through exceededTransferLimit.
             *
             * If it is not true, this page is the final page.
             */
            const exceededTransferLimit =
                data.exceededTransferLimit === true;

            if (
                !exceededTransferLimit
            ) {
                break;
            }

            /*
             * Advance to the next page.
             */
            resultOffset +=
                features.length;

            /*
             * Defensive protection against a malformed service
             * repeatedly returning the same page size without
             * making progress.
             */
            if (
                features.length < pageSize
            ) {
                break;
            }
        }

        return [
            ...values
        ];

    } catch {
        return [
            ...values
        ];
    }
}


async function getFeatureCount(
    layerUrl: string,
    fetchImpl: FetchLike = fetch
): Promise<number | undefined> {

    const queryUrl =
        new URL(
            `${layerUrl}/query`
        );

    queryUrl.searchParams.set(
        "where",
        "1=1"
    );

    queryUrl.searchParams.set(
        "returnCountOnly",
        "true"
    );

    queryUrl.searchParams.set(
        "f",
        "json"
    );

    try {
        const response =
            await fetchImpl(
                queryUrl.toString(),
                {
                    headers: {
                        Accept:
                            "application/json"
                    }
                }
            );

        if (!response.ok) {
            return undefined;
        }

        const data: unknown =
            await response.json();

        if (!isObject(data)) {
            return undefined;
        }

        if (
            "error" in data &&
            data.error
        ) {
            return undefined;
        }

        const count =
            data.count;

        if (
            typeof count !== "number" ||
            !Number.isFinite(count) ||
            count < 0
        ) {
            return undefined;
        }

        return count;

    } catch {
        return undefined;
    }
}


// =============================================================================
// Service layer discovery
// =============================================================================

export interface ArcGISLayerReference {
    id: number;
    name?: string;
    type?: string;
    url?: string;
}


/**
 * Discover layers and tables exposed by an ArcGIS service root.
 *
 * Example:
 *
 *   .../FeatureServer
 *   .../MapServer
 *
 * If the supplied URL is already a layer URL, this returns [].
 */
export async function getArcGISLayers(
    url: string,
    fetchImpl: FetchLike = fetch
): Promise<ArcGISLayerReference[]> {

    /*
     * IMPORTANT:
     *
     * requestUrl preserves the original ArcGIS URL.
     * We must NOT lowercase it before fetching.
     */
    const requestUrl =
        normalizeArcGISUrl(url);

    let parsedUrl: URL;

    try {
        parsedUrl =
            new URL(requestUrl);
    } catch {
        return [];
    }

    const serviceType =
        detectServiceType(
            parsedUrl.pathname
        );

    if (
        serviceType === "unknown"
    ) {
        return [];
    }

    /*
     * If this is already a layer URL,
     * there is nothing to expand.
     */
    if (
        extractLayerNumber(
            parsedUrl.pathname
        ) !== undefined
    ) {
        return [];
    }

    /*
     * Fetch using the ORIGINAL casing.
     *
     * This is important for URLs such as:
     *
     * https://services1.arcgis.com/Ezk9fcjSUkeadg6u/ArcGIS/rest/services/TucsonWards2022/FeatureServer
     */
    const metadata =
        await fetchJson(
            requestUrl,
            fetchImpl
        );

    if (!metadata) {
        return [];
    }

    const layers =
        Array.isArray(metadata.layers)
            ? metadata.layers
            : [];

    const tables =
        Array.isArray(metadata.tables)
            ? metadata.tables
            : [];

    /*
     * Preserve the exact service URL that ArcGIS
     * supplied rather than reconstructing it from
     * a lowercased/normalized URL.
     */
    const serviceRootUrl =
        getServiceRootUrl(
            requestUrl
        );

    return [
        ...layers,
        ...tables
    ]
        .filter(isObject)
        .map(layer => {

            const id =
                Number(layer.id);

            return {
                id,

                name:
                    stringValue(
                        layer.name
                    ),

                type:
                    stringValue(
                        layer.type
                    ),

                url:
                    Number.isFinite(id)
                        ? `${serviceRootUrl}/${id}`
                        : undefined
            };
        })
        .filter(
            layer =>
                Number.isFinite(
                    layer.id
                )
        );
}


// =============================================================================
// URL helpers
// =============================================================================

function normalizeArcGISUrl(
    url: string
): string {
    return url
        .trim()
        .replace(/\/+$/, "");
}


/**
 * Returns a comparison-safe URL.
 *
 * IMPORTANT:
 * Do not use this URL for HTTP requests.
 *
 * ArcGIS service paths can be case-sensitive. For example:
 *
 *     /TucsonWards2022/FeatureServer
 *
 * must not become:
 *
 *     /tucsonwards2022/FeatureServer
 */
export function canonicalizeArcGISUrl(
    url: string
): string {
    return normalizeArcGISUrl(url)
        .toLowerCase();
}


function isArcGISRestUrl(
    url: URL
): boolean {
    const pathname =
        url.pathname;

    return (
        /\/arcgis\/rest\//i.test(pathname) ||
        /\/FeatureServer(?:\/|$)/i.test(pathname) ||
        /\/MapServer(?:\/|$)/i.test(pathname)
    );
}


function detectServiceType(
    pathname: string
): ArcGISServiceType {

    if (
        /\/featureserver(?:\/|$)/i.test(pathname)
    ) {
        return "FeatureServer";
    }

    if (
        /\/mapserver(?:\/|$)/i.test(pathname)
    ) {
        return "MapServer";
    }

    return "unknown";
}


function extractLayerNumber(
    pathname: string
): number | undefined {

    const match =
        pathname.match(
            /\/(?:FeatureServer|MapServer)\/(\d+)\/?$/i
        );

    if (!match) {
        return undefined;
    }

    const value =
        Number(match[1]);

    return Number.isFinite(value)
        ? value
        : undefined;
}


// =============================================================================
// Fetching
// =============================================================================

async function fetchJson(
    url: string,
    fetchImpl: FetchLike = fetch
): Promise<JsonObject | undefined> {

    try {
        const requestUrl =
            appendJsonFormat(url);

        const response =
            await fetchImpl(
                requestUrl,
                {
                    headers: {
                        Accept:
                            "application/json"
                    }
                }
            );

        if (!response.ok) {
            return undefined;
        }

        const data: unknown =
            await response.json();

        if (!isObject(data)) {
            return undefined;
        }

        if (
            "error" in data &&
            data.error
        ) {
            return undefined;
        }

        return data;

    } catch {
        return undefined;
    }
}


function appendJsonFormat(
    url: string
): string {

    const parsed =
        new URL(url);

    if (
        !parsed.searchParams.has("f")
    ) {
        parsed.searchParams.set(
            "f",
            "json"
        );
    }

    return parsed.toString();
}


// =============================================================================
// Fields
// =============================================================================

function extractFields(
    value: unknown
): ArcGISField[] {

    if (!Array.isArray(value)) {
        return [];
    }

    const fields: ArcGISField[] = [];

    for (const field of value) {

        if (!isObject(field)) {
            continue;
        }

        const name =
            stringValue(
                field.name
            );

        if (!name) {
            continue;
        }

        fields.push({
            name,

            alias:
                stringValue(
                    field.alias
                ),

            type:
                stringValue(
                    field.type
                ),

            length:
                numberValue(
                    field.length
                ),

            domain:
                field.domain
        });
    }

    return fields;
}


// =============================================================================
// District field detection
// =============================================================================

function findDistrictFields(
    fields: ArcGISField[]
): string[] {

    return fields
        .map(field => ({
            field,
            score:
                scoreDistrictField(
                    field
                )
        }))
        .filter(
            item =>
                item.score > 0
        )
        .sort(
            (a, b) =>
                b.score - a.score
        )
        .map(
            item =>
                item.field.name
        );
}


function scoreDistrictField(
    field: ArcGISField
): number {

    const name =
        normalizeFieldText(
            field.name
        );

    const alias =
        normalizeFieldText(
            field.alias
        );

    let score = 0;

    // -------------------------------------------------------------------------
    // Very strong identifiers
    // -------------------------------------------------------------------------

    if (
        /^(district|dist|districtno|districtnum|districtnumber)$/.test(
            name
        )
    ) {
        score += 70;
    }

    if (
        /^(ward|wardno|wardnum|wardnumber)$/.test(
            name
        )
    ) {
        score += 70;
    }

    if (
        /^(councildistrict|councildist|councilward)$/.test(
            name
        )
    ) {
        score += 75;
    }

    // -------------------------------------------------------------------------
    // Strong keywords
    // -------------------------------------------------------------------------

    if (
        /\bdistrict\b/.test(
            name
        )
    ) {
        score += 50;
    }

    if (
        /\bward\b/.test(
            name
        )
    ) {
        score += 50;
    }

    if (
        /\bcouncil\b/.test(
            name
        )
    ) {
        score += 40;
    }

    if (
        /\balderman/.test(
            name
        )
    ) {
        score += 40;
    }

    if (
        /\bmunicipal\b/.test(name) &&
        /\bdistrict\b/.test(name)
    ) {
        score += 35;
    }

    // -------------------------------------------------------------------------
    // Alias
    // -------------------------------------------------------------------------

    if (
        /\bdistrict\b/.test(
            alias
        )
    ) {
        score += 25;
    }

    if (
        /\bward\b/.test(
            alias
        )
    ) {
        score += 25;
    }

    if (
        /\bcouncil\b/.test(
            alias
        )
    ) {
        score += 20;
    }

    if (
        /\balderman/.test(
            alias
        )
    ) {
        score += 20;
    }

    // -------------------------------------------------------------------------
    // Negative evidence
    // -------------------------------------------------------------------------

    if (
        /\bcounty\b/.test(
            name
        )
    ) {
        score -= 60;
    }

    if (
        /\bstate\b/.test(
            name
        )
    ) {
        score -= 60;
    }

    if (
        /\bzip\b/.test(
            name
        )
    ) {
        score -= 60;
    }

    if (
        /\btract\b/.test(
            name
        )
    ) {
        score -= 50;
    }

    if (
        /\bprecinct\b/.test(
            name
        )
    ) {
        score -= 30;
    }

    if (
        /\bbeat\b/.test(
            name
        )
    ) {
        score -= 25;
    }

    if (
        /\bplace\b/.test(
            name
        )
    ) {
        score -= 20;
    }

    return Math.max(
        score,
        0
    );
}


function selectBestDistrictField(
    fields: ArcGISField[],
    districtFields: string[]
): string | undefined {

    if (
        districtFields.length === 0
    ) {
        return undefined;
    }

    return districtFields
        .map(name => {

            const field =
                fields.find(
                    item =>
                        item.name === name
                );

            return {
                name,

                score:
                    field
                        ? scoreDistrictField(
                            field
                        )
                        : 0
            };
        })
        .sort(
            (a, b) =>
                b.score - a.score
        )[0]?.name;
}


// =============================================================================
// Name field detection
// =============================================================================

function findNameFields(
    fields: ArcGISField[]
): string[] {

    return fields
        .map(field => ({
            field,
            score:
                scoreNameField(
                    field
                )
        }))
        .filter(
            item =>
                item.score > 0
        )
        .sort(
            (a, b) =>
                b.score - a.score
        )
        .map(
            item =>
                item.field.name
        );
}


function scoreNameField(
    field: ArcGISField
): number {

    const name =
        normalizeFieldText(
            field.name
        );

    const alias =
        normalizeFieldText(
            field.alias
        );

    let score = 0;

    // -------------------------------------------------------------------------
    // Exact/common names
    // -------------------------------------------------------------------------

    if (
        /^(name|districtname|wardname|councilname)$/.test(
            name
        )
    ) {
        score += 60;
    }

    if (
        /^(district_name|ward_name|council_name)$/.test(
            field.name.toLowerCase()
        )
    ) {
        score += 60;
    }

    // -------------------------------------------------------------------------
    // Combined district/name fields
    // -------------------------------------------------------------------------

    if (
        /\bdistrict\b/.test(name) &&
        /\bname\b/.test(name)
    ) {
        score += 50;
    }

    if (
        /\bward\b/.test(name) &&
        /\bname\b/.test(name)
    ) {
        score += 50;
    }

    if (
        /\bcouncil\b/.test(name) &&
        /\bname\b/.test(name)
    ) {
        score += 45;
    }

    // -------------------------------------------------------------------------
    // Alias
    // -------------------------------------------------------------------------

    if (
        /\bname\b/.test(alias)
    ) {
        score += 25;
    }

    if (
        /\bdistrict\b/.test(alias)
    ) {
        score += 20;
    }

    if (
        /\bward\b/.test(alias)
    ) {
        score += 20;
    }

    return score;
}


function selectBestNameField(
    fields: ArcGISField[],
    nameFields: string[]
): string | undefined {

    if (
        nameFields.length === 0
    ) {
        return undefined;
    }

    return nameFields
        .map(name => {

            const field =
                fields.find(
                    item =>
                        item.name === name
                );

            return {
                name,

                score:
                    field
                        ? scoreNameField(
                            field
                        )
                        : 0
            };
        })
        .sort(
            (a, b) =>
                b.score - a.score
        )[0]?.name;
}


// =============================================================================
// Capabilities
// =============================================================================

function detectSupportsQuery(
    metadata: JsonObject
): boolean {

    const capabilities =
        stringValue(
            metadata.capabilities
        );

    if (capabilities) {

        return capabilities
            .toLowerCase()
            .split(",")
            .map(
                value =>
                    value.trim()
            )
            .includes("query");
    }

    return Boolean(
        metadata.objectIdField ||
        metadata.advancedQueryCapabilities
    );
}


function detectSupportsGeoJSON(
    metadata: JsonObject
): boolean {

    const supportedFormats =
        stringValue(
            metadata.supportedQueryFormats
        );

    if (!supportedFormats) {
        return false;
    }

    return supportedFormats
        .toLowerCase()
        .split(",")
        .map(
            value =>
                value.trim()
        )
        .includes("geojson");
}


function detectSupportsPagination(
    metadata: JsonObject
): boolean {

    const advanced =
        isObject(
            metadata.advancedQueryCapabilities
        )
            ? metadata.advancedQueryCapabilities
            : undefined;

    return Boolean(
        advanced?.supportsPagination
    );
}


// =============================================================================
// Service URL
// =============================================================================

function getServiceRootUrl(
    url: string
): string {

    try {
        const parsed =
            new URL(url);

        const parts =
            parsed.pathname
                .split("/")
                .filter(Boolean);

        const serviceIndex =
            parts.findIndex(
                part =>
                    /^(FeatureServer|MapServer)$/i.test(
                        part
                    )
            );

        if (
            serviceIndex === -1
        ) {
            return url.replace(
                /\/+$/,
                ""
            );
        }

        parsed.pathname =
            "/" +
            parts
                .slice(
                    0,
                    serviceIndex + 1
                )
                .join("/");

        parsed.search =
            "";

        return parsed.toString()
            .replace(
                /\/+$/,
                ""
            );

    } catch {
        return url.replace(
            /\/+$/,
            ""
        );
    }
}


// =============================================================================
// Field samples
// =============================================================================

function extractFieldSamples(
    metadata: JsonObject
): ArcGISFieldSample[] {

    const fields =
        extractFields(
            metadata.fields
        );

    const samples:
        ArcGISFieldSample[] = [];

    for (const field of fields) {

        if (
            !isObject(
                field.domain
            )
        ) {
            continue;
        }

        const codedValues =
            field.domain.codedValues;

        if (
            !Array.isArray(
                codedValues
            )
        ) {
            continue;
        }

        const values =
            codedValues
                .map(value => {

                    if (!isObject(value)) {
                        return undefined;
                    }

                    return (
                        stringValue(
                            value.name
                        ) ??
                        stringValue(
                            value.code
                        )
                    );
                })
                .filter(
                    (
                        value
                    ): value is string =>
                        Boolean(value)
                )
                .slice(
                    0,
                    25
                );

        if (
            values.length > 0
        ) {
            samples.push({
                field:
                    field.name,

                values
            });
        }
    }

    return samples;
}


// =============================================================================
// Normalization helpers
// =============================================================================

function normalizeFieldText(
    value: string | undefined
): string {

    return (
        value ?? ""
    )
        .trim()
        .toLowerCase()
        .replace(
            /[\_-]+/g,
            " "
        )
        .replace(
            /\s+/g,
            " "
        );
}


function normalizeGeometryType(
    value: unknown
): ArcGISGeometryType | undefined {

    if (
        typeof value !== "string"
    ) {
        return undefined;
    }

    switch (
        value.toLowerCase()
    ) {

        case "esrigeometrypoint":
            return "esriGeometryPoint";

        case "esrigeometrymultipoint":
            return "esriGeometryMultipoint";

        case "esrigeometrypolyline":
            return "esriGeometryPolyline";

        case "esrigeometrypolygon":
            return "esriGeometryPolygon";

        case "esrigeometryenvelope":
            return "esriGeometryEnvelope";

        case "point":
            return "point";

        case "multipoint":
            return "multipoint";

        case "polyline":
            return "polyline";

        case "polygon":
            return "polygon";

        default:
            return "unknown";
    }
}


// =============================================================================
// Generic value helpers
// =============================================================================

function isObject(
    value: unknown
): value is JsonObject {

    return (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
    );
}


function stringValue(
    value: unknown
): string | undefined {

    return typeof value === "string"
        ? value
        : undefined;
}


function numberValue(
    value: unknown
): number | undefined {

    return (
        typeof value === "number" &&
        Number.isFinite(value)
    )
        ? value
        : undefined;
}


function stringArray(
    value: unknown
): string[] | undefined {

    if (
        !Array.isArray(value)
    ) {
        return undefined;
    }

    const result =
        value.filter(
            (
                item
            ): item is string =>
                typeof item === "string"
        );

    return result.length > 0
        ? result
        : undefined;
}


function timestampToString(
    value: unknown
): string | undefined {

    if (
        typeof value !== "number"
    ) {
        return undefined;
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return undefined;
    }

    return date.toISOString();
}


function extractSpatialReference(
    value: unknown
):
    | {
        wkid?: number;
        latestWkid?: number;
        wkt?: string;
    }
    | undefined {

    if (
        !isObject(value)
    ) {
        return undefined;
    }

    const wkid =
        numberValue(
            value.wkid
        );

    const latestWkid =
        numberValue(
            value.latestWkid
        );

    const wkt =
        stringValue(
            value.wkt
        );

    if (
        wkid === undefined &&
        latestWkid === undefined &&
        wkt === undefined
    ) {
        return undefined;
    }

    return {
        wkid,
        latestWkid,
        wkt
    };
}