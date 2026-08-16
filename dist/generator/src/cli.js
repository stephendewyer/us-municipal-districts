import { discover } from "./discover.js";
import { build } from "./build.js";
const command = process.argv[2];
switch (command) {
    case "discover":
        await discover();
        break;
    case "build":
        await build();
        break;
    default:
        console.log(`
US Municipal Districts

Commands:

  npm run discover
      Discover candidate datasets

  npm run generate
      Build normalized GeoJSON and registry

  npm run validate
      Validate generated datasets
`);
}
