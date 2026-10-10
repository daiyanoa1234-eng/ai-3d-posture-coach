import { FilesetResolver } from "@mediapipe/tasks-vision";
export async function prepareOffline(
  model: "lite" | "full",
  status: (text: string) => void,
  beforeUpdate: () => void,
): Promise<void> {
  if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;
  status("オフライン準備中 · モデルをダウンロードしています");
  try {
    const base = import.meta.env.BASE_URL;
    const files = await FilesetResolver.forVisionTasks(`${base}mediapipe/wasm`);
    const variant = files.wasmBinaryPath?.includes("nosimd")
      ? "nosimd_internal"
      : "internal";
    const controlled = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      () => {
        // A fully installed new version replaces both UI and inference assets together.
        if (controlled) {
          beforeUpdate();
          location.reload();
        }
      },
      { once: true },
    );
    const registration = await navigator.serviceWorker.register(
      `${base}sw.js`,
      { scope: base, updateViaCache: "none" },
    );
    const pending = registration.installing ?? registration.waiting;
    if (pending)
      await new Promise<void>((resolve, reject) => {
        const check = () => {
          if (pending.state === "activated") resolve();
          if (pending.state === "redundant")
            reject(Error("Offline install failed"));
        };
        pending.addEventListener("statechange", check);
        check();
      });
    const ready = await navigator.serviceWorker.ready;
    await new Promise<void>((resolve, reject) => {
      const channel = new MessageChannel();
      const timer = window.setTimeout(() => {
        channel.port1.close();
        reject(Error("Offline preparation timed out"));
      }, 120000);
      channel.port1.onmessage = (event: MessageEvent<{ ok: boolean }>) => {
        clearTimeout(timer);
        channel.port1.close();
        if (event.data.ok) resolve();
        else reject(Error("Offline asset download failed"));
      };
      ready.active?.postMessage({ type: "PREPARE", model, variant }, [
        channel.port2,
      ]);
    });
    status(`オフライン準備完了 · ${model}モデル`);
  } catch {
    status("オフライン準備に失敗 · 接続して再読み込みしてください");
  }
}
