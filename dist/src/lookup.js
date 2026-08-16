import fs from "node:fs/promises";
import path from "node:path";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";
import { loadRegistry } from "./registry.js";
const packageRoot = path.resolve(new URL("..", import.meta.url).pathname);
async function loadGeoJSON(filename) {
    const contents = await fs.readFile(path.join(packageRoot, filename), "utf8");
    return JSON.parse(contents);
}
async function loadMunicipality(placeFips) {
    const registry = await loadRegistry();
    const municipality = registry.municipalities[placeFips];
    if (!municipality) {
        return null;
    }
    const districts = await loadGeoJSON(municipality.data);
    return {
        municipality,
        districts
    };
}
export async function getMunicipalDistricts(placeFips) {
    const result = await loadMunicipality(placeFips);
    if (!result) {
        return [];
    }
    const { municipality, districts } = result;
    return districts.features.map((feature, index) => {
        const properties = feature.properties ?? {};
        const district = String(properties.district ?? "");
        const name = String(properties.name ??
            district);
        return {
            id: String(properties.id ??
                `${placeFips}-${district}-${index}`),
            district,
            name,
            city: municipality.city,
            state: municipality.state,
            placeFips,
            districtType: municipality.districtType,
            geometry: feature.geometry
        };
    });
}
export async function getMunicipalDistrict(options) {
    const districts = await getMunicipalDistricts(options.placeFips);
    if (!districts.length) {
        return null;
    }
    const location = point([
        options.longitude,
        options.latitude
    ]);
    for (const district of districts) {
        const feature = {
            type: "Feature",
            properties: {
                id: district.id,
                district: district.district,
                name: district.name
            },
            geometry: district.geometry
        };
        if (booleanPointInPolygon(location, feature)) {
            return district;
        }
    }
    return null;
}
