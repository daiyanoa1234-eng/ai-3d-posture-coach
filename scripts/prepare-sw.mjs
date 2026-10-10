import { renderWorker } from "./sw-template.mjs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = `${dir}/${entry.name}`;
    out.push(...(entry.isDirectory() ? await walk(p) : [p]));
  }
  return out;
}
const files = (await walk("dist")).filter((p) => !p.endsWith("/sw.js"));
const hash = createHash("sha256");
hash.update(await readFile("scripts/sw-template.mjs"));
for (const p of files) hash.update(await readFile(p));
const version = hash.digest("hex").slice(0, 16);
// Cache the currently selected model + WASM variant on demand, avoiding both model downloads on every device.
const shell = files
  .filter((p) => !p.includes("/models/") && !p.includes("/mediapipe/"))
  .map((p) => `./${p.slice(5)}`);
await writeFile("dist/sw.js", renderWorker(version, shell));
console.log("Service worker generated:", version);
