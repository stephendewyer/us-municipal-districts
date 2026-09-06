import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
    getStateFipsFromPlaceFips,
    loadCensusPlaceGeometry,
    loadCensusPlaceGeometryState
} from "../../generator/src/censusPlaceGeometry.js";

test(
    "getStateFipsFromPlaceFips extracts state FIPS",
    () => {

        assert.equal(
            getStateFipsFromPlaceFips(
                "0477000"
            ),
            "04"
        );

        assert.equal(
            getStateFipsFromPlaceFips(
                "0600000"
            ),
            "06"
        );
    }
);

test(
    "loadCensusPlaceGeometryState loads a state file",
    () => {

        const directory =
            fs.mkdtempSync(
                path.join(
                    os.tmpdir(),
                    "census-geometry-test-"
                )
            );

        try {

            const filePath =
                path.join(
                    directory,
                    "04.json"
                );

            fs.writeFileSync(
                filePath,
                JSON.stringify({
                    state: "AZ",
                    stateFips: "04",
                    vintage: "2025",
                    generatedAt:
                        "2026-01-01T00:00:00.000Z",
                    source:
                        "https://example.com/04.zip",
                    geometries: {
                        "0477000": {
                            type: "Polygon",
                            coordinates: [
                                [
                                    [
                                        -110,
                                        32
                                    ],
                                    [
                                        -110,
                                        33
                                    ],
                                    [
                                        -111,
                                        33
                                    ],
                                    [
                                        -111,
                                        32
                                    ],
                                    [
                                        -110,
                                        32
                                    ]
                                ]
                            ]
                        }
                    }
                }),
                "utf8"
            );

            const result =
                loadCensusPlaceGeometryState(
                    "04",
                    directory
                );

            assert.equal(
                result.state,
                "AZ"
            );

            assert.equal(
                result.stateFips,
                "04"
            );

            assert.ok(
                result.geometries[
                    "0477000"
                ]
            );

        } finally {

            fs.rmSync(
                directory,
                {
                    recursive: true,
                    force: true
                }
            );
        }
    }
);

test(
    "loadCensusPlaceGeometry loads a place from the correct state file",
    () => {

        const directory =
            fs.mkdtempSync(
                path.join(
                    os.tmpdir(),
                    "census-geometry-test-"
                )
            );

        try {

            fs.writeFileSync(
                path.join(
                    directory,
                    "04.json"
                ),
                JSON.stringify({
                    state: "AZ",
                    stateFips: "04",
                    vintage: "2025",
                    generatedAt:
                        "2026-01-01T00:00:00.000Z",
                    source:
                        "https://example.com/04.zip",
                    geometries: {
                        "0477000": {
                            type: "MultiPolygon",
                            coordinates: []
                        }
                    }
                }),
                "utf8"
            );

            const geometry =
                loadCensusPlaceGeometry(
                    "0477000",
                    directory
                );

            assert.equal(
                geometry.type,
                "MultiPolygon"
            );

        } finally {

            fs.rmSync(
                directory,
                {
                    recursive: true,
                    force: true
                }
            );
        }
    }
);

test(
    "missing state geometry file throws",
    () => {

        const directory =
            fs.mkdtempSync(
                path.join(
                    os.tmpdir(),
                    "census-geometry-test-"
                )
            );

        try {

            assert.throws(
                () =>
                    loadCensusPlaceGeometryState(
                        "04",
                        directory
                    ),
                /geometry file not found/i
            );

        } finally {

            fs.rmSync(
                directory,
                {
                    recursive: true,
                    force: true
                }
            );
        }
    }
);

test(
    "missing place geometry throws",
    () => {

        const directory =
            fs.mkdtempSync(
                path.join(
                    os.tmpdir(),
                    "census-geometry-test-"
                )
            );

        try {

            fs.writeFileSync(
                path.join(
                    directory,
                    "04.json"
                ),
                JSON.stringify({
                    state: "AZ",
                    stateFips: "04",
                    vintage: "2025",
                    generatedAt:
                        "2026-01-01T00:00:00.000Z",
                    source:
                        "https://example.com/04.zip",
                    geometries: {}
                }),
                "utf8"
            );

            assert.throws(
                () =>
                    loadCensusPlaceGeometry(
                        "0477000",
                        directory
                    ),
                /No Census place geometry found/i
            );

        } finally {

            fs.rmSync(
                directory,
                {
                    recursive: true,
                    force: true
                }
            );
        }
    }
);