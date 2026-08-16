import { build } from "./build.js";
import { discover } from "./discover.js";
import { fetchPlaces } from "./censusPlaces.js";
import { validate } from "./validate.js";

function printHelp(): void {
    console.log(`
@stephendewyer/us-municipal-districts

Usage:

  npm run places
      Download Census incorporated places.

  npm run discover
      Discover municipal ward/council district GIS sources.

  npm run generate
      Download, normalize, and generate municipal district data.

  npm run validate
      Validate generated registry and GeoJSON data.

  npm run check
      Build, typecheck, and run tests.
`);
}

async function main(): Promise<void> {

    const command =
        process.argv[2];

    switch (command) {

        case "places":
            await fetchPlaces();
            break;

        case "discover":
            await discover();
            break;

        case "build":
        case "generate":
            await build();
            break;

        case "validate":
            await validate();
            break;

        case "help":
        case "--help":
        case "-h":
        case undefined:
            printHelp();

            if (command === undefined) {
                process.exitCode = 1;
            }

            break;

        default:
            console.error(
                `Unknown command: ${command}`
            );

            printHelp();

            process.exitCode = 1;
    }
}

main().catch(
    (error: unknown) => {

        console.error(
            "\nGenerator failed."
        );

        if (
            error instanceof Error
        ) {

            console.error(
                error.message
            );

            if (error.stack) {
                console.error(
                    error.stack
                );
            }

        } else {

            console.error(
                error
            );
        }

        process.exitCode = 1;
    }
);