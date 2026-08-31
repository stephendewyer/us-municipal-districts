import test from "node:test";
import assert from "node:assert/strict";

import { scoreCandidate } from "../../generator/src/score.js";

test("scores a strong municipal ward boundary highly", () => {
    const result = scoreCandidate({
        placeFips: "0477000",
        city: "Tucson",
        state: "AZ",

        title: "City of Tucson Ward Boundaries",

        url:
            "https://gis.tucsonaz.gov/arcgis/rest/services/Wards/FeatureServer",

        serviceType: "FeatureServer",

        geometryType: "esriGeometryPolygon",

        fields: [
            "WARD",
            "WARD_NAME"
        ],

        hasDistrictField: true,

        hasNameField: true,

        isFeatureServer: true,

        isPolygonLayer: true,

        isLikelyBoundaryLayer: true
    });

    assert.ok(
        result.score >= 90,
        `Expected score >= 90, got ${result.score}`
    );
});


test("penalizes a housing dataset containing ward information", () => {
    const result = scoreCandidate({
        placeFips: "0477000",
        city: "Tucson",
        state: "AZ",

        title: "Section 8 Housing per Ward",

        url:
            "https://example.com/FeatureServer",

        serviceType: "FeatureServer",

        geometryType: "esriGeometryPolygon",

        fields: [
            "WARD",
            "HOUSING_UNITS"
        ],

        hasDistrictField: false,

        hasNameField: true,

        isFeatureServer: true,

        isPolygonLayer: true
    });

    assert.ok(
        result.score < 75,
        `Expected score < 75, got ${result.score}`
    );
});


test("penalizes census block group datasets", () => {
    const result = scoreCandidate({
        placeFips: "0477000",
        city: "Tucson",
        state: "AZ",

        title:
            "Tucson Equity Priority Index: Ward 3 Census Block Groups",

        url:
            "https://example.com/FeatureServer",

        serviceType: "FeatureServer",

        isFeatureServer: true
    });

    assert.ok(
        result.score < 50,
        `Expected score < 50, got ${result.score}`
    );
});


test("scores council district datasets highly", () => {
    const result = scoreCandidate({
        placeFips: "0455000",
        city: "Phoenix",
        state: "AZ",

        title:
            "Phoenix City Council Districts",

        url:
            "https://maps.phoenix.gov/pub/rest/services/Public/Council_Districts/MapServer/0",

        serviceType: "MapServer",

        geometryType: "esriGeometryPolygon",

        fields: [
            "DISTRICT"
        ],

        hasDistrictField: true,

        hasNameField: true,

        isMapServer: true,

        isPolygonLayer: true,

        isLikelyBoundaryLayer: true
    });

    assert.ok(
        result.score >= 90,
        `Expected score >= 90, got ${result.score}`
    );
});