import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(
    import.meta.url
);

const __dirname = path.dirname(
    __filename
);

export const PROJECT_ROOT = path.resolve(
    __dirname,
    "../.."
);

export const GENERATOR_DATA_DIR = path.join(
    PROJECT_ROOT,
    "generator",
    "data"
);

export const PACKAGE_DATA_DIR = path.join(
    PROJECT_ROOT,
    "data"
);

export const PLACES_FILE = path.join(
    GENERATOR_DATA_DIR,
    "places.json"
);

export const DISCOVERIES_FILE = path.join(
    GENERATOR_DATA_DIR,
    "discoveries.json"
);

export const GENERATOR_REGISTRY_FILE = path.join(
    GENERATOR_DATA_DIR,
    "registry.json"
);

export const PACKAGE_REGISTRY_FILE = path.join(
    PACKAGE_DATA_DIR,
    "registry.json"
);