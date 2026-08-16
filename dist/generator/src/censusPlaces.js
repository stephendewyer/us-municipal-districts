import fs from "node:fs/promises";
import path from "node:path";
import { CENSUS_YEAR, PATHS, STATE_FIPS } from "./config.js";
async function downloadStatePlaces(stateFips) {
    const url = `https://www2.census.gov/geo/docs/maps-data/data/gazetteer/` +
        `${CENSUS_YEAR}_Gazetteer/` +
        `${CENSUS_YEAR}_gaz_place_${stateFips}.txt`;
    console.log(`Downloading ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to download ${stateFips}: ` +
            `${response.status} ${response.statusText}`);
    }
    const text = await response.text();
    const lines = text
        .split(/\r?\n/)
        .filter(line => line.trim());
    if (lines.length < 2) {
        return [];
    }
    const header = lines[0]
        .split("|")
        .map(value => value.trim());
    const geoidIndex = header.findIndex(value => value.toUpperCase() ===
        "GEOID");
    const nameIndex = header.findIndex(value => value.toUpperCase() ===
        "NAME");
    if (geoidIndex === -1 ||
        nameIndex === -1) {
        throw new Error(`Unexpected Census Gazetteer format for ${stateFips}`);
    }
    const places = [];
    for (const line of lines.slice(1)) {
        const values = line.split("|");
        const geoid = values[geoidIndex]?.trim();
        const name = values[nameIndex]?.trim();
        if (!geoid ||
            !name) {
            continue;
        }
        places.push({
            state: stateFips,
            placeFips: geoid,
            city: name
        });
    }
    return places;
}
export async function generateCensusPlaces() {
    const allPlaces = [];
    for (const stateFips of STATE_FIPS) {
        try {
            const places = await downloadStatePlaces(stateFips);
            console.log(`${stateFips}: ${places.length} places`);
            allPlaces.push(...places);
        }
        catch (error) {
            console.error(`Failed to download ${stateFips}`);
            console.error(error);
        }
    }
    allPlaces.sort((a, b) => a.city.localeCompare(b.city));
    const output = path.resolve(PATHS.places);
    await fs.mkdir(path.dirname(output), {
        recursive: true
    });
    await fs.writeFile(output, JSON.stringify(allPlaces, null, 2) + "\n");
    console.log(`Generated ${allPlaces.length} Census places.`);
    console.log(`Output: ${output}`);
}
