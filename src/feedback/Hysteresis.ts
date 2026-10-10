import type { Level } from "../types";
export class Hysteresis {
  level: Level = "green";
  private pending: Level | null = null;
  private since = 0;
  reset() {
    this.level = "green";
    this.pending = null;
  }
  update(candidate: Level, now: number, dwell: Record<Level, number>): Level {
    if (candidate === this.level) {
      this.pending = null;
      return this.level;
    }
    if (candidate !== this.pending) {
      this.pending = candidate;
      this.since = now;
    }
    const duration =
      this.level === "red" && candidate === "orange" ? 400 : dwell[candidate];
    if (now - this.since >= duration) {
      this.level = candidate;
      this.pending = null;
    }
    return this.level;
  }
}
