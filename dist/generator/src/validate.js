export function validateGeoJSON(collection) {
    if (collection.type !==
        "FeatureCollection") {
        throw new Error("Dataset is not a FeatureCollection.");
    }
    if (collection.features.length === 0) {
        throw new Error("Dataset contains no features.");
    }
    const districts = new Set();
    for (const [index, feature] of collection.features.entries()) {
        if (feature.geometry.type !==
            "Polygon" &&
            feature.geometry.type !==
                "MultiPolygon") {
            throw new Error(`Feature ${index} has invalid geometry.`);
        }
        const district = String(feature.properties?.district ?? "");
        if (!district) {
            throw new Error(`Feature ${index} has no district.`);
        }
        if (districts.has(district)) {
            throw new Error(`Duplicate district: ${district}`);
        }
        districts.add(district);
    }
}
