import type { Landmark, Confidence } from "../types";
import { appConfig } from "../config/appConfig";
const score = (p: Landmark | undefined) =>
  p &&
  Number.isFinite(p.x + p.y + p.z) &&
  p.x >= 0 &&
  p.x <= 1 &&
  p.y >= 0 &&
  p.y <= 1
    ? Math.min(p.visibility, p.presence ?? 1)
    : 0;
export class ConfidenceGate {
  private lastGood: number | null = null;
  private side: Confidence["side"] = "left";
  reset() {
    this.lastGood = null;
  }
  update(points: Landmark[], now: number): Confidence {
    const left = Math.min(score(points[11]), score(points[23])),
      right = Math.min(score(points[12]), score(points[24]));
    // Small margin prevents alternating between the visible sides frame by frame.
    if (left > right + 0.1) this.side = "left";
    else if (right > left + 0.1) this.side = "right";
    const trunk = this.side === "left" ? left : right;
    const legL = Math.min(...[23, 25, 27].map((i) => score(points[i]))),
      legR = Math.min(...[24, 26, 28].map((i) => score(points[i])));
    const valid = trunk >= appConfig.trunkConfidence;
    if (valid) this.lastGood = now;
    const leg = this.side === "left" ? legL : legR;
    const state = valid
      ? leg >= appConfig.legConfidence
        ? "TRACKING"
        : "PARTIAL"
      : this.lastGood !== null && now - this.lastGood < appConfig.lostTimeoutMs
        ? "PARTIAL"
        : "LOST";
    return { state, valid, trunk, legL, legR, side: this.side };
  }
}
