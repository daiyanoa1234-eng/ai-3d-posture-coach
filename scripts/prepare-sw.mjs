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
for (const p of files) hash.update(await readFile(p));
const version = hash.digest("hex").slice(0, 16);
// Cache the currently selected model + WASM variant on demand, avoiding both model downloads on every device.
const shell = files
  .filter((p) => !p.includes("/models/") && !p.includes("/mediapipe/"))
  .map((p) => `./${p.slice(5)}`);
await writeFile(
  "dist/sw.js",
  `const CACHE='posture-${version}';
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(${JSON.stringify(shell)}))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('posture-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;e.respondWith(caches.open(CACHE).then(async c=>{const old=await c.match(e.request);if(old)return old;try{const r=await fetch(e.request);if(r.ok)await c.put(e.request,r.clone());return r;}catch(error){if(e.request.mode==='navigate'){const shell=await c.match(new URL('./index.html',self.registration.scope));if(shell)return shell;}throw error;}}));});`,
);
console.log("Service worker generated:", version);
