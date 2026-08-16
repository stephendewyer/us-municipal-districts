import fs from "node:fs/promises";
import path from "node:path";
const packageRoot = path.resolve(new URL("..", import.meta.url).pathname);
export async function loadRegistry() {
    const filename = path.join(packageRoot, "registry.json");
    const contents = await fs.readFile(filename, "utf8");
    return JSON.parse(contents);
}
