import type {
  PoseFrame,
  V2,
  Calibration,
  Confidence,
  JointAngles,
} from "../types";
export function angleBetween(a: V2, b: V2): number {
  const n = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y);
  if (n < 1e-6) return NaN;
  return (
    (Math.acos(Math.max(-1, Math.min(1, (a.x * b.x + a.y * b.y) / n))) * 180) /
    Math.PI
  );
}
export function signedAngle(from: V2, to: V2): number {
  const d =
    ((Math.atan2(to.y, to.x) - Math.atan2(from.y, from.x)) * 180) / Math.PI;
  return ((d + 540) % 360) - 180;
}
export function flexion(a: V2, b: V2, c: V2) {
  return (
    180 -
    angleBetween({ x: a.x - b.x, y: a.y - b.y }, { x: c.x - b.x, y: c.y - b.y })
  );
}
export function pixelPoint(frame: PoseFrame, index: number): V2 {
  const p = frame.image[index];
  return { x: p.x * frame.videoSize.width, y: p.y * frame.videoSize.height };
}
export function trunkVector(frame: PoseFrame, side: Confidence["side"]): V2 {
  const s = pixelPoint(frame, side === "left" ? 11 : 12),
    h = pixelPoint(frame, side === "left" ? 23 : 24);
  // Use the visible side: averaging an occluded far shoulder creates false angles.
  return { x: s.x - h.x, y: s.y - h.y };
}
export function calculateAngles(
  frame: PoseFrame,
  conf: Confidence,
  baseline: Calibration | null,
  front = false,
): JointAngles {
  const empty: JointAngles = {
    trunkFlexion: null,
    hipFlexion: null,
    kneeFlexion: null,
    quality: front ? "reference" : baseline ? "calibrated" : "uncalibrated",
  };
  if (!conf.valid || frame.image.length < 33) return empty;
  const o = conf.side === "left" ? 0 : 1;
  const a = pixelPoint(frame, 11 + o),
    b = pixelPoint(frame, 23 + o),
    c = pixelPoint(frame, 25 + o),
    d = pixelPoint(frame, 27 + o);
  const safe = (v: number) => (Number.isFinite(v) ? v : null);
  if (front && frame.world.length === 33) {
    const s = frame.world[11 + o],
      h = frame.world[23 + o],
      k = frame.world[25 + o],
      ank = frame.world[27 + o];
    const difference = (
      a: { x: number; y: number; z: number },
      b: { x: number; y: number; z: number },
    ) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
    const angle3 = (
      a: { x: number; y: number; z: number },
      b: { x: number; y: number; z: number },
    ) => {
      const n = Math.hypot(a.x, a.y, a.z) * Math.hypot(b.x, b.y, b.z);
      return n < 1e-6
        ? NaN
        : (Math.acos(
            Math.max(-1, Math.min(1, (a.x * b.x + a.y * b.y + a.z * b.z) / n)),
          ) *
            180) /
            Math.PI;
    };
    return {
      ...empty,
      trunkFlexion: safe(
        angle3(difference(s, h), baseline?.trunkVec3D ?? { x: 0, y: -1, z: 0 }),
      ),
      hipFlexion:
        conf.state === "PARTIAL"
          ? null
          : safe(180 - angle3(difference(s, h), difference(k, h))),
      kneeFlexion:
        conf.state === "PARTIAL"
          ? null
          : safe(180 - angle3(difference(h, k), difference(ank, k))),
    };
  }
  return {
    ...empty,
    trunkFlexion: safe(
      Math.abs(
        signedAngle(
          baseline?.trunkVec2D ?? { x: 0, y: -1 },
          trunkVector(frame, conf.side),
        ),
      ),
    ),
    hipFlexion: conf.state === "PARTIAL" ? null : safe(flexion(a, b, c)),
    kneeFlexion: conf.state === "PARTIAL" ? null : safe(flexion(b, c, d)),
  };
}
