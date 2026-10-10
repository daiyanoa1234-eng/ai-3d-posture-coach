import { currentDownloadReport } from "../analysis/downloads";
import { Camera, cameraError } from "../camera/Camera";
import { PoseEstimator } from "../pose/PoseEstimator";
import { LandmarkFilter } from "../filter/OneEuroFilter";
import { ConfidenceGate } from "../analysis/confidence";
import { calculateAngles } from "../analysis/angles";
import { Calibrator } from "../analysis/calibration";
import { FeedbackEngine } from "../feedback/FeedbackEngine";
import { colors, labels } from "../feedback/feedbackConfig";
import { Scene3D } from "../scene/Scene3D";
import { Overlay } from "../ui/Overlay";
import { element, setText } from "../ui/Hud";
import { appConfig, isMobile } from "../config/appConfig";
import { demoPose } from "./demoPose";
import type {
  Calibration,
  Confidence,
  JointAngles,
  Mode,
  PoseFrame,
  Level,
} from "../types";
type State = "idle" | "setup" | "running" | "demo" | "paused" | "error";
interface Benchmark {
  inferenceFps: number;
  renderFps: number;
  meanInferenceMs: number;
  delegate: string;
  model: string;
  video: string;
  userAgent: string;
  durationSeconds: number;
  qualityAdjusted: boolean;
  wasmRuntime: { loader: string; binary: string };
  download: ReturnType<typeof currentDownloadReport>;
}
export class App {
  private camera = new Camera(element<HTMLVideoElement>("video"));
  private pose = new PoseEstimator();
  private filter2 = new LandmarkFilter();
  private filter3 = new LandmarkFilter(true);
  private gate = new ConfidenceGate();
  private calibrator = new Calibrator();
  private feedback = new FeedbackEngine();
  private overlay = new Overlay(element<HTMLCanvasElement>("overlay"));
  private scene: Scene3D;
  private state: State = "idle";
  private previous: State = "running";
  private mode: Mode = "forwardBend";
  private calibration: Calibration | null = null;
  private calibrationKey = "";
  private debug = new URLSearchParams(location.search).has("debug");
  private bench = new URLSearchParams(location.search).has("bench");
  private mirror = false;
  private front = false;
  private voice = false;
  private lastFrame = 0;
  private lastVideoTime = -1;
  private raf = 0;
  private videoCallback = 0;
  private lastDraw = 0;
  private lastHud = 0;
  private inferenceFps = 0;
  private renderFps = 0;
  private inferenceMs = 0;
  private frames = 0;
  private draws = 0;
  private windowStart = performance.now();
  private currentConfidence: Confidence | null = null;
  private currentAngles: JointAngles | null = null;
  private benchStart = 0;
  private benchFrames = 0;
  private benchDraws = 0;
  private benchMs = 0;
  private result: Benchmark | null = null;
  private maxFps = appConfig.maxInferenceFps;
  private lowSince: number | null = null;
  private adjusted = false;
  private switching = false;
  private speechVoice: SpeechSynthesisVoice | null = null;
  private voiceTime = -Infinity;
  private level: Level = "neutral";
  private token = 0;
  private autoResume = false;
  private calibrationMessage = "";
  private calibrationUntil = 0;
  constructor() {
    this.scene = new Scene3D(element("scene"), this.debug);
    this.bind();
    element("debug-panel").hidden = !(this.debug || this.bench);
    if (this.bench) element<HTMLDetailsElement>("debug-panel").open = true;
    this.render(performance.now());
    void this.prepareOffline();
  }
  private bind() {
    element("start").onclick = () =>
      element<HTMLDialogElement>("consent").showModal();
    element("cancel-consent").onclick = () =>
      element<HTMLDialogElement>("consent").close();
    element("agree").onclick = () => {
      element<HTMLDialogElement>("consent").close();
      void this.start();
    };
    element("demo").onclick = () => this.startDemo();
    element("guide-button").onclick = () =>
      element<HTMLDialogElement>("guide").showModal();
    element("close-guide").onclick = () =>
      element<HTMLDialogElement>("guide").close();
    element("retry").onclick = () => {
      element<HTMLDialogElement>("error").close();
      void this.start();
    };
    element("close-error").onclick = () =>
      element<HTMLDialogElement>("error").close();
    element("pause").onclick = () => {
      if (this.state === "paused") void this.resume();
      else this.pause(false);
    };
    element("stop").onclick = () => this.stop();
    element("calibrate").onclick = () => {
      this.calibrationMessage = "";
      this.calibrator.start(performance.now());
    };
    element("switch").onclick = () => {
      this.camera.facing =
        this.camera.facing === "user" ? "environment" : "user";
      this.camera.deviceId = "";
      this.mirror = this.camera.facing === "user";
      element<HTMLInputElement>("mirror").checked = this.mirror;
      this.applyMirror();
      void this.restartCamera();
    };
    element<HTMLSelectElement>("devices").onchange = (e) => {
      this.camera.deviceId = (e.target as HTMLSelectElement).value;
      void this.restartCamera();
    };
    element<HTMLInputElement>("mirror").onchange = (e) => {
      this.mirror = (e.target as HTMLInputElement).checked;
      this.applyMirror();
    };
    element<HTMLInputElement>("front").onchange = (e) => {
      this.front = (e.target as HTMLInputElement).checked;
    };
    element<HTMLInputElement>("voice").onchange = (e) => {
      this.voice = (e.target as HTMLInputElement).checked;
      if (this.voice && "speechSynthesis" in window) {
        this.speechVoice =
          speechSynthesis
            .getVoices()
            .find((v) => v.localService && v.lang.startsWith("ja")) ?? null;
        if (!this.speechVoice) {
          this.voice = false;
          element<HTMLInputElement>("voice").checked = false;
          setText("hint", "この端末では日本語の端末内音声を利用できません");
          return;
        }
        const u = new SpeechSynthesisUtterance("音声をオンにしました");
        u.voice = this.speechVoice;
        u.lang = "ja-JP";
        speechSynthesis.speak(u);
      } else if ("speechSynthesis" in window) speechSynthesis.cancel();
    };
    document.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach(
      (b) =>
        (b.onclick = () => {
          this.mode = b.dataset.mode as Mode;
          this.feedback.reset();
          this.calibrationMessage = "";
          document
            .querySelectorAll("[data-mode]")
            .forEach((v) => v.classList.toggle("active", v === b));
        }),
    );
    document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach(
      (b) =>
        (b.onclick = () => {
          this.scene.view(b.dataset.view as "angle" | "side" | "front");
          document
            .querySelectorAll("[data-view]")
            .forEach((v) => v.classList.toggle("active", v === b));
        }),
    );
    element<HTMLInputElement>("smooth").oninput = (e) => {
      appConfig.smoothing.minCutoff = Number(
        (e.target as HTMLInputElement).value,
      );
    };
    element<HTMLInputElement>("beta").oninput = (e) => {
      appConfig.smoothing.beta = Number((e.target as HTMLInputElement).value);
    };
    element("copy-bench").onclick = () => void this.copyBench();
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        if (this.state === "running" || this.state === "demo") this.pause(true);
        else if (this.state === "setup") {
          ++this.token;
          this.camera.stop();
          this.state = "paused";
          this.autoResume = true;
          this.previous = "running";
          this.setControls();
        }
        cancelAnimationFrame(this.raf);
      } else {
        this.lastDraw = performance.now();
        this.render(this.lastDraw);
        if (this.autoResume) void this.resume();
      }
    });
    window.addEventListener("pagehide", () => {
      this.camera.stop();
      this.cancelInference();
      this.pose.close();
      this.calibrator.cancel();
      if ("speechSynthesis" in window) speechSynthesis.cancel();
    });
    window.addEventListener("pageshow", (e) => {
      if (e.persisted) this.stop();
    });
  }
  private applyMirror() {
    element("capture").classList.toggle("mirrored", this.mirror);
  }
  private resetTracking() {
    this.filter2.reset();
    this.filter3.reset();
    this.gate.reset();
    this.feedback.reset();
    this.calibrator.cancel();
    this.calibrationMessage = "";
    this.lastFrame = 0;
    this.lastVideoTime = -1;
    this.currentAngles = null;
    this.currentConfidence = null;
  }
  private async start() {
    if (this.state === "setup") return;
    const token = ++this.token;
    this.state = "setup";
    this.setControls();
    setText("hint", "カメラと解析モデルを準備しています…");
    element("camera-placeholder").hidden = true;
    element("source-badge").hidden = true;
    try {
      await this.camera.start();
      if (token !== this.token) return;
      if (document.hidden) {
        this.camera.stop();
        this.state = "paused";
        this.autoResume = true;
        this.previous = "running";
        this.setControls();
        return;
      }
      await this.pose.init();
      if (document.hidden && token === this.token) {
        this.camera.stop();
        this.state = "paused";
        this.autoResume = true;
        this.previous = "running";
        this.setControls();
        return;
      }
      if (token !== this.token) return;
      await this.updateDevices();
      this.loadCalibration();
      this.resetTracking();
      this.state = "running";
      this.beginBenchmark();
      this.setControls();
      this.scheduleInference();
      void this.cacheInferenceAssets();
    } catch (error) {
      if (token === this.token) this.fail(error);
    }
  }
  private startDemo() {
    this.stop();
    this.state = "demo";
    this.calibration = null;
    this.mirror = false;
    element<HTMLInputElement>("mirror").checked = false;
    this.applyMirror();
    element("camera-placeholder").hidden = true;
    element("source-badge").hidden = false;
    this.setControls();
    setText("tracking", "DEMO · サンプル");
    setText(
      "bench-note",
      "デモは合成動作です。性能計測はカメラ起動後に行ってください。",
    );
  }
  private fail(error: unknown) {
    this.camera.stop();
    this.cancelInference();
    this.pose.close();
    this.state = "error";
    element("camera-placeholder").hidden = false;
    setText("error-message", cameraError(error));
    setText("hint", "起動できませんでした。設定を確認して再試行してください。");
    setText("tracking", "起動エラー");
    this.setControls();
    if (!element<HTMLDialogElement>("error").open)
      element<HTMLDialogElement>("error").showModal();
  }
  private stop() {
    ++this.token;
    this.camera.stop();
    this.cancelInference();
    this.pose.close();
    this.state = "idle";
    this.autoResume = false;
    this.resetTracking();
    this.calibration = null;
    this.scene.retargeter.neutral(performance.now());
    this.overlay.clear();
    element("camera-placeholder").hidden = false;
    element("source-badge").hidden = true;
    this.scene.setFeedback({
      level: "neutral",
      message: "",
      legPulse: false,
      partial: false,
    });
    this.clearMetrics();
    setText("hint", "カメラを起動して、動きを見てみましょう");
    setText("tracking", "待機中");
    this.setControls();
    if ("speechSynthesis" in window) speechSynthesis.cancel();
  }
  private pause(auto: boolean) {
    if (this.state !== "running" && this.state !== "demo") return;
    this.previous = this.state;
    this.state = "paused";
    this.autoResume = auto;
    this.camera.stop();
    this.cancelInference();
    this.calibrator.cancel();
    this.scene.retargeter.freeze();
    this.scene.setFeedback({
      level: "neutral",
      message: "",
      legPulse: false,
      partial: false,
    });
    this.clearMetrics();
    setText(
      "hint",
      this.previous === "demo"
        ? "サンプル動作を一時停止中"
        : "一時停止中 · 再開するとカメラを起動します",
    );
    setText("tracking", "PAUSED");
    this.setControls();
    if ("speechSynthesis" in window) speechSynthesis.cancel();
  }
  private async resume() {
    this.autoResume = false;
    if (this.previous === "demo") {
      this.state = "demo";
      this.setControls();
      return;
    }
    this.state = "idle";
    await this.start();
  }
  private async restartCamera() {
    if (this.switching || this.state !== "running") return;
    this.switching = true;
    const token = this.token;
    this.cancelInference();
    this.resetTracking();
    this.calibration = null;
    setText("hint", "カメラを切り替えています…");
    try {
      await this.camera.start();
      if (token !== this.token) return;
      await this.updateDevices();
      this.loadCalibration();
      this.beginBenchmark();
      this.scheduleInference();
    } catch (e) {
      if (token === this.token) this.fail(e);
    } finally {
      this.switching = false;
    }
  }
  private async updateDevices() {
    const devices = await this.camera.devices(),
      select = element<HTMLSelectElement>("devices");
    select.replaceChildren(new Option("カメラを選択", ""));
    devices.forEach((d, i) =>
      select.add(new Option(d.label || `カメラ ${i + 1}`, d.deviceId)),
    );
    select.value = this.camera.deviceId;
  }
  private loadCalibration() {
    const id =
      this.camera.video.srcObject instanceof MediaStream
        ? this.camera.video.srcObject.getVideoTracks()[0]?.getSettings()
            .deviceId
        : "";
    this.calibrationKey = `posture-calibration-${id || this.camera.facing}-${this.camera.video.videoWidth}x${this.camera.video.videoHeight}`;
    this.calibration = null;
    try {
      const v = JSON.parse(
        sessionStorage.getItem(this.calibrationKey) ?? "null",
      ) as Calibration | null;
      if (
        v &&
        Number.isFinite(
          v.trunkVec2D.x +
            v.trunkVec2D.y +
            v.trunkVec3D.x +
            v.trunkVec3D.y +
            v.trunkVec3D.z +
            v.rightVec3D.x +
            v.rightVec3D.y +
            v.rightVec3D.z,
        ) &&
        Math.hypot(v.trunkVec2D.x, v.trunkVec2D.y) > 0
      )
        this.calibration = v;
    } catch {
      /* Session storage may be blocked; memory-only fallback. */
    }
  }
  private setControls() {
    const live = this.state === "running",
      demo = this.state === "demo",
      paused = this.state === "paused";
    for (const id of ["calibrate", "switch", "devices"])
      element<HTMLButtonElement>("" + id).disabled = !live;
    element<HTMLButtonElement>("pause").disabled = !(live || demo || paused);
    element<HTMLButtonElement>("stop").disabled = !(
      live ||
      demo ||
      paused ||
      this.state === "setup"
    );
    setText("pause", paused ? "▷ 再開" : "Ⅱ 一時停止");
  }
  private cancelInference() {
    if (this.videoCallback && "cancelVideoFrameCallback" in this.camera.video)
      this.camera.video.cancelVideoFrameCallback(this.videoCallback);
    this.videoCallback = 0;
  }
  private scheduleInference() {
    if (this.state !== "running" || document.hidden) return;
    if ("requestVideoFrameCallback" in this.camera.video)
      this.videoCallback = this.camera.video.requestVideoFrameCallback(
        (now) => {
          this.videoCallback = 0;
          this.infer(now);
          this.scheduleInference();
        },
      );
  }
  private infer(now: number) {
    if (
      this.state !== "running" ||
      this.switching ||
      document.hidden ||
      this.camera.video.readyState < 2 ||
      now - this.lastFrame < 1000 / this.maxFps ||
      this.camera.video.currentTime === this.lastVideoTime
    )
      return;
    this.lastFrame = Math.max(
      this.lastFrame + 1000 / this.maxFps,
      now - 1000 / this.maxFps,
    );
    this.lastVideoTime = this.camera.video.currentTime;
    try {
      const f = this.pose.detect(this.camera.video, now);
      this.inferenceMs = f.inferenceMs;
      this.frames++;
      if (!this.result && this.benchStart) {
        this.benchFrames++;
        this.benchMs += f.inferenceMs;
      }
      this.process(f);
    } catch (error) {
      if (this.pose.delegate === "GPU") {
        this.cancelInference();
        this.switching = true;
        setText("hint", "CPU処理に切り替えています…");
        void this.pose
          .init("CPU")
          .then(() => {
            this.switching = false;
            this.scheduleInference();
          })
          .catch((e) => {
            this.switching = false;
            this.fail(e);
          });
      } else this.fail(error);
    }
  }
  private process(raw: PoseFrame) {
    const c = this.gate.update(raw.image, raw.timestampMs);
    this.currentConfidence = c;
    const f = {
      ...raw,
      image: this.filter2.apply(raw.image, raw.timestampMs),
      world: this.filter3.apply(raw.world, raw.timestampMs),
    };
    if (c.state === "LOST") {
      this.filter2.reset();
      this.filter3.reset();
    }
    const calibration = this.calibrator.sample(f, c);
    if (calibration) {
      this.calibrationMessage = calibration.message;
      this.calibrationUntil = raw.timestampMs + 2500;
      if (calibration.done) {
        this.calibration = calibration.done;
        try {
          sessionStorage.setItem(
            this.calibrationKey,
            JSON.stringify(calibration.done),
          );
        } catch {
          /* Memory-only fallback. */
        }
        this.feedback.reset();
      }
    }
    const angles = calculateAngles(f, c, this.calibration, this.front);
    this.currentAngles = angles;
    const fb = this.feedback.update(angles, c, this.mode, raw.timestampMs);
    this.scene.retargeter.update(f, c, this.calibration, this.mirror);
    this.scene.setFeedback(fb);
    this.overlay.draw(f.image, f.videoSize.width, f.videoSize.height);
    document.documentElement.style.setProperty("--level", colors[fb.level]);
    setText("level-label", labels[fb.level]);
    setText(
      "feedback-symbol",
      fb.level === "red"
        ? "！"
        : fb.level === "orange"
          ? "△"
          : fb.level === "green"
            ? "○"
            : "◈",
    );
    if (!this.calibrator.active && raw.timestampMs > this.calibrationUntil)
      this.calibrationMessage = "";
    setText("hint", this.calibrationMessage || fb.message);
    if (fb.level !== this.level) {
      if (
        this.voice &&
        this.speechVoice &&
        fb.level !== "neutral" &&
        ["green", "orange", "red"].indexOf(fb.level) >
          ["green", "orange", "red"].indexOf(this.level) &&
        raw.timestampMs - this.voiceTime >= appConfig.voiceIntervalMs &&
        "speechSynthesis" in window
      ) {
        speechSynthesis.cancel();
        const speech = new SpeechSynthesisUtterance(fb.message);
        speech.lang = "ja-JP";
        speech.voice = this.speechVoice;
        speechSynthesis.speak(speech);
        this.voiceTime = raw.timestampMs;
      }
      this.level = fb.level;
    }
  }
  private clearMetrics() {
    for (const id of ["trunk", "hip", "knee"]) setText(id, "—");
    setText("feedback-symbol", "◈");
    this.level = "neutral";
    setText("quality", "未補正");
    setText("level-label", labels.neutral);
    element("angle-label").innerHTML = "体幹前傾 <b>—°</b>";
    document.documentElement.style.setProperty("--level", colors.neutral);
  }
  private render = (now: number) => {
    if (document.hidden) return;
    const dt = Math.min(0.1, (now - (this.lastDraw || now)) / 1000);
    this.lastDraw = now;
    if (this.state === "demo" && now - this.lastFrame >= 1000 / 20) {
      this.lastFrame = now;
      this.process(demoPose(now, this.mode));
    }
    if (
      this.state === "running" &&
      !("requestVideoFrameCallback" in this.camera.video)
    )
      this.infer(now);
    const anchor = this.scene.render(dt, now),
      label = element("angle-label"),
      host = element("scene");
    label.style.left = `${Math.max(8, Math.min(host.clientWidth - 115, anchor.x))}px`;
    label.style.top = `${Math.max(8, Math.min(host.clientHeight - 90, anchor.y))}px`;
    this.draws++;
    if (this.state === "running" && !this.result && this.benchStart)
      this.benchDraws++;
    if (now - this.windowStart >= 1000) {
      const duration = (now - this.windowStart) / 1000;
      this.inferenceFps = this.frames / duration;
      this.renderFps = this.draws / duration;
      this.frames = 0;
      this.draws = 0;
      this.windowStart = now;
      this.adjustQuality(now);
    }
    if (now - this.lastHud > 200) {
      this.lastHud = now;
      this.updateHud(now);
    }
    if (
      this.state === "running" &&
      this.benchStart &&
      !this.result &&
      now - this.benchStart >= appConfig.benchmarkMs
    )
      this.finishBenchmark(now);
    this.raf = requestAnimationFrame(this.render);
  };
  private updateHud(now: number) {
    const a = this.currentAngles,
      c = this.currentConfidence,
      format = (v: number | null | undefined) =>
        v === null || v === undefined ? "—" : Math.round(v).toString();
    if (this.state === "running" || this.state === "demo") {
      setText("trunk", format(a?.trunkFlexion));
      setText("hip", format(a?.hipFlexion));
      setText("knee", format(a?.kneeFlexion));
      setText(
        "quality",
        this.state === "demo"
          ? "サンプル"
          : a?.quality === "reference"
            ? "参考値（正面）"
            : this.calibration
              ? "補正済"
              : "未補正",
      );
      element("angle-label").innerHTML =
        `体幹前傾 <b>${format(a?.trunkFlexion)}°</b>`;
      if (this.state === "running")
        setText(
          "tracking",
          `${c?.state ?? "LOST"} · ${Math.round(this.inferenceFps)} fps`,
        );
    }
    if (this.debug || this.bench) {
      const output = this.result ?? {
        inferenceFps: Math.round(this.inferenceFps * 10) / 10,
        renderFps: Math.round(this.renderFps),
        inferenceMs: Math.round(this.inferenceMs * 10) / 10,
        confidence: c,
        delegate: this.pose.delegate,
        model: this.pose.model,
        state: this.state,
        benchmarkSeconds: this.benchStart
          ? Math.min(30, (now - this.benchStart) / 1000).toFixed(1)
          : 0,
        axisSign: appConfig.axisSign,
      };
      setText("debug-output", JSON.stringify(output, null, 2));
    }
  }
  private adjustQuality(now: number) {
    if (
      this.state !== "running" ||
      this.inferenceFps >= appConfig.quality.lowFps
    ) {
      this.lowSince = null;
      return;
    }
    this.lowSince ??= now;
    if (now - this.lowSince < appConfig.quality.durationMs || this.adjusted)
      return;
    this.adjusted = true;
    this.scene.renderer.setPixelRatio(1);
    this.maxFps = Math.min(this.maxFps, appConfig.quality.fallbackFps);
    if (this.pose.delegate === "GPU") {
      this.cancelInference();
      this.switching = true;
      void this.pose
        .init("CPU")
        .then(() => {
          this.switching = false;
          this.scheduleInference();
        })
        .catch((e) => {
          this.switching = false;
          this.fail(e);
        });
    }
  }
  private beginBenchmark() {
    this.benchStart = performance.now();
    this.benchFrames = 0;
    this.benchDraws = 0;
    this.benchMs = 0;
    this.result = null;
    this.maxFps = appConfig.maxInferenceFps;
    this.adjusted = false;
    this.lowSince = null;
    this.windowStart = performance.now();
    this.draws = 0;
    this.frames = 0;
  }
  private finishBenchmark(now: number) {
    const seconds = (now - this.benchStart) / 1000;
    this.result = {
      inferenceFps: +(this.benchFrames / seconds).toFixed(1),
      renderFps: +(this.benchDraws / seconds).toFixed(1),
      meanInferenceMs: +(this.benchMs / Math.max(1, this.benchFrames)).toFixed(
        1,
      ),
      delegate: this.pose.delegate,
      model: this.pose.model,
      video: `${this.camera.video.videoWidth}x${this.camera.video.videoHeight}`,
      userAgent: navigator.userAgent,
      durationSeconds: +seconds.toFixed(1),
      qualityAdjusted: this.adjusted,
      wasmRuntime: this.pose.wasmRuntime,
      download: currentDownloadReport(),
    };
    const passed = this.result.inferenceFps >= (isMobile ? 15 : 25);
    setText(
      "bench-note",
      passed
        ? "計測完了 · FPS目標を満たしました（連続稼働は別途確認）"
        : "計測完了 · FPS目標未達。lite・12fpsでの再検証またはPC利用を推奨。",
    );
  }
  private async copyBench() {
    if (!this.result) {
      setText(
        "bench-note",
        "カメラで30秒の計測を完了してからコピーしてください。",
      );
      return;
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(this.result, null, 2));
      setText(
        "bench-note",
        "計測結果をコピーしました。外部へは送信していません。",
      );
    } catch {
      setText(
        "bench-note",
        "コピーできません。表示中の計測結果を選択してコピーしてください。",
      );
    }
  }
  private async prepareOffline() {
    if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;
    try {
      await navigator.serviceWorker.register(
        `${import.meta.env.BASE_URL}sw.js`,
        { scope: import.meta.env.BASE_URL },
      );
      await navigator.serviceWorker.ready;
      setText("offline", "画面をキャッシュ済 · カメラ起動で解析モデルを準備");
    } catch {
      setText("offline", "オフライン準備に失敗 · 接続中は利用可能");
    }
  }
  private async cacheInferenceAssets() {
    if (!("caches" in window) || import.meta.env.DEV) return;
    try {
      await navigator.serviceWorker.ready;
      const names = await caches.keys(),
        name = names.find((n) => n.startsWith("posture-"));
      if (!name) return;
      const cache = await caches.open(name);
      const urls = new Set(
        performance
          .getEntriesByType("resource")
          .map((e) => e.name)
          .filter(
            (url) =>
              url.startsWith(location.origin) &&
              (/\/mediapipe\/wasm\//.test(url) ||
                /\/models\/.*\.task/.test(url)),
          ),
      );
      urls.add(
        new URL(
          `${import.meta.env.BASE_URL}models/pose_landmarker_${this.pose.model}.task`,
          location.origin,
        ).href,
      );
      if (![...urls].some((url) => url.endsWith(".wasm"))) {
        setText("offline", "WASMのキャッシュ未確認 · オフライン動作は未準備");
        return;
      }
      for (const url of urls)
        if (!(await cache.match(url))) await cache.add(url);
      setText("offline", `オフライン準備完了 · ${this.pose.model}モデル`);
    } catch {
      setText("offline", "解析モデルのキャッシュ未完了 · 接続して再試行");
    }
  }
}
