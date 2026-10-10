import { readdir, stat, readFile, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
async function walk(dir) {
  const files = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) files.push(...(await walk(p)));
    else files.push(p);
  }
  return files;
}
const files = await walk("dist"),
  rows = [];
for (const file of files.sort()) {
  const data = await readFile(file);
  rows.push({
    file: file.slice(5),
    bytes: (await stat(file)).size,
    gzipReferenceBytes: gzipSync(data).byteLength,
  });
}
const shell = rows.filter(
  (r) => !r.file.startsWith("mediapipe/") && !r.file.startsWith("models/"),
);
const sum = (rs, key = "bytes") => rs.reduce((s, r) => s + r[key], 0);
const get = (f) => rows.find((r) => r.file === f);
const presets = [];
for (const variant of ["internal", "nosimd_internal", "module_internal"])
  for (const model of ["lite", "full"]) {
    const selected = [
      ...shell,
      get(`mediapipe/wasm/vision_wasm_${variant}.js`),
      get(`mediapipe/wasm/vision_wasm_${variant}.wasm`),
      get(`models/pose_landmarker_${model}.task`),
    ];
    presets.push({
      variant,
      model,
      bytes: sum(selected),
      gzipReferenceBytes: sum(selected, "gzipReferenceBytes"),
      files: selected.map((r) => r.file),
    });
  }
const report = {
  unit: "bytes; MB = 1,000,000 bytes",
  files: rows,
  totalHostedBytes: sum(rows),
  shellBytes: sum(shell),
  coldStartPresets: presets,
  notes: [
    "Only one runtime variant and one model are selected by FilesetResolver and device settings.",
    "Full hosted size is not the per-device download total.",
    "gzipReferenceBytes is local gzip of each file; it is not observed GitHub Pages transfer size.",
    "First visits include the HTML/JS/CSS and Service Worker shell precache; HTTP cache reuse can avoid duplicate body transfers.",
    "The models manifest is hosted but not downloaded by the application.",
    "Warm-start wire transfer can be zero for cached app/model/runtime; Service Worker update checks may still contact the origin.",
  ],
};
await writeFile("ASSET-SIZES.json", JSON.stringify(report, null, 2) + "\n");
const fmt = (b) => `${b.toLocaleString("en-US")} (${(b / 1e6).toFixed(3)} MB)`;
await writeFile(
  "ASSET-SIZES.md",
  `# 配信アセット容量\n\n単位はbytes、MBは10進数。最新buildの実ファイルを集計。NF-05「初回の転送量（gzip）15MB以下」は、選択プリセットすべて15,000,000 bytes以下で合格（下表）。公開ホストの実測はPAGES-TRANSFER.mdも参照。\n\n| ファイル | 非圧縮bytes | ローカルgzip参考bytes |\n| --- | ---: | ---: |\n${rows.map((r) => `| ${r.file} | ${r.bytes} | ${r.gzipReferenceBytes} |`).join("\n")}\n\n配信する全ファイル合計: **${fmt(sum(rows))}**。このすべてを各端末が読み込むわけではありません。\n\n| 実行条件 | 初回に選択される実ファイル合計 | ローカルgzip参考合計 |\n| --- | ---: | ---: |\n${presets.map((p) => `| ${p.variant} / ${p.model} | ${fmt(p.bytes)} | ${fmt(p.gzipReferenceBytes)} |`).join("\n")}\n\n通常のiPhone/Androidはlite、PCはfull。SIMD対応時はinternal、非対応時はnosimd_internal。現在のアプリはmodule variantを要求しませんが容量を参考記載。モデルの明示切替は?model=lite/full。\n\n上記は**実際に選択されるファイルの非圧縮合計**で、通信回線の転送量実測ではありません。gzip値はローカル圧縮の参考値。GitHub PagesのContent-Encoding、HTTPキャッシュ、Service Worker制御タイミングによって実転送量は変わります。初回はService Workerが選択されたモデル/WASMを先に準備し、カメラ起動時は同じキャッシュを使います。画面の初回表示とシェル事前キャッシュはHTTPキャッシュで再利用されます。iPhoneの実測は?bench=1のdownload項目とWeb InspectorのNetworkで確認します。\n\n再訪問ではキャッシュ済み本文の転送は0 bytesになる場合がありますが、Service Worker更新確認などの通信が残る可能性があります。モデルmanifestはアプリから読み込まず、上記初回合計に含めません。\n`,
);
console.log(
  JSON.stringify(
    {
      totalHostedBytes: report.totalHostedBytes,
      shellBytes: report.shellBytes,
      coldStartPresets: presets.map(
        ({ variant, model, bytes, gzipReferenceBytes }) => ({
          variant,
          model,
          bytes,
          gzipReferenceBytes,
        }),
      ),
    },
    null,
    2,
  ),
);
