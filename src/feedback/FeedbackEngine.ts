import type {
  Confidence,
  JointAngles,
  Mode,
  FeedbackState,
  Level,
} from "../types";
import { Hysteresis } from "./Hysteresis";
import { thresholds, hints, dwell } from "./feedbackConfig";
export function candidateLevel(
  current: Level,
  angle: number,
  knee: number | null,
  mode: Mode,
): Level {
  const t = thresholds[mode],
    redAllowed = t.kneeMin === undefined || (knee !== null && knee < t.kneeMin);
  if (current === "red")
    return angle >= t.redOut && redAllowed
      ? "red"
      : angle < t.orangeOut
        ? "green"
        : "orange";
  if (angle >= t.redIn && redAllowed) return "red";
  if (current === "orange") return angle < t.orangeOut ? "green" : "orange";
  return angle >= t.orangeIn ? "orange" : "green";
}
export class FeedbackEngine {
  private hysteresis = new Hysteresis();
  reset() {
    this.hysteresis.reset();
  }
  update(
    a: JointAngles,
    c: Confidence,
    mode: Mode,
    now: number,
  ): FeedbackState {
    if (!c.valid || a.trunkFlexion === null) {
      this.reset();
      return {
        level: "neutral",
        message: hints[mode].neutral,
        legPulse: false,
        partial: true,
      };
    }
    const level = this.hysteresis.update(
      candidateLevel(
        this.hysteresis.level,
        a.trunkFlexion,
        a.kneeFlexion,
        mode,
      ),
      now,
      dwell,
    );
    return {
      level,
      message:
        c.state === "PARTIAL" ? "足元まで映してください" : hints[mode][level],
      partial: c.state === "PARTIAL",
      legPulse:
        c.state === "TRACKING" &&
        mode !== "forwardBend" &&
        a.trunkFlexion >= thresholds[mode].orangeIn &&
        a.kneeFlexion !== null &&
        a.kneeFlexion < (thresholds[mode].kneeMin ?? 0),
    };
  }
}
