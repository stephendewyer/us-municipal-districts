import {
    test
} from "node:test";

import assert from "node:assert/strict";

import type {
    ArcGISInspection,
    ArcGISCandidateValidation,
    CandidateClassification,
    DiscoveryCandidate,
    EquivalentLayerGroup,
    InspectedCandidate
} from "../../generator/src/types.js";

import {
    selectCanonicalSource,
    selectMunicipalityCanonicalSource
} from "../../generator/src/canonical.js";


// =============================================================================
// Test fixtures
// =============================================================================

const PHOENIX_COUNCIL_DISTRICTS_URL =
    "https://maps.phoenix.gov/pub/rest/services/Public/Council_Districts/MapServer/0";

const PHOENIX_COUNCIL_DISTRICTS_HASH_URL =
    "https://maps.phoenix.gov/pub/rest/services/Public/Council_Districts/MapServer/1";

const PHOENIX_EVICTION_FILINGS_URL =
    "https://maps.phoenix.gov/pub/rest/services/Public/Eviction_Filings_HSD/MapServer/1";

const TUCSON_WARDS_2022_URL =
    "https://services1.arcgis.com/Ezk9fcjSUkeadg6u/arcgis/rest/services/TucsonWards2022/FeatureServer/156";


function createDiscoveryCandidate(
    url = "https://example.com/FeatureServer/0"
): DiscoveryCandidate {

    return {

        placeFips:
            "0477000",

        city:
            "Tucson",

        state:
            "AZ",

        url,

        title:
            "Tucson Ward Boundaries",

        score:
            50,

        requiresReview:
            false,

        reasons:
            []
    };
}


function createArcGISInspection(
    url = "https://example.com/FeatureServer/0",

    title = "Tucson Ward Boundaries"
): ArcGISInspection {

    return {

        url,

        isArcGIS:
            true,

        serviceType:
            "FeatureServer",

        isLayer:
            true,

        geometryType:
            "esriGeometryPolygon",

        title,

        districtFields:
            ["WARD"],

        districtField:
            "WARD",

        nameFields:
            [],

        fieldSamples:
            []
    };
}


function createClassification(
    options: {
        officialMunicipalSource?: boolean;
        requiresReview?: boolean;
        sourceRole?: CandidateClassification["sourceRole"];
        districtType?: CandidateClassification["districtType"];
        isThematicDataset?: boolean;
        isCensusDataset?: boolean;
        isParcelDataset?: boolean;
        isHousingDataset?: boolean;
    } = {}
): CandidateClassification {

    return {

        isBoundaryLayer:
            true,

        isPoliticalBoundary:
            true,

        isMunicipalPoliticalBoundary:
            true,

        publisherLevel:
            "municipal",

        isThematicDataset:
            options.isThematicDataset ??
            false,

        isCensusDataset:
            options.isCensusDataset ??
            false,

        isParcelDataset:
            options.isParcelDataset ??
            false,

        isHousingDataset:
            options.isHousingDataset ??
            false,

        officialMunicipalSource:
            options.officialMunicipalSource ??
            false,

        districtType:
            options.districtType ??
            "ward",

        temporalStatus:
            "undated",

        sourceRole:
            options.sourceRole ??
            "unknown",

        rejected:
            false,

        rejectionReasons:
            [],

        requiresReview:
            options.requiresReview ??
            false,

        matches: {

            thematic:
                [],

            census:
                [],

            parcel:
                [],

            housing:
                [],

            political:
                [
                    "ward",
                    "city council"
                ],

            boundary:
                [
                    "boundary"
                ],

            official:
                options.officialMunicipalSource
                    ? [
                        "municipal government"
                    ]
                    : []
        }
    };
}


function createValidation(
    confidence = 90
): ArcGISCandidateValidation {

    return {

        isLikelyPoliticalBoundary:
            true,

        confidence,

        districtField:
            "WARD",

        sampleCount:
            10,

        featureCount:
            10,

        distinctDistrictValues:
            [
                "1",
                "2",
                "3",
                "4"
            ],

        districtValuePattern:
            "ward-number",

        geometryType:
            "esriGeometryPolygon",

        evidence:
            [
                "Test validation fixture"
            ]
    };
}


function createCandidate(
    geographyStatus?:
        | "strong-match"
        | "probable-match"
        | "weak-match"
        | "no-match"
        | "invalid",

    url =
        "https://example.com/FeatureServer/0",

    title =
        "Tucson Ward Boundaries",

    options: {
        officialMunicipalSource?: boolean;
        sourceRole?: CandidateClassification["sourceRole"];
        districtType?: CandidateClassification["districtType"];
        validationConfidence?: number;
        requiresReview?: boolean;
        isThematicDataset?: boolean;
        isCensusDataset?: boolean;
        isParcelDataset?: boolean;
        isHousingDataset?: boolean;
    } = {}
): InspectedCandidate {

    const candidate:
        InspectedCandidate = {

        candidate:
            createDiscoveryCandidate(
                url
            ),

        inspection:
            createArcGISInspection(
                url,
                title
            ),

        classification:
            createClassification({
                officialMunicipalSource:
                    options.officialMunicipalSource,

                sourceRole:
                    options.sourceRole,

                districtType:
                    options.districtType,

                requiresReview:
                    options.requiresReview,

                isThematicDataset:
                    options.isThematicDataset,

                isCensusDataset:
                    options.isCensusDataset,

                isParcelDataset:
                    options.isParcelDataset,

                isHousingDataset:
                    options.isHousingDataset
            }),

        validation:
            createValidation(
                options.validationConfidence ??
                90
            )
    };


    if (
        geographyStatus !==
        undefined
    ) {

        const intersectionArea =
            geographyStatus ===
                "strong-match"
                ? 100
                : geographyStatus ===
                    "probable-match"
                    ? 75
                    : geographyStatus ===
                        "weak-match"
                        ? 40
                        : 0;

        const coverage =
            geographyStatus ===
                "strong-match"
                ? 1
                : geographyStatus ===
                    "probable-match"
                    ? 0.75
                    : geographyStatus ===
                        "weak-match"
                        ? 0.40
                        : 0;

        candidate.municipalityGeographyValidation = {

            status:
                geographyStatus,

            score:
                geographyStatus ===
                    "strong-match"
                    ? 100
                    : geographyStatus ===
                        "probable-match"
                        ? 75
                        : geographyStatus ===
                            "weak-match"
                            ? 40
                            : 0,

            likelyMunicipalityMatch:
                geographyStatus ===
                    "strong-match" ||
                geographyStatus ===
                    "probable-match",

            municipalityArea:
                100,

            candidateArea:
                100,

            intersectionArea,

            coverageOfMunicipality:
                coverage,

            candidateInsideMunicipality:
                coverage,

            candidateFeatureCount:
                4,

            validCandidateFeatureCount:
                4,

            reasons:
                [
                    `Test geographic status: ${geographyStatus}`
                ]
        };
    }


    return candidate;
}


function createGroup(
    candidates: InspectedCandidate[],
    id =
        "test-group"
): EquivalentLayerGroup {

    return {

        id,

        candidates,

        confidence:
            1,

        reasons:
            [
                "Test equivalent-layer group"
            ]
    };
}


function createPhoenixCandidate(
    url: string,
    title: string,
    options: {
        officialMunicipalSource?: boolean;
        sourceRole?: CandidateClassification["sourceRole"];
        validationConfidence?: number;
    } = {}
): InspectedCandidate {

    const candidate =
        createCandidate(
            undefined,
            url,
            title,
            {
                officialMunicipalSource:
                    options.officialMunicipalSource ??
                    true,

                sourceRole:
                    options.sourceRole ??
                    "unknown",

                districtType:
                    "council-district",

                validationConfidence:
                    options.validationConfidence ??
                    100
            }
        );


    candidate.candidate.city =
        "Phoenix";

    candidate.candidate.state =
        "AZ";

    candidate.candidate.placeFips =
        "0455000";

    candidate.candidate.title =
        title;

    candidate.classification.districtType =
        "council-district";

    candidate.inspection.districtFields =
        [
            "DISTRICT"
        ];

    candidate.inspection.districtField =
        "DISTRICT";

    candidate.validation =
        createValidation(
            options.validationConfidence ??
            100
        );

    candidate.validation.districtField =
        "DISTRICT";

    candidate.validation.distinctDistrictValues =
        [
            "1",
            "2",
            "3",
            "4",
            "5",
            "6",
            "7",
            "8"
        ];

    candidate.validation.districtValuePattern =
        "district-number";

    return candidate;
}


function createTucsonWardsCandidate(
    title = "TucsonWards2022",
    url = TUCSON_WARDS_2022_URL,
    confidence = 98
): InspectedCandidate {

    const candidate =
        createCandidate(
            undefined,
            url,
            title,
            {
                officialMunicipalSource:
                    true,

                districtType:
                    "ward",

                validationConfidence:
                    confidence
            }
        );


    candidate.candidate.title =
        title;

    candidate.classification.districtType =
        "ward";

    candidate.classification.officialMunicipalSource =
        true;

    candidate.inspection.districtFields =
        [
            "WARD"
        ];

    candidate.inspection.districtField =
        "WARD";

    candidate.validation =
        createValidation(
            confidence
        );

    candidate.validation.districtField =
        "WARD";

    candidate.validation.distinctDistrictValues =
        [
            "1",
            "2",
            "3",
            "4",
            "5",
            "6"
        ];

    candidate.validation.districtValuePattern =
        "ward-number";

    return candidate;
}


// =============================================================================
// Basic canonical selection
// =============================================================================

test(
    "selectCanonicalSource prefers a strong geographic match over a probable match",
    () => {

        const probable =
            createCandidate(
                "probable-match",
                "https://example.com/probable/FeatureServer/0"
            );

        const strong =
            createCandidate(
                "strong-match",
                "https://example.com/strong/FeatureServer/0"
            );


        const result =
            selectCanonicalSource(
                createGroup([
                    probable,
                    strong
                ])
            );


        assert.ok(
            result
        );

        assert.equal(
            result.url,
            strong.inspection.url
        );

        assert.match(
            result.selectionReasons.join(" "),
            /\+30 strong municipality geography match/
        );
    }
);


test(
    "selectCanonicalSource allows a strong geographic match to overcome a review penalty",
    () => {

        const reviewCandidate =
            createCandidate(
                undefined,
                "https://example.com/review/FeatureServer/0",
                "Tucson Ward Boundaries",
                {
                    requiresReview:
                        true
                }
            );


        const strongGeographyCandidate =
            createCandidate(
                "strong-match",
                "https://example.com/geographic/FeatureServer/0"
            );


        const result =
            selectCanonicalSource(
                createGroup([
                    reviewCandidate,
                    strongGeographyCandidate
                ])
            );


        assert.ok(
            result
        );

        assert.equal(
            result.url,
            strongGeographyCandidate.inspection.url
        );

        assert.match(
            result.selectionReasons.join(" "),
            /\+30 strong municipality geography match/
        );
    }
);


test(
    "selectCanonicalSource rejects a candidate with a geographic no-match",
    () => {

        const noMatch =
            createCandidate(
                "no-match",
                "https://example.com/no-match/FeatureServer/0"
            );

        const strong =
            createCandidate(
                "strong-match",
                "https://example.com/strong/FeatureServer/0"
            );


        const result =
            selectCanonicalSource(
                createGroup([
                    noMatch,
                    strong
                ])
            );


        assert.ok(
            result
        );

        assert.equal(
            result.url,
            strong.inspection.url
        );

        assert.notEqual(
            result.url,
            noMatch.inspection.url
        );
    }
);


test(
    "selectCanonicalSource uses geographic ranking when selecting the canonical source",
    () => {

        const weak =
            createCandidate(
                "weak-match",
                "https://example.com/weak/FeatureServer/0"
            );

        const strong =
            createCandidate(
                "strong-match",
                "https://example.com/strong/FeatureServer/0"
            );


        const result =
            selectCanonicalSource(
                createGroup([
                    weak,
                    strong
                ])
            );


        assert.ok(
            result
        );

        assert.equal(
            result.url,
            strong.inspection.url
        );

        assert.equal(
            result.officialMunicipalSource,
            false
        );

        assert.equal(
            result.serviceType,
            "FeatureServer"
        );

        assert.equal(
            result.districtField,
            "WARD"
        );
    }
);


test(
    "selectCanonicalSource propagates ranking reasons into selectionReasons",
    () => {

        const candidate =
            createCandidate(
                "strong-match"
            );


        const result =
            selectCanonicalSource(
                createGroup([
                    candidate
                ])
            );


        assert.ok(
            result
        );


        assert.ok(
            result.selectionReasons.some(
                reason =>
                    reason ===
                    "+30 strong municipality geography match"
            )
        );


        assert.ok(
            result.selectionReasons.some(
                reason =>
                    reason ===
                    "+15 district type: ward"
            )
        );


        assert.ok(
            result.selectionReasons.some(
                reason =>
                    reason ===
                    "+15 district field: WARD"
            )
        );


        assert.ok(
            result.selectionReasons.some(
                reason =>
                    reason ===
                    "+20 validation confidence >= 90"
            )
        );
    }
);


// =============================================================================
// Temporal canonical selection
// =============================================================================

test(
    "selectCanonicalSource prefers a current candidate over an undated candidate",
    () => {

        const undated =
            createCandidate(
                undefined,
                "https://example.com/undated/FeatureServer/0",
                "Tucson Ward Boundaries"
            );


        const current =
            createCandidate(
                undefined,
                "https://example.com/current/FeatureServer/0",
                "Tucson Ward Boundaries 2026"
            );


        const result =
            selectCanonicalSource(
                createGroup([
                    undated,
                    current
                ])
            );


        assert.ok(
            result
        );

        assert.equal(
            result.url,
            current.inspection.url
        );

        assert.equal(
            result.title,
            "Tucson Ward Boundaries 2026"
        );

        assert.ok(
            result.selectionReasons.some(
                reason =>
                    reason ===
                    "+20 temporal status: current"
            )
        );
    }
);


test(
    "selectCanonicalSource prefers an undated candidate over a historical candidate",
    () => {

        const historical =
            createCandidate(
                undefined,
                "https://example.com/historical/FeatureServer/0",
                "Tucson Ward Boundaries 2015-2023"
            );


        const undated =
            createCandidate(
                undefined,
                "https://example.com/undated/FeatureServer/0",
                "Tucson Ward Boundaries"
            );


        const result =
            selectCanonicalSource(
                createGroup([
                    historical,
                    undated
                ])
            );


        assert.ok(
            result
        );

        assert.equal(
            result.url,
            undated.inspection.url
        );

        assert.equal(
            result.title,
            "Tucson Ward Boundaries"
        );
    }
);


test(
    "selectCanonicalSource demotes a historical candidate relative to an undated candidate",
    () => {

        const historical =
            createCandidate(
                undefined,
                "https://example.com/historical/FeatureServer/0",
                "Tucson Ward Boundaries 2015-2023"
            );


        const undated =
            createCandidate(
                undefined,
                "https://example.com/undated/FeatureServer/0",
                "Tucson Ward Boundaries"
            );


        const result =
            selectCanonicalSource(
                createGroup([
                    historical,
                    undated
                ])
            );


        assert.ok(
            result
        );

        assert.equal(
            result.url,
            undated.inspection.url
        );

        assert.equal(
            result.title,
            "Tucson Ward Boundaries"
        );


        assert.ok(
            result.alternatives.some(
                alternative =>
                    alternative.url ===
                    historical.inspection.url
            )
        );
    }
);


test(
    "selectCanonicalSource prefers a current candidate over a historical candidate",
    () => {

        const historical =
            createCandidate(
                undefined,
                "https://example.com/historical/FeatureServer/0",
                "Tucson Ward Boundaries 2015-2023"
            );


        const current =
            createCandidate(
                undefined,
                "https://example.com/current/FeatureServer/0",
                "Tucson Ward Boundaries 2026"
            );


        const result =
            selectCanonicalSource(
                createGroup([
                    historical,
                    current
                ])
            );


        assert.ok(
            result
        );

        assert.equal(
            result.url,
            current.inspection.url
        );

        assert.equal(
            result.title,
            "Tucson Ward Boundaries 2026"
        );
    }
);


test(
    "selectCanonicalSource preserves a historical candidate as an alternative",
    () => {

        const historical =
            createCandidate(
                undefined,
                "https://example.com/historical/FeatureServer/0",
                "Tucson Ward Boundaries 2015-2023"
            );


        const current =
            createCandidate(
                undefined,
                "https://example.com/current/FeatureServer/0",
                "Tucson Ward Boundaries 2026"
            );


        const result =
            selectCanonicalSource(
                createGroup([
                    historical,
                    current
                ])
            );


        assert.ok(
            result
        );

        assert.equal(
            result.url,
            current.inspection.url
        );

        assert.equal(
            result.alternatives.length,
            1
        );

        assert.equal(
            result.alternatives[0]?.url,
            historical.inspection.url
        );

        assert.equal(
            result.alternatives[0]?.title,
            "Tucson Ward Boundaries 2015-2023"
        );
    }
);


// =============================================================================
// Source-role selection
// =============================================================================

test(
    "selectCanonicalSource rejects derived analytical datasets",
    () => {

        const derived =
            createCandidate(
                undefined,
                "https://example.com/derived/FeatureServer/0",
                "Ward Analysis",
                {
                    sourceRole:
                        "derived"
                }
            );


        const result =
            selectCanonicalSource(
                createGroup([
                    derived
                ])
            );


        assert.equal(
            result,
            undefined
        );
    }
);


test(
    "selectCanonicalSource rejects duplicate datasets",
    () => {

        const duplicate =
            createCandidate(
                undefined,
                "https://example.com/duplicate/FeatureServer/0",
                "Ward Boundaries Duplicate",
                {
                    sourceRole:
                        "duplicate"
                }
            );


        const result =
            selectCanonicalSource(
                createGroup([
                    duplicate
                ])
            );


        assert.equal(
            result,
            undefined
        );
    }
);


test(
    "selectCanonicalSource prefers an authoritative source role",
    () => {

        const unknown =
            createCandidate(
                undefined,
                "https://example.com/unknown/FeatureServer/0",
                "Tucson Ward Boundaries",
                {
                    sourceRole:
                        "unknown"
                }
            );


        const authoritative =
            createCandidate(
                undefined,
                "https://example.com/authoritative/FeatureServer/0",
                "Tucson Ward Boundaries",
                {
                    sourceRole:
                        "authoritative"
                }
            );


        const result =
            selectCanonicalSource(
                createGroup([
                    unknown,
                    authoritative
                ])
            );


        assert.ok(
            result
        );

        assert.equal(
            result.url,
            authoritative.inspection.url
        );
    }
);


// =============================================================================
// Validation eligibility
// =============================================================================

test(
    "selectCanonicalSource rejects a candidate without validation",
    () => {

        const candidate =
            createCandidate();


        candidate.validation =
            undefined;


        const result =
            selectCanonicalSource(
                createGroup([
                    candidate
                ])
            );


        assert.equal(
            result,
            undefined
        );
    }
);


test(
    "selectCanonicalSource rejects a candidate below validation confidence threshold",
    () => {

        const candidate =
            createCandidate(
                undefined,
                "https://example.com/low-confidence/FeatureServer/0",
                "Tucson Ward Boundaries",
                {
                    validationConfidence:
                        59
                }
            );


        const result =
            selectCanonicalSource(
                createGroup([
                    candidate
                ])
            );


        assert.equal(
            result,
            undefined
        );
    }
);


test(
    "selectCanonicalSource accepts a candidate at the validation confidence threshold",
    () => {

        const candidate =
            createCandidate(
                undefined,
                "https://example.com/threshold/FeatureServer/0",
                "Tucson Ward Boundaries",
                {
                    validationConfidence:
                        60
                }
            );


        const result =
            selectCanonicalSource(
                createGroup([
                    candidate
                ])
            );


        assert.ok(
            result
        );

        assert.equal(
            result.url,
            candidate.inspection.url
        );
    }
);


test(
    "selectCanonicalSource rejects a candidate with incomplete district coverage",
    () => {

        const candidate =
            createCandidate();


        candidate.validation!.expectedDistrictCount =
            6;

        candidate.validation!.completeDistrictCoverage =
            false;


        const result =
            selectCanonicalSource(
                createGroup([
                    candidate
                ])
            );


        assert.equal(
            result,
            undefined
        );
    }
);


test(
    "selectCanonicalSource rejects an explicit municipality geography no-match",
    () => {

        const candidate =
            createCandidate(
                "no-match"
            );


        const result =
            selectCanonicalSource(
                createGroup([
                    candidate
                ])
            );


        assert.equal(
            result,
            undefined
        );
    }
);


// =============================================================================
// Municipal-source preference
// =============================================================================

test(
    "selectCanonicalSource prefers a native municipal GIS service over an ArcGIS Online representation",
    () => {

        const hosted =
            createPhoenixCandidate(
                "https://services.arcgis.com/cfKakmeHE95cgeEK/arcgis/rest/services/Council_Districts/FeatureServer/0",
                "Council Districts and Members"
            );


        const native =
            createPhoenixCandidate(
                PHOENIX_COUNCIL_DISTRICTS_URL,
                "Council Districts and Members"
            );


        const result =
            selectCanonicalSource(
                createGroup([
                    hosted,
                    native
                ])
            );


        assert.ok(
            result
        );

        assert.equal(
            result.url,
            native.inspection.url
        );
    }
);


test(
    "selectCanonicalSource prefers the primary boundary layer over an auxiliary hash layer",
    () => {

        const hash =
            createPhoenixCandidate(
                PHOENIX_COUNCIL_DISTRICTS_HASH_URL,
                "Council Districts and Members Hash"
            );


        const primary =
            createPhoenixCandidate(
                PHOENIX_COUNCIL_DISTRICTS_URL,
                "Council Districts and Members"
            );


        const result =
            selectCanonicalSource(
                createGroup([
                    hash,
                    primary
                ])
            );


        assert.ok(
            result
        );

        assert.equal(
            result.url,
            primary.inspection.url
        );

        assert.equal(
            result.title,
            "Council Districts and Members"
        );
    }
);


// =============================================================================
// Phoenix municipality-wide canonical selection
// =============================================================================

test(
    "Phoenix prefers the boundary-native Council Districts source over the derived Eviction Filings source",
    () => {

        const councilDistricts =
            createPhoenixCandidate(
                PHOENIX_COUNCIL_DISTRICTS_URL,
                "Council Districts and Members",
                {
                    officialMunicipalSource:
                        true,

                    sourceRole:
                        "authoritative"
                }
            );


        const evictionFilings =
            createPhoenixCandidate(
                PHOENIX_EVICTION_FILINGS_URL,
                "Eviction Filings by Council Districts",
                {
                    officialMunicipalSource:
                        true,

                    sourceRole:
                        "derived"
                }
            );


        const councilGroup =
            createGroup(
                [
                    councilDistricts
                ],
                "phoenix-council-districts"
            );


        const evictionGroup =
            createGroup(
                [
                    evictionFilings
                ],
                "phoenix-eviction-filings"
            );


        const result =
            selectMunicipalityCanonicalSource(
                [
                    councilGroup,
                    evictionGroup
                ]
            );


        assert.ok(
            result
        );


        assert.equal(
            result.url,
            PHOENIX_COUNCIL_DISTRICTS_URL
        );


        assert.equal(
            result.title,
            "Council Districts and Members"
        );


        assert.equal(
            result.city,
            "Phoenix"
        );


        assert.equal(
            result.state,
            "AZ"
        );


        assert.equal(
            result.placeFips,
            "0455000"
        );


        assert.equal(
            result.districtType,
            "council-district"
        );


        assert.equal(
            result.districtField,
            "DISTRICT"
        );


        assert.equal(
            result.officialMunicipalSource,
            true
        );
    }
);


// =============================================================================
// Phoenix canonical selection must not depend on discovery order
// =============================================================================

test(
    "Phoenix canonical selection is independent of discovery order",
    () => {

        const councilDistricts =
            createPhoenixCandidate(
                PHOENIX_COUNCIL_DISTRICTS_URL,
                "Council Districts and Members",
                {
                    sourceRole:
                        "authoritative"
                }
            );


        const evictionFilings =
            createPhoenixCandidate(
                PHOENIX_EVICTION_FILINGS_URL,
                "Eviction Filings by Council Districts",
                {
                    sourceRole:
                        "derived"
                }
            );


        const firstOrder =
            selectMunicipalityCanonicalSource([
                createGroup(
                    [
                        councilDistricts
                    ],
                    "phoenix-council"
                ),

                createGroup(
                    [
                        evictionFilings
                    ],
                    "phoenix-eviction"
                )
            ]);


        const secondOrder =
            selectMunicipalityCanonicalSource([
                createGroup(
                    [
                        evictionFilings
                    ],
                    "phoenix-eviction"
                ),

                createGroup(
                    [
                        councilDistricts
                    ],
                    "phoenix-council"
                )
            ]);


        assert.ok(
            firstOrder
        );

        assert.ok(
            secondOrder
        );


        assert.equal(
            firstOrder.url,
            PHOENIX_COUNCIL_DISTRICTS_URL
        );


        assert.equal(
            secondOrder.url,
            PHOENIX_COUNCIL_DISTRICTS_URL
        );
    }
);


// =============================================================================
// Tucson canonical source
// =============================================================================

test(
    "selectCanonicalSource selects TucsonWards2022 when it is the only eligible candidate",
    () => {

        const candidate =
            createTucsonWardsCandidate();


        const result =
            selectCanonicalSource(
                createGroup([
                    candidate
                ])
            );


        assert.ok(
            result
        );

        assert.equal(
            result.url,
            TUCSON_WARDS_2022_URL
        );

        assert.equal(
            result.title,
            "TucsonWards2022"
        );

        assert.equal(
            result.city,
            "Tucson"
        );

        assert.equal(
            result.state,
            "AZ"
        );

        assert.equal(
            result.placeFips,
            "0477000"
        );

        assert.equal(
            result.districtType,
            "ward"
        );

        assert.equal(
            result.districtField,
            "WARD"
        );
    }
);


test(
    "selectCanonicalSource prefers an official Tucson ward source over an equivalent non-official source",
    () => {

        const nonOfficial =
            createTucsonWardsCandidate(
                "Tucson Ward Boundaries Alternative",
                "https://example.com/tucson/FeatureServer/0",
                98
            );


        nonOfficial.classification
            .officialMunicipalSource =
            false;


        const official =
            createTucsonWardsCandidate();


        const result =
            selectCanonicalSource(
                createGroup([
                    nonOfficial,
                    official
                ])
            );


        assert.ok(
            result
        );

        assert.equal(
            result.url,
            TUCSON_WARDS_2022_URL
        );

        assert.equal(
            result.officialMunicipalSource,
            true
        );
    }
);


test(
    "selectCanonicalSource prefers a higher-confidence Tucson candidate when canonical preferences are otherwise equivalent",
    () => {

        const lowerConfidence =
            createTucsonWardsCandidate(
                "Tucson Ward Boundaries Alternative",
                "https://example.com/tucson/FeatureServer/0",
                75
            );


        const higherConfidence =
            createTucsonWardsCandidate(
                "TucsonWards2022",
                TUCSON_WARDS_2022_URL,
                98
            );


        const result =
            selectCanonicalSource(
                createGroup([
                    lowerConfidence,
                    higherConfidence
                ])
            );


        assert.ok(
            result
        );

        assert.equal(
            result.url,
            TUCSON_WARDS_2022_URL
        );
    }
);


// =============================================================================
// Alternatives
// =============================================================================

test(
    "selectCanonicalSource includes losing eligible candidates as alternatives",
    () => {

        const first =
            createCandidate(
                undefined,
                "https://example.com/first/FeatureServer/0",
                "Tucson Ward Boundaries 2026"
            );


        const second =
            createCandidate(
                undefined,
                "https://example.com/second/FeatureServer/0",
                "Tucson Ward Boundaries"
            );


        const result =
            selectCanonicalSource(
                createGroup([
                    first,
                    second
                ])
            );


        assert.ok(
            result
        );

        assert.equal(
            result.alternatives.length,
            1
        );

        assert.ok(
            result.alternatives.some(
                alternative =>
                    alternative.url ===
                    second.inspection.url
            )
        );
    }
);


// =============================================================================
// Deterministic selection
// =============================================================================

test(
    "selectCanonicalSource is deterministic when candidates have equivalent ranking",
    () => {

        const first =
            createCandidate(
                undefined,
                "https://example.com/a/FeatureServer/0",
                "Tucson Ward Boundaries"
            );


        const second =
            createCandidate(
                undefined,
                "https://example.com/b/FeatureServer/0",
                "Tucson Ward Boundaries"
            );


        const resultA =
            selectCanonicalSource(
                createGroup([
                    first,
                    second
                ])
            );


        const resultB =
            selectCanonicalSource(
                createGroup([
                    second,
                    first
                ])
            );


        assert.ok(
            resultA
        );

        assert.ok(
            resultB
        );


        assert.equal(
            resultA.url,
            resultB.url
        );
    }
);