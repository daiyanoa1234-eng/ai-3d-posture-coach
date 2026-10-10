import { test } from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { renderWorker } from "./sw-template.mjs";
function harness(fail = false) {
  const scope = "https://demo.test/ai-3d-posture-coach/";
  const stores = new Map([
    [
      "posture-old",
      new Map([[scope + "models/pose_landmarker_lite.task", "old-model"]]),
    ],
    ["unrelated", new Map()],
  ]);
  const handlers = {};
  const fetched = [];
  let skipped = false,
    claimed = false;
  const caches = {
    keys: async () => [...stores.keys()],
    delete: async (k) => stores.delete(k),
    open: async (k) => {
      if (!stores.has(k)) stores.set(k, new Map());
      const store = stores.get(k);
      const add = async (u) => {
        if (fail) throw Error("offline");
        fetched.push(u);
        store.set(u, "fresh:" + u);
      };
      return {
        add,
        addAll: async (urls) => Promise.all(urls.map(add)),
        keys: async () => [...store.keys()].map((url) => ({ url })),
        match: async (u) => store.get(typeof u === "string" ? u : u.url),
      };
    },
  };
  runInNewContext(renderWorker("new", ["./index.html", "./assets/app.js"]), {
    URL,
    caches,
    fetch: async () => {
      throw Error("network unavailable");
    },
    self: {
      location: new URL(scope + "sw.js"),
      registration: { scope },
      addEventListener: (k, fn) => (handlers[k] = fn),
      skipWaiting: async () => {
        skipped = true;
      },
      clients: {
        claim: async () => {
          claimed = true;
        },
      },
    },
  });
  const dispatch = (kind, data = {}) => {
    let pending;
    handlers[kind]({
      ...data,
      waitUntil: (p) => (pending = p),
      respondWith: (p) => (pending = p),
    });
    return pending;
  };
  return {
    scope,
    stores,
    fetched,
    dispatch,
    get skipped() {
      return skipped;
    },
    get claimed() {
      return claimed;
    },
  };
}
test("prepares one device preset, serves query navigation and inference without network, and removes old versions", async () => {
  const h = harness();
  await h.dispatch("install");
  assert(h.skipped);
  assert(h.fetched.includes(h.scope + "models/pose_landmarker_lite.task"));
  await h.dispatch("activate");
  assert(h.claimed);
  assert(!h.stores.has("posture-old"));
  assert(h.stores.has("unrelated"));
  let result;
  await h.dispatch("message", {
    data: { type: "PREPARE", model: "lite", variant: "nosimd_internal" },
    ports: [{ postMessage: (r) => (result = r) }],
  });
  assert.equal(result.ok, true);
  assert(!h.fetched.some((u) => u.includes("_full.task")));
  const body = await h.dispatch("fetch", {
    request: { url: h.scope + "?bench=1", method: "GET", mode: "navigate" },
  });
  assert.equal(body, "fresh:" + h.scope + "index.html");
  assert.equal(
    await h.dispatch("fetch", {
      request: {
        url: h.scope + "mediapipe/wasm/vision_wasm_nosimd_internal.wasm",
        method: "GET",
        mode: "cors",
      },
    }),
    "fresh:" + h.scope + "mediapipe/wasm/vision_wasm_nosimd_internal.wasm",
  );
});
test("failed update preserves old working cache and does not activate", async () => {
  const h = harness(true);
  await assert.rejects(h.dispatch("install"));
  assert(h.stores.has("posture-old"));
  assert(!h.stores.has("posture-new"));
  assert(!h.skipped);
});
