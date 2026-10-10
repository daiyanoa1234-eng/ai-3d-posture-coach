import { cp, mkdir, access, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
await mkdir("public/mediapipe/wasm", { recursive: true });
await cp("node_modules/@mediapipe/tasks-vision/wasm", "public/mediapipe/wasm", {
  recursive: true,
});
await mkdir("public/models", { recursive: true });
const manifest = {};
const expectedHash = {
  lite: "59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a",
  full: "5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1",
};
for (const model of ["lite", "full"]) {
  const path = `public/models/pose_landmarker_${model}.task`;
  try {
    await access(path);
  } catch {
    const url = `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_${model}/float16/1/pose_landmarker_${model}.task`;
    const response = await fetch(url);
    if (!response.ok) throw Error(`Model download: ${response.status}`);
    const data = Buffer.from(await response.arrayBuffer());
    if (data.length < 1000000) throw Error("Unexpected model size");
    await writeFile(path, data);
  }
  const data = await readFile(path);
  const sha256 = createHash("sha256").update(data).digest("hex");
  if (sha256 !== expectedHash[model])
    throw Error(
      `Model hash mismatch: ${model}. Delete the file and download again.`,
    );
  manifest[model] = {
    bytes: data.length,
    sha256: createHash("sha256").update(data).digest("hex"),
    source: "Google MediaPipe model release float16/1",
  };
}
await writeFile(
  "public/models/manifest.json",
  JSON.stringify(manifest, null, 2),
);
console.log("Same-origin WASM and model assets ready", manifest);
