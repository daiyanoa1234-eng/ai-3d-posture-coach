import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import type { PoseFrame } from "../types";
import { appConfig } from "../config/appConfig";
export class PoseEstimator {
  private task: PoseLandmarker | null = null;
  delegate: "GPU" | "CPU" = "GPU";
  model: "lite" | "full" = appConfig.model;
  private timestamp = -1;
  private generation = 0;
  async init(delegate: "GPU" | "CPU" = "GPU"): Promise<void> {
    this.close();
    const generation = this.generation;
    this.delegate = delegate;
    const base = import.meta.env.BASE_URL;
    const files = await FilesetResolver.forVisionTasks(`${base}mediapipe/wasm`);
    try {
      const task = await PoseLandmarker.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: `${base}models/pose_landmarker_${this.model}.task`,
          delegate,
        },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputSegmentationMasks: false,
      });
      if (generation !== this.generation) {
        task.close();
        throw new DOMException("解析モデルの起動を中止しました", "AbortError");
      }
      this.task = task;
    } catch (error) {
      if (generation !== this.generation) throw error;
      if (delegate === "GPU") return this.init("CPU");
      throw error;
    }
  }
  detect(video: HTMLVideoElement, now: number): PoseFrame {
    if (!this.task) throw Error("解析モデルが未起動です");
    const start = performance.now();
    this.timestamp = Math.max(this.timestamp + 0.001, now);
    const result = this.task.detectForVideo(video, this.timestamp);
    return {
      timestampMs: now,
      image: (result.landmarks[0] ?? []).map((p) => ({
        ...p,
        visibility: p.visibility ?? 0,
      })),
      world: (result.worldLandmarks[0] ?? []).map((p) => ({
        ...p,
        visibility: p.visibility ?? 0,
      })),
      videoSize: { width: video.videoWidth, height: video.videoHeight },
      inferenceMs: performance.now() - start,
    };
  }
  close() {
    this.generation++;
    this.task?.close();
    this.task = null;
    this.timestamp = -1;
  }
}
