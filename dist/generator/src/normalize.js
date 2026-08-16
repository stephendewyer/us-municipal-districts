import { DISTRICT_FIELDS, NAME_FIELDS } from "./config.js";
function findField(properties, candidates) {
    const keys = Object.keys(properties);
    const lookup = new Map(keys.map(key => [
        key.toLowerCase(),
        key
    ]));
    for (const candidate of candidates) {
        const actual = lookup.get(candidate.toLowerCase());
        if (actual) {
            return actual;
        }
    }
    return undefined;
}
export function normalizeGeoJSON(input, metadata) {
    const features = input.features.map((feature, index) => {
        if (!feature.geometry ||
            (feature.geometry.type !==
                "Polygon" &&
                feature.geometry.type !==
                    "MultiPolygon")) {
            throw new Error(`Feature ${index} does not contain polygon geometry.`);
        }
        const properties = (feature.properties ?? {});
        const districtField = findField(properties, DISTRICT_FIELDS);
        if (!districtField) {
            throw new Error(`No district field found for ${metadata.city}. ` +
                `Fields: ${Object.keys(properties).join(", ")}`);
        }
        const nameField = findField(properties, NAME_FIELDS);
        const district = String(properties[districtField] ?? "").trim();
        const name = String(properties[nameField ?? districtField] ?? district).trim();
        if (!district) {
            throw new Error(`Feature ${index} has an empty district.`);
        }
        return {
            type: "Feature",
            properties: {
                id: `${metadata.placeFips}-${district}`,
                district,
                name,
                city: metadata.city,
                state: metadata.state,
                placeFips: metadata.placeFips
            },
            geometry: feature.geometry
        };
    });
    return {
        type: "FeatureCollection",
        features
    };
}
