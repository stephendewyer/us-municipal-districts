import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeGeoJSON
} from "../../generator/src/normalize.js";

const source = {
  type: "FeatureCollection" as const,

  features: [
    {
      type: "Feature" as const,

      properties: {
        WARD: "1",
        NAME: "Ward 1"
      },

      geometry: {
        type: "Polygon" as const,

        coordinates: [[
          [-111, 32],
          [-110, 32],
          [-110, 33],
          [-111, 33],
          [-111, 32]
        ]]
      }
    }
  ]
};

test(
  "normalizes WARD field",
  () => {

    const result =
      normalizeGeoJSON(
        source,
        {
          city: "Test City",
          state: "AZ",
          placeFips: "9999999",
          boundaryType: "ward"
        }
      );

    assert.equal(
      result.features.length,
      1
    );

    assert.equal(
      result.features[0]
        .properties?.district,
      "1"
    );

    assert.equal(
      result.features[0]
        .properties?.name,
      "Ward 1"
    );
  }
);