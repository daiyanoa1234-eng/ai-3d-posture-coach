import { describe, it, expect } from "vitest";
import { Vector3, Quaternion } from "three";
import {
  angleBetween,
  calculateAngles,
  signedAngle,
} from "../src/analysis/angles";
import { angularStd, median } from "../src/analysis/calibration";
import { ConfidenceGate } from "../src/analysis/confidence";
import { OneEuroFilter } from "../src/filter/OneEuroFilter";
import { Hysteresis } from "../src/feedback/Hysteresis";
import { candidateLevel, FeedbackEngine } from "../src/feedback/FeedbackEngine";
import { dwell } from "../src/feedback/feedbackConfig";
import { aimLocal, basisDelta, hingeClamp } from "../src/retarget/math";
import type { PoseFrame, Confidence, Landmark } from "../src/types";
const point = (x: number, y: number, visibility = 1): Landmark => ({
  x,
  y,
  z: 0,
  visibility,
  presence: 1,
});
function frame(): PoseFrame {
  const image = Array.from({ length: 33 }, () => point(0.5, 0.5));
  image[11] = point(0.6, 0.3);
  image[23] = point(0.4, 0.5);
  image[25] = point(0.4, 0.7);
  image[27] = point(0.4, 0.9);
  return {
    timestampMs: 0,
    image,
    world: image,
    videoSize: { width: 640, height: 480 },
    inferenceMs: 1,
  };
}
const confidence: Confidence = {
  state: "TRACKING",
  valid: true,
  trunk: 1,
  legL: 1,
  legR: 1,
  side: "left",
};
describe("angles", () => {
  it("uses pixels rather than normalized coordinates for non-square video", () => {
    const a = calculateAngles(frame(), confidence, null);
    expect(a.trunkFlexion).toBeCloseTo(53.1301, 3);
    expect(a.hipFlexion).toBeCloseTo(53.1301, 3);
    expect(a.kneeFlexion).toBeCloseTo(0);
  });
  it("returns a relative calibrated angle", () => {
    expect(
      calculateAngles(frame(), confidence, {
        trunkVec2D: { x: 128, y: -96 },
        trunkVec3D: { x: 0, y: -1, z: 0 },
        rightVec3D: { x: 1, y: 0, z: 0 },
        shoulderWidthPx: 50,
        createdAt: 0,
      }).trunkFlexion,
    ).toBeCloseTo(0);
  });
  it("handles 30/60/90 degrees and degenerate vectors", () => {
    for (const d of [30, 60, 90])
      expect(
        angleBetween(
          { x: 0, y: -1 },
          {
            x: Math.sin((d * Math.PI) / 180),
            y: -Math.cos((d * Math.PI) / 180),
          },
        ),
      ).toBeCloseTo(d);
    expect(Number.isNaN(angleBetween({ x: 0, y: 0 }, { x: 0, y: 1 }))).toBe(
      true,
    );
  });
  it("removes unavailable lower-body angles", () => {
    const a = calculateAngles(
      frame(),
      { ...confidence, state: "PARTIAL" },
      null,
    );
    expect(a.kneeFlexion).toBeNull();
    expect(a.hipFlexion).toBeNull();
  });
  it("wraps signed angles", () => {
    expect(signedAngle({ x: -1, y: 0.001 }, { x: -1, y: -0.001 })).toBeCloseTo(
      0.11459,
      3,
    );
  });
});
describe("confidence", () => {
  it("freezes immediately and becomes lost after 500ms", () => {
    const g = new ConfidenceGate();
    expect(g.update(frame().image, 0).state).toBe("TRACKING");
    expect(g.update([], 499)).toMatchObject({ valid: false, state: "PARTIAL" });
    expect(g.update([], 500).state).toBe("LOST");
    expect(g.update(frame().image, 501).state).toBe("TRACKING");
  });
  it("distinguishes lower-body occlusion and bounds", () => {
    const f = frame();
    f.image[27].visibility = 0;
    expect(new ConfidenceGate().update(f.image, 0).state).toBe("PARTIAL");
    f.image[11].x = 2;
    f.image[12].visibility = 0;
    expect(new ConfidenceGate().update(f.image, 0).state).toBe("LOST");
  });
  it("honors presence on a visible landmark", () => {
    const f = frame();
    f.image[11].presence = 0;
    f.image[12].presence = 0;
    expect(new ConfidenceGate().update(f.image, 0).valid).toBe(false);
  });
});
describe("filter", () => {
  it("reduces alternating jitter without drifting constant input", () => {
    const f = new OneEuroFilter(1, 0);
    f.filter(1, 0);
    let value = 1;
    for (let i = 1; i < 50; i++)
      value = f.filter(1 + (i % 2 ? 0.1 : -0.1), i * 33);
    expect(Math.abs(value - 1)).toBeLessThan(0.03);
    for (let i = 50; i < 200; i++) value = f.filter(1, i * 33);
    expect(value).toBeCloseTo(1, 5);
  });
  it("handles repeated timestamps and reset", () => {
    const f = new OneEuroFilter();
    expect(f.filter(1, 0)).toBe(1);
    expect(f.filter(100, 0)).toBe(1);
    f.reset();
    expect(f.filter(3, 1)).toBe(3);
  });
});
describe("feedback", () => {
  it("requires dwell and cancels an interrupted transition", () => {
    const h = new Hysteresis();
    expect(h.update("orange", 0, dwell)).toBe("green");
    expect(h.update("orange", 249, dwell)).toBe("green");
    expect(h.update("orange", 250, dwell)).toBe("orange");
    h.update("green", 300, dwell);
    h.update("orange", 699, dwell);
    expect(h.update("green", 700, dwell)).toBe("orange");
    expect(h.update("green", 1100, dwell)).toBe("green");
  });
  it("holds orange at 25-degree jitter and returns below 20", () => {
    const h = new Hysteresis();
    h.update("orange", 0, dwell);
    h.update("orange", 250, dwell);
    for (let t = 300; t < 5300; t += 50)
      expect(
        h.update(
          candidateLevel(
            h.level,
            25 + (t % 100 ? -0.5 : 0.5),
            0,
            "forwardBend",
          ),
          t,
          dwell,
        ),
      ).toBe("orange");
    expect(candidateLevel("orange", 19, 0, "forwardBend")).toBe("green");
  });
  it("only flags lift/squat when knee is available and insufficient", () => {
    expect(candidateLevel("green", 50, 10, "lift")).toBe("red");
    expect(candidateLevel("green", 50, 40, "lift")).toBe("orange");
    expect(candidateLevel("green", 55, null, "lift")).toBe("orange");
    expect(candidateLevel("red", 55, 65, "squat")).toBe("orange");
  });
  it("stops feedback when tracking is unavailable", () => {
    expect(
      new FeedbackEngine().update(
        {
          trunkFlexion: 60,
          hipFlexion: 60,
          kneeFlexion: 0,
          quality: "uncalibrated",
        },
        { ...confidence, valid: false },
        "lift",
        0,
      ).level,
    ).toBe("neutral");
  });
});
describe("retarget math", () => {
  it("splits 90-degree forward bend over four bones", () => {
    const q = basisDelta(new Vector3(0, 0, 1), new Vector3(1, 0, 0));
    const sum = new Quaternion();
    for (const ratio of [0.4, 0.2, 0.2, 0.2])
      sum.multiply(new Quaternion().slerp(q, ratio));
    expect(sum.angleTo(q)).toBeCloseTo(0);
    expect(
      new Vector3(0, 1, 0)
        .applyQuaternion(sum)
        .distanceTo(new Vector3(0, 0, 1)),
    ).toBeLessThan(1e-6);
  });
  it("upright basis is neutral and collinear basis remains finite", () => {
    expect(
      basisDelta(new Vector3(0, 1, 0), new Vector3(1, 0, 0)).angleTo(
        new Quaternion(),
      ),
    ).toBeCloseTo(0);
    const q = basisDelta(new Vector3(0, 1, 0), new Vector3(0, 1, 0));
    expect(q.toArray().every(Number.isFinite)).toBe(true);
  });
  it("aims correctly with an already rotated parent", () => {
    const parent = new Quaternion().setFromAxisAngle(
        new Vector3(0, 0, 1),
        Math.PI / 2,
      ),
      local = aimLocal(new Vector3(0, -1, 0), new Vector3(0, -1, 0), parent);
    expect(
      new Vector3(0, -1, 0)
        .applyQuaternion(local)
        .applyQuaternion(parent)
        .distanceTo(new Vector3(0, -1, 0)),
    ).toBeLessThan(1e-6);
  });
  it("prevents knee extension and caps excessive flexion", () => {
    const axis = new Vector3(1, 0, 0);
    expect(
      hingeClamp(
        new Quaternion().setFromAxisAngle(axis, -0.4),
        axis,
        0,
        150,
      ).angleTo(new Quaternion()),
    ).toBeCloseTo(0);
    expect(
      (hingeClamp(
        new Quaternion().setFromAxisAngle(axis, (170 * Math.PI) / 180),
        axis,
        0,
        150,
      ).angleTo(new Quaternion()) *
        180) /
        Math.PI,
    ).toBeCloseTo(150);
  });
});
describe("calibration", () => {
  it("uses robust median and circular angle variation", () => {
    expect(median([1, 2, 100])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(
      angularStd([
        { x: -1, y: 0.001 },
        { x: -1, y: -0.001 },
      ]),
    ).toBeLessThan(1);
  });
});

describe("front-view reference", () => {
  it("uses world depth and labels the result as reference", () => {
    const f = frame();
    f.world = f.image.map((p) => ({ ...p }));
    f.world[11] = { ...point(0, -0.5), z: -0.5 };
    f.world[23] = point(0, 0);
    const a = calculateAngles(f, confidence, null, true);
    expect(a.trunkFlexion).toBeCloseTo(45);
    expect(a.quality).toBe("reference");
  });
});
