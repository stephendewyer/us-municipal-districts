import type { Place } from "./types.js";

const CENSUS_API =
    "https://api.census.gov/data/2024/dec/pl";

interface CensusResponse {
    [index: number]: string[];
}

const STATE_FIPS_TO_ABBR: Record<string, string> = {
    "01": "AL",
    "02": "AK",
    "04": "AZ",
    "05": "AR",
    "06": "CA",
    "08": "CO",
    "09": "CT",
    "10": "DE",
    "11": "DC",
    "12": "FL",
    "13": "GA",
    "15": "HI",
    "16": "ID",
    "17": "IL",
    "18": "IN",
    "19": "IA",
    "20": "KS",
    "21": "KY",
    "22": "LA",
    "23": "ME",
    "24": "MD",
    "25": "MA",
    "26": "MI",
    "27": "MN",
    "28": "MS",
    "29": "MO",
    "30": "MT",
    "31": "NE",
    "32": "NV",
    "33": "NH",
    "34": "NJ",
    "35": "NM",
    "36": "NY",
    "37": "NC",
    "38": "ND",
    "39": "OH",
    "40": "OK",
    "41": "OR",
    "42": "PA",
    "44": "RI",
    "45": "SC",
    "46": "SD",
    "47": "TN",
    "48": "TX",
    "49": "UT",
    "50": "VT",
    "51": "VA",
    "53": "WA",
    "54": "WV",
    "55": "WI",
    "56": "WY"
};

const STATE_FIPS = Object.keys(STATE_FIPS_TO_ABBR);


/**
 * Fetch incorporated places / Census places for one state.
 */
export async function fetchPlacesForState(
    stateFips: string
): Promise<Place[]> {

    const stateAbbreviation =
        STATE_FIPS_TO_ABBR[stateFips];

    if (!stateAbbreviation) {
        throw new Error(
            `Unknown state FIPS code: ${stateFips}`
        );
    }

    const url =
        `${CENSUS_API}` +
        `?get=NAME,PLACE,STATE` +
        `&for=place:*` +
        `&in=state:${stateFips}`;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(
            `Census API request failed for ${stateAbbreviation}: ` +
            `${response.status} ${response.statusText}`
        );
    }

    const data =
        await response.json() as CensusResponse;

    if (!Array.isArray(data) || data.length < 2) {
        return [];
    }

    const headers = data[0];

    const nameIndex =
        headers.indexOf("NAME");

    const placeIndex =
        headers.indexOf("PLACE");

    const stateIndex =
        headers.indexOf("STATE");

    if (
        nameIndex === -1 ||
        placeIndex === -1 ||
        stateIndex === -1
    ) {
        throw new Error(
            "Census API response does not contain " +
            "NAME, PLACE, and STATE columns."
        );
    }

    return data
        .slice(1)
        .map((row): Place => {

            const placeCode =
                row[placeIndex];

            const censusStateFips =
                row[stateIndex];

            const cityName =
                cleanPlaceName(row[nameIndex]);

            return {
                placeFips:
                    `${censusStateFips}${placeCode}`,

                city:
                    cityName,

                state:
                    STATE_FIPS_TO_ABBR[censusStateFips]
            };
        });
}


/**
 * Fetch places for every U.S. state and D.C.
 */
export async function fetchPlaces(): Promise<Place[]> {

    const places: Place[] = [];

    for (const stateFips of STATE_FIPS) {

        const stateAbbreviation =
            STATE_FIPS_TO_ABBR[stateFips];

        console.log(
            `Fetching Census places for ${stateAbbreviation}...`
        );

        const statePlaces =
            await fetchPlacesForState(stateFips);

        places.push(...statePlaces);
    }

    return places;
}


/**
 * Remove Census geographic-type suffixes from place names.
 *
 * Examples:
 *
 * "Tucson city, Arizona"
 * → "Tucson"
 *
 * "Phoenix city, Arizona"
 * → "Phoenix"
 *
 * "Flagstaff city, Arizona"
 * → "Flagstaff"
 */
function cleanPlaceName(
    name: string
): string {

    return name
        .replace(
            /\s+(city|town|village|borough|municipality|CDP),.*$/i,
            ""
        )
        .trim();
}