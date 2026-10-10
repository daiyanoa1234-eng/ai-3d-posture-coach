import { it, expect } from "vitest";
import { Quaternion } from "three";
import { createMannequin } from "../src/scene/Mannequin";
import { Retargeter } from "../src/retarget/Retargeter";
import { demoPose } from "../src/app/demoPose";
import type { Confidence } from "../src/types";
const c: Confidence = {
  state: "TRACKING",
  valid: true,
  trunk: 1,
  legL: 1,
  legR: 1,
  side: "left",
};
it("squats with positive knee flexion and a lower pelvis while retaining bone lengths", () => {
  const rig = createMannequin(),
    r = new Retargeter(rig),
    f = demoPose(Math.PI * 1000, "squat"),
    restHeight = rig.hips.position.y;
  const bone = rig.bones.get("LeftLeg")!,
    length = bone.position.length();
  r.update(f, c, null, false);
  for (let i = 0; i < 120; i++) r.render(1 / 60, i * 16.67);
  expect(bone.quaternion.x).toBeGreaterThan(0.1);
  expect(
    (bone.quaternion.angleTo(new Quaternion()) * 180) / Math.PI,
  ).toBeLessThanOrEqual(150);
  expect(rig.hips.position.y).toBeLessThan(restHeight - 0.1);
  expect(bone.position.length()).toBeCloseTo(length);
});
it("freezes during confidence grace and returns to neutral after loss", () => {
  const rig = createMannequin(),
    r = new Retargeter(rig);
  r.update(demoPose(Math.PI * 1000, "forwardBend"), c, null, false);
  r.render(1 / 60, 0);
  const before = rig.bones.get("Spine")!.quaternion.clone();
  r.update(
    { ...demoPose(100, "forwardBend"), image: [], world: [] },
    { ...c, state: "PARTIAL", valid: false },
    null,
    false,
  );
  r.render(1 / 60, 200);
  expect(rig.bones.get("Spine")!.quaternion.angleTo(before)).toBeCloseTo(0);
  r.update(
    { ...demoPose(600, "forwardBend"), image: [], world: [] },
    { ...c, state: "LOST", valid: false },
    null,
    false,
  );
  for (let i = 0; i < 120; i++) r.render(1 / 60, 600 + i * 16.67);
  expect(
    rig.bones.get("Spine")!.quaternion.angleTo(new Quaternion()),
  ).toBeLessThan(0.001);
});
