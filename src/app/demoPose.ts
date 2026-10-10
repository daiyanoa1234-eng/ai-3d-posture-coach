import type { Mode, PoseFrame, Landmark } from "../types";
// Synthetic positions used exclusively in the explicitly labelled camera-free demo.
export function demoPose(now: number, mode: Mode): PoseFrame {
  const t = (Math.sin(now / 2000) + 1) / 2,
    bend = (mode === "squat" ? 0.3 : 1) * t * 1.2,
    knee = mode === "forwardBend" ? 0 : mode === "squat" ? t * 1.4 : t * 0.8;
  const hip = { x: 0, y: 0, z: 0 },
    shoulder = { x: 0, y: -Math.cos(bend) * 0.5, z: -Math.sin(bend) * 0.5 };
  const upper = { x: 0, y: Math.cos(knee) * 0.43, z: -Math.sin(knee) * 0.43 };
  const ankle = {
    x: 0,
    y: upper.y + Math.cos(knee) * 0.43,
    z: upper.z + Math.sin(knee) * 0.43,
  };
  const world: Landmark[] = Array.from({ length: 33 }, () => ({
    x: 0,
    y: 0,
    z: 0,
    visibility: 0.98,
    presence: 0.98,
  }));
  for (const [o, x] of [
    [0, -0.1],
    [1, 0.1],
  ]) {
    world[11 + o] = { ...shoulder, x: x * 1.5, visibility: 0.98 };
    world[23 + o] = { ...hip, x, visibility: 0.98 };
    world[25 + o] = { ...upper, x, visibility: 0.98 };
    world[27 + o] = { ...ankle, x, visibility: 0.98 };
    world[13 + o] = {
      ...shoulder,
      x: x * 1.8,
      y: shoulder.y + 0.27,
      visibility: 0.98,
    };
    world[15 + o] = {
      ...shoulder,
      x: x * 1.9,
      y: shoulder.y + 0.52,
      visibility: 0.98,
    };
    world[7 + o] = {
      ...shoulder,
      x: x * 0.5,
      y: shoulder.y - 0.18,
      visibility: 0.98,
    };
    world[29 + o] = { ...ankle, x, visibility: 0.98 };
    world[31 + o] = { ...ankle, x, z: ankle.z - 0.14, visibility: 0.98 };
  }
  world[0] = { ...shoulder, y: shoulder.y - 0.2, visibility: 0.98 };
  const image = world.map((p) => ({
    ...p,
    x: 0.45 - p.z * 0.48 + p.x * 0.06,
    y: 0.49 + p.y * 0.5,
  }));
  return {
    world,
    image,
    timestampMs: now,
    videoSize: { width: 640, height: 480 },
    inferenceMs: 0,
  };
}
