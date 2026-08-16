import fs from "node:fs/promises";
import path from "node:path";
import { downloadJSON } from "./download.js";
import { normalizeGeoJSON } from "./normalize.js";
import { validateGeoJSON } from "./validate.js";
const SOURCES_FILE = "generator/data/sources.json";
const REGISTRY_FILE = "registry.json";
const DATA_DIRECTORY = "data";
async function readSources() {
    const contents = await fs.readFile(SOURCES_FILE, "utf8");
    return JSON.parse(contents);
}
export async function build() {
    const sources = await readSources();
    const registry = {
        version: new Date()
            .toISOString()
            .slice(0, 10),
        generatedAt: new Date().toISOString(),
        municipalities: {}
    };
    for (const source of sources) {
        console.log(`Building ${source.city}, ${source.state}`);
        const raw = await downloadJSON(source.url);
        const normalized = normalizeGeoJSON(raw, {
            city: source.city,
            state: source.state,
            placeFips: source.placeFips
        });
        validateGeoJSON(normalized);
        const relativePath = path.join(DATA_DIRECTORY, source.state, `${source.placeFips}.geojson`);
        const absolutePath = path.resolve(relativePath);
        await fs.mkdir(path.dirname(absolutePath), {
            recursive: true
        });
        await fs.writeFile(absolutePath, JSON.stringify(normalized));
        registry.municipalities[source.placeFips] = {
            placeFips: source.placeFips,
            city: source.city,
            state: source.state,
            districtType: source.districtType,
            data: relativePath.replaceAll("\\", "/"),
            source: {
                name: source.name,
                url: source.url,
                accessed: new Date()
                    .toISOString(),
                license: source.license,
                attribution: source.attribution
            }
        };
    }
    await fs.writeFile(REGISTRY_FILE, JSON.stringify(registry, null, 2) + "\n");
    console.log(`Built ${sources.length} municipalities.`);
}
