// =============================================================================
// Distinct district values
// =============================================================================

type FetchLike = typeof fetch;

function isObject(
    value: unknown
): value is Record<string, unknown> {
    return (
        typeof value === "object" &&
        value !== null
    );
}

function extractValuesFromFeatures(
    data: unknown,
    districtField: string
): string[] {

    if (
        !isObject(data)
    ) {
        return [];
    }

    if (
        "error" in data &&
        data.error
    ) {
        return [];
    }

    const features =
        Array.isArray(
            data.features
        )
            ? data.features
            : [];

    const values =
        new Set<string>();

    for (
        const feature of
        features
    ) {

        if (
            !isObject(feature)
        ) {
            continue;
        }

        const attributes =
            feature.attributes;

        if (
            !isObject(attributes)
        ) {
            continue;
        }

        const value =
            attributes[
                districtField
            ];

        if (
            value === undefined ||
            value === null
        ) {
            continue;
        }

        const normalized =
            String(value).trim();

        if (
            normalized
        ) {
            values.add(
                normalized
            );
        }
    }

    return [
        ...values
    ];
}

function sortDistinctValues(
    values: Iterable<string>
): string[] {

    const unique =
        [
            ...new Set(values)
        ];

    /*
     * District values are commonly numeric strings:
     *
     *     1, 2, 3, 4, 5
     *
     * Natural numeric ordering makes the resulting data deterministic
     * and easier to inspect.
     */
    const allNumeric =
        unique.length > 0 &&
        unique.every(
            value =>
                /^\d+(?:\.\d+)?$/.test(
                    value
                )
        );

    if (
        allNumeric
    ) {

        return unique.sort(
            (a, b) =>
                Number(a) -
                Number(b)
        );
    }

    return unique.sort(
        (a, b) =>
            a.localeCompare(
                b,
                undefined,
                {
                    numeric: true,
                    sensitivity: "base"
                }
            )
    );
}

function buildQueryUrl(
    layerUrl: string,
    districtField: string
): URL {

    const queryUrl =
        new URL(
            `${layerUrl}/query`
        );

    queryUrl.searchParams.set(
        "where",
        "1=1"
    );

    queryUrl.searchParams.set(
        "outFields",
        districtField
    );

    queryUrl.searchParams.set(
        "returnGeometry",
        "false"
    );

    queryUrl.searchParams.set(
        "f",
        "json"
    );

    return queryUrl;
}

async function fetchJson(
    url: URL,
    fetchImpl: FetchLike
): Promise<unknown | undefined> {

    try {

        const response =
            await fetchImpl(
                url.toString(),
                {
                    headers: {
                        Accept:
                            "application/json"
                    }
                }
            );

        if (
            !response.ok
        ) {
            return undefined;
        }

        return await response.json();

    } catch {

        return undefined;
    }
}

// =============================================================================
// Distinct district values
// =============================================================================

/**
 * Extract the distinct district values from an ArcGIS layer.
 *
 * The caller should provide expectedDistrictCount whenever an authoritative
 * municipal source tells us how many districts should exist.
 *
 * Example:
 *
 *     Phoenix Council Districts → expectedDistrictCount = 8
 *     Tucson Wards             → expectedDistrictCount = 6
 *
 * This allows the paginated fallback to stop as soon as all expected
 * district values have been discovered.
 */
export async function extractDistinctDistrictValues(
    layerUrl: string,
    districtField: string,
    fetchImpl: FetchLike = fetch,
    expectedDistrictCount?: number
): Promise<string[]> {

    if (
        !layerUrl.trim() ||
        !districtField.trim()
    ) {
        return [];
    }

    // =========================================================================
    // Fast path: ArcGIS returnDistinctValues
    // =========================================================================
    //
    // This is preferable to downloading every feature because the caller
    // only needs the district values.
    //
    // Important:
    //
    // This query can still be expensive on large ArcGIS services. It is
    // therefore intentionally performed only after classification,
    // municipality validation, and political-boundary validation in the
    // discovery pipeline.
    //
    try {

        const queryUrl =
            buildQueryUrl(
                layerUrl,
                districtField
            );

        queryUrl.searchParams.set(
            "returnDistinctValues",
            "true"
        );

        const data =
            await fetchJson(
                queryUrl,
                fetchImpl
            );

        if (
            data !== undefined
        ) {

            const values =
                extractValuesFromFeatures(
                    data,
                    districtField
                );

            if (
                values.length > 0
            ) {

                /*
                 * A successful distinct-value query is authoritative for
                 * the values it returned.
                 *
                 * Do not fall through to pagination merely because the
                 * expected count is larger. Some services can legitimately
                 * have fewer populated district values.
                 */
                return sortDistinctValues(
                    values
                );
            }

            /*
             * A valid response containing zero values is different from
             * a failed query. There is nothing useful to paginate in that
             * case.
             */
            if (
                isObject(data) &&
                !(
                    "error" in data &&
                    data.error
                )
            ) {
                const features =
                    Array.isArray(
                        data.features
                    )
                        ? data.features
                        : undefined;

                if (
                    features !== undefined
                ) {
                    return [];
                }
            }
        }

    } catch {
        /*
         * Fall through to the paginated fallback.
         */
    }

    // =========================================================================
    // Fallback: paginated feature queries
    // =========================================================================
    //
    // Some ArcGIS services reject returnDistinctValues or return an unusable
    // response. In that case, walk the layer in pages.
    //
    // When expectedDistrictCount is known, we can stop immediately once all
    // expected values have been discovered.
    // =========================================================================

    const values =
        new Set<string>();

    const pageSize =
        100;

    let resultOffset =
        0;

    try {

        while (true) {

            const queryUrl =
                buildQueryUrl(
                    layerUrl,
                    districtField
                );

            queryUrl.searchParams.set(
                "resultRecordCount",
                String(
                    pageSize
                )
            );

            queryUrl.searchParams.set(
                "resultOffset",
                String(
                    resultOffset
                )
            );

            const data =
                await fetchJson(
                    queryUrl,
                    fetchImpl
                );

            if (
                data === undefined
            ) {
                break;
            }

            if (
                isObject(data) &&
                "error" in data &&
                data.error
            ) {
                break;
            }

            const features =
                isObject(data) &&
                Array.isArray(
                    data.features
                )
                    ? data.features
                    : [];

            /*
             * Extract district values from this page.
             */
            for (
                const feature of
                features
            ) {

                if (
                    !isObject(feature)
                ) {
                    continue;
                }

                const attributes =
                    feature.attributes;

                if (
                    !isObject(attributes)
                ) {
                    continue;
                }

                const value =
                    attributes[
                        districtField
                    ];

                if (
                    value === undefined ||
                    value === null
                ) {
                    continue;
                }

                const normalized =
                    String(value).trim();

                if (
                    normalized
                ) {
                    values.add(
                        normalized
                    );
                }
            }

            /*
             * If the expected number of districts is known and we have
             * found them all, there is no reason to request another page.
             *
             * This is especially useful for authoritative municipal
             * boundary layers.
             */
            if (
                expectedDistrictCount !==
                    undefined &&
                expectedDistrictCount > 0 &&
                values.size >=
                    expectedDistrictCount
            ) {
                break;
            }

            /*
             * No features means there are no more pages.
             */
            if (
                features.length === 0
            ) {
                break;
            }

            /*
             * ArcGIS indicates that additional records are available
             * through exceededTransferLimit.
             */
            const exceededTransferLimit =
                isObject(data) &&
                data.exceededTransferLimit ===
                    true;

            if (
                !exceededTransferLimit
            ) {
                break;
            }

            /*
             * Advance to the next page.
             */
            resultOffset +=
                features.length;

            /*
             * Defensive protection against malformed services that
             * repeatedly return a partial page while claiming that more
             * records exist.
             */
            if (
                features.length <
                pageSize
            ) {
                break;
            }
        }

        return sortDistinctValues(
            values
        );

    } catch {

        return sortDistinctValues(
            values
        );
    }
}