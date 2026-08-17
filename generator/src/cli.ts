import { generateCensusPlaces } from "./generateCensusPlaces.js";
import { discoverArcGIS } from "./discover.js";
import { buildRegistry } from "./registry.js";
import { validateRegistry } from "./validate.js";

type Command =
    | "places"
    | "discover"
    | "build"
    | "validate";

interface CliOptions {
    city?: string;
    state?: string;
    placeFips?: string;
    review?: boolean;
    verbose?: boolean;
}

const command =
    process.argv[2] as Command | undefined;


async function main(): Promise<void> {

    const options =
        parseOptions(
            process.argv.slice(3)
        );

    switch (command) {

        case "places":

            await generateCensusPlaces();

            break;


        case "discover":

            await discoverArcGIS(
                options
            );

            break;


        case "build":

            buildRegistry();

            break;


        case "validate":

            await validateRegistry();

            break;


        default:

            printUsage();

            process.exitCode = 1;
    }
}


// =============================================================================
// CLI options
// =============================================================================

function parseOptions(
    args: string[]
): CliOptions {

    const options: CliOptions = {};

    for (
        let i = 0;
        i < args.length;
        i++
    ) {

        const argument =
            args[i];

        switch (argument) {

            case "--city":

                options.city =
                    args[++i];

                break;


            case "--state":

                options.state =
                    args[++i]
                        ?.toUpperCase();

                break;


            case "--placeFips":

                options.placeFips =
                    args[++i];

                break;


            case "--review":

                options.review =
                    true;

                break;


            case "--verbose":

                options.verbose =
                    true;

                break;


            default:

                throw new Error(
                    `Unknown option: ${argument}`
                );
        }
    }

    return options;
}


// =============================================================================
// Usage
// =============================================================================

function printUsage(): void {

    console.log(`
U.S. Municipal Districts Generator

Usage:

  npm run places

  npm run discover

  npm run discover -- --city Tucson --state AZ

  npm run discover -- --state AZ

  npm run discover -- --placeFips 0477000

  npm run build

  npm run validate


Commands:

  places
      Generate the Census place list.

  discover
      Discover and inspect municipal ArcGIS candidates.

  build
      Select canonical sources and generate registry entries.

  validate
      Validate the generated registry.


Discover options:

  --city <city>
      Process only municipalities matching this city name.

  --state <state>
      Process only municipalities in this state.

  --placeFips <fips>
      Process only the specified Census place.

  --review
      Require manual review before registry generation.

  --verbose
      Print additional diagnostic information.
`);
}


main().catch(
    (error) => {

        console.error(
            "\nGenerator failed:\n"
        );

        console.error(
            error
        );

        process.exitCode = 1;
    }
);