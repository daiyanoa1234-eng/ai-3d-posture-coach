import type { Landmark } from "../types";
import { appConfig } from "../config/appConfig";
export class OneEuroFilter {
  private value: number | null = null;
  private derivative = 0;
  private raw = 0;
  private time = 0;
  constructor(
    public minCutoff = 1,
    public beta = 0.01,
    private dCutoff = 1,
  ) {}
  reset() {
    this.value = null;
    this.derivative = 0;
  }
  filter(value: number, timeMs: number): number {
    if (!Number.isFinite(value)) return this.value ?? 0;
    if (this.value === null) {
      this.raw = value;
      this.value = value;
      this.time = timeMs;
      return value;
    }
    if (timeMs <= this.time) return this.value;
    const dt = (timeMs - this.time) / 1000;
    const alpha = (cutoff: number) => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));
    this.derivative +=
      alpha(this.dCutoff) * ((value - this.raw) / dt - this.derivative);
    this.value +=
      alpha(this.minCutoff + this.beta * Math.abs(this.derivative)) *
      (value - this.value);
    this.raw = value;
    this.time = timeMs;
    return this.value;
  }
}
export class LandmarkFilter {
  private filters: OneEuroFilter[][] = [];
  constructor(private world = false) {}
  reset() {
    this.filters = [];
  }
  apply(points: Landmark[], time: number): Landmark[] {
    return points.map((p, i) => {
      const cfg = appConfig.smoothing;
      const f = (this.filters[i] ??= [0, 1, 2].map(
        () =>
          new OneEuroFilter(
            this.world ? cfg.worldCutoff : cfg.minCutoff,
            cfg.beta,
            cfg.dCutoff,
          ),
      ));
      f.forEach((v) => {
        v.minCutoff = this.world ? cfg.worldCutoff : cfg.minCutoff;
        v.beta = cfg.beta;
      });
      return {
        ...p,
        x: f[0].filter(p.x, time),
        y: f[1].filter(p.y, time),
        z: f[2].filter(p.z, time),
      };
    });
  }
}
