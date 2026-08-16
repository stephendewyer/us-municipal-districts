import fs from "node:fs/promises";
import { PATHS } from "./config.js";
async function readPlaces() {
    const contents = await fs.readFile(PATHS.places, "utf8");
    return JSON.parse(contents);
}
function scoreResult(result, city) {
    const text = [
        result.title,
        result.snippet,
        result.description,
        result.url
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
    let score = 0;
    if (text.includes(city.toLowerCase())) {
        score += 25;
    }
    if (text.includes("council")) {
        score += 25;
    }
    if (text.includes("ward")) {
        score += 20;
    }
    if (text.includes("district")) {
        score += 15;
    }
    if (text.includes("municipal")) {
        score += 10;
    }
    if (text.includes("boundary")) {
        score += 10;
    }
    if (text.includes("featurelayer")) {
        score += 5;
    }
    return score;
}
async function searchArcGIS(query) {
    const url = new URL("https://www.arcgis.com/sharing/rest/search");
    url.searchParams.set("q", query);
    url.searchParams.set("num", "100");
    url.searchParams.set("f", "json");
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`ArcGIS search failed: ${response.status}`);
    }
    return response.json();
}
export async function discover() {
    const places = await readPlaces();
    const discoveries = [];
    for (const place of places) {
        const queries = [
            `"${place.city}" "city council"`,
            `"${place.city}" ward`,
            `"${place.city}" "council district"`,
            `"${place.city}" "council boundaries"`
        ];
        const seen = new Set();
        for (const query of queries) {
            console.log(`Searching: ${query}`);
            const response = await searchArcGIS(query);
            for (const result of response.results ?? []) {
                if (!result.url) {
                    continue;
                }
                if (seen.has(result.url)) {
                    continue;
                }
                seen.add(result.url);
                const score = scoreResult(result, place.city);
                if (score < 40) {
                    continue;
                }
                discoveries.push({
                    placeFips: place.placeFips,
                    city: place.city,
                    state: place.state,
                    candidateUrl: result.url,
                    title: result.title ?? "",
                    score,
                    requiresReview: true
                });
            }
        }
    }
    await fs.writeFile(PATHS.discoveries, JSON.stringify(discoveries, null, 2) + "\n");
    console.log(`Found ${discoveries.length} candidates.`);
}
