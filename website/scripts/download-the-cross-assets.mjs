import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const destination = resolve(import.meta.dirname, "../public/the-cross");
const files = {
  "close.svg": "https://cdn.prod.website-files.com/62a7ea4fca03586c6e0870eb/62a7ea4fca03581ef7087168_close.svg",
  "arrow.svg": "https://cdn.prod.website-files.com/62a7ea4fca03586c6e0870eb/62a7ea4fca03584eb3087167_arrow.svg",
  "Migra-Regular.ttf": "https://assets.website-files.com/62a7ea4fca03586c6e0870eb/62a7ea4fca0358b7aa087161_Migra-Regular.ttf",
  "UniversLTPro55Roman.ttf": "https://assets.website-files.com/62a7ea4fca03586c6e0870eb/62a7ea4fca03586dc2087166_UniversLTPro55Roman.ttf",
  "static-noise.gif": "https://assets.website-files.com/62a7ea4fca03586c6e0870eb/62a7ea4fca03582d35087154_static-noise.gif",
};

await mkdir(destination, { recursive: true });
await Promise.all(
  Object.entries(files).map(async ([name, url]) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${response.status} ${url}`);
    await writeFile(resolve(destination, name), Buffer.from(await response.arrayBuffer()));
  }),
);

console.log(`Downloaded ${Object.keys(files).length} The Cross assets to ${dirname(destination)}/the-cross`);
