import type { Calibration, Confidence, PoseFrame, V3 } from "../types";
import { appConfig } from "../config/appConfig";
import { signedAngle, trunkVector } from "./angles";
export function median(values: number[]) {
  const a = [...values].sort((x, y) => x - y),
    m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
export function angularStd(vectors: { x: number; y: number }[]): number {
  const angles = vectors.map((v) => signedAngle(vectors[0], v)),
    mean = angles.reduce((a, b) => a + b, 0) / angles.length;
  return Math.sqrt(
    angles.reduce((a, b) => a + (b - mean) ** 2, 0) / angles.length,
  );
}
export class Calibrator {
  private started: number | null = null;
  private samples: { frame: PoseFrame; conf: Confidence }[] = [];
  cancel() {
    this.started = null;
    this.samples = [];
  }
  start(now: number) {
    this.started = now;
    this.samples = [];
  }
  get active() {
    return this.started !== null;
  }
  sample(
    frame: PoseFrame,
    conf: Confidence,
  ): { message: string; done?: Calibration; error?: boolean } | null {
    if (this.started === null) return null;
    const elapsed = frame.timestampMs - this.started,
      cfg = appConfig.calibration;
    if (elapsed < cfg.countdownMs)
      return {
        message: `横向きで直立してください · ${Math.ceil((cfg.countdownMs - elapsed) / 1000)}`,
      };
    if (conf.valid && frame.world.length === 33)
      this.samples.push({ frame, conf });
    if (elapsed < cfg.countdownMs + cfg.collectMs)
      return { message: "基準を記録中 · 動かずにそのまま" };
    this.started = null;
    if (this.samples.length < cfg.minSamples)
      return { message: "全身を映して、もう一度補正してください", error: true };
    const vectors = this.samples.map((s) => trunkVector(s.frame, s.conf.side));
    if (angularStd(vectors) > cfg.maxStdDeg)
      return { message: "動かずにもう一度補正してください", error: true };
    const median3 = (vs: V3[]): V3 => ({
      x: median(vs.map((v) => v.x)),
      y: median(vs.map((v) => v.y)),
      z: median(vs.map((v) => v.z)),
    });
    const up = this.samples.map(({ frame: f, conf: c }) => {
      const o = c.side === "left" ? 0 : 1,
        s = f.world[11 + o],
        h = f.world[23 + o];
      return { x: s.x - h.x, y: s.y - h.y, z: s.z - h.z };
    });
    const right = this.samples.map(({ frame: f }) => ({
      x: f.world[24].x - f.world[23].x,
      y: f.world[24].y - f.world[23].y,
      z: f.world[24].z - f.world[23].z,
    }));
    const result: Calibration = {
      trunkVec2D: {
        x: median(vectors.map((v) => v.x)),
        y: median(vectors.map((v) => v.y)),
      },
      trunkVec3D: median3(up),
      rightVec3D: median3(right),
      shoulderWidthPx: median(
        this.samples.map(({ frame: f }) =>
          Math.hypot(
            (f.image[12].x - f.image[11].x) * f.videoSize.width,
            (f.image[12].y - f.image[11].y) * f.videoSize.height,
          ),
        ),
      ),
      createdAt: Date.now(),
    };
    this.samples = [];
    return { message: "補正完了 · 直立姿勢を基準にしました", done: result };
  }
}
