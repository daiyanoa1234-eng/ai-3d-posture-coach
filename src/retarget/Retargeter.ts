import { Quaternion, Vector3 } from "three";
import type { Rig } from "../scene/Mannequin";
import type { Calibration, Confidence, PoseFrame } from "../types";
import { pixelPoint, signedAngle, trunkVector } from "../analysis/angles";
import { appConfig } from "../config/appConfig";
import {
  aimLocal,
  basisQuat,
  clampRotation,
  hingeClamp,
  toThree,
} from "./math";
import { armMap, spineNames } from "./skeletonMap";
export class Retargeter {
  private goals = new Map<string, Quaternion>();
  private lostAt: number | null = null;
  private frozen = false;
  constructor(readonly rig: Rig) {}
  freeze() {
    this.goals = new Map(
      [...this.rig.bones].map(([n, b]) => [n, b.quaternion.clone()]),
    );
  }
  neutral(now: number) {
    if (this.lostAt === null) this.lostAt = now;
    this.goals = new Map([...this.rig.rest].map(([n, q]) => [n, q.clone()]));
  }
  update(
    f: PoseFrame,
    c: Confidence,
    cal: Calibration | null,
    mirror: boolean,
  ) {
    if (!c.valid) {
      if (!this.frozen) {
        this.goals = new Map(
          [...this.rig.bones].map(([n, b]) => [n, b.quaternion.clone()]),
        );
        this.frozen = true;
      }
      if (c.state === "LOST") this.neutral(f.timestampMs);
      return;
    }
    if (f.world.length < 33) return;
    this.lostAt = null;
    this.frozen = false;
    const p = f.world.map((v) => toThree(v, mirror));
    const mid = (a: number, b: number) =>
      p[a].clone().add(p[b]).multiplyScalar(0.5);
    const up = mid(11, 12).sub(mid(23, 24));
    let right = p[24].clone().sub(p[23]);
    const hipWidth = Math.hypot(
      (f.image[24].x - f.image[23].x) * f.videoSize.width,
      (f.image[24].y - f.image[23].y) * f.videoSize.height,
    );
    if (cal && hipWidth < cal.shoulderWidthPx * appConfig.rightFallbackRatio)
      right = toThree(cal.rightVec3D, mirror);
    // Remove yaw/twist from the baseline, preserving a stable oblique display.
    const restUp = cal ? toThree(cal.trunkVec3D, mirror) : new Vector3(0, 1, 0);
    const restRight = cal ? toThree(cal.rightVec3D, mirror) : right;
    const baseline = basisQuat(restUp, restRight).invert();
    let delta = baseline.clone().multiply(basisQuat(up, right));
    if (appConfig.retargetMode === "sagittal") {
      const tilt = Math.abs(
        signedAngle(cal?.trunkVec2D ?? { x: 0, y: -1 }, trunkVector(f, c.side)),
      );
      delta = new Quaternion().setFromAxisAngle(
        new Vector3(1, 0, 0),
        (tilt * Math.PI) / 180,
      );
    }
    p.forEach((v) => v.applyQuaternion(baseline));
    spineNames.forEach((name, i) =>
      this.goals.set(
        name,
        clampRotation(
          new Quaternion().slerp(delta, appConfig.spineDistribution[i]),
          i === 0 ? appConfig.limits.thigh : appConfig.limits.spine,
        ),
      ),
    );
    // Distribution is a visual approximation; MediaPipe does not measure lumbar/pelvic load.
    // Compute parent-space goals sequentially using target parents, then restore rendered pose.
    const saved = new Map(
      [...this.rig.bones].map(([n, b]) => [n, b.quaternion.clone()]),
    );
    spineNames.forEach((name) => {
      const b = this.rig.bones.get(name)!;
      b.quaternion.copy(this.goals.get(name)!);
      b.updateMatrixWorld(true);
    });
    for (const side of ["Left", "Right"]) {
      const thigh = this.rig.bones.get(`${side}UpLeg`)!,
        leg = this.rig.bones.get(`${side}Leg`)!;
      if (c.state === "PARTIAL") {
        this.goals.set(thigh.name, this.rig.rest.get(thigh.name)!.clone());
        this.goals.set(leg.name, this.rig.rest.get(leg.name)!.clone());
        continue;
      }
      // Visible-side duplication is the documented fallback for sagittal occlusion.
      const o = c.side === "left" ? 0 : 1;
      let upper = p[25 + o].clone().sub(p[23 + o]),
        lower = p[27 + o].clone().sub(p[25 + o]);
      if (appConfig.retargetMode === "sagittal") {
        const h = pixelPoint(f, 23 + o),
          k = pixelPoint(f, 25 + o),
          a = pixelPoint(f, 27 + o);
        const sign = trunkVector(f, c.side).x >= 0 ? 1 : -1;
        const direction = (v: { x: number; y: number }) => {
          const theta =
            (-signedAngle({ x: 0, y: 1 }, v) * sign * Math.PI) / 180;
          return new Vector3(0, -Math.cos(theta), Math.sin(theta));
        };
        upper = direction({ x: k.x - h.x, y: k.y - h.y });
        lower = direction({ x: a.x - k.x, y: a.y - k.y });
      }
      const parentQ = thigh.parent!.getWorldQuaternion(new Quaternion());
      const tq = clampRotation(
        aimLocal(
          new Vector3(0, -1, 0),
          upper,
          parentQ,
          this.rig.rest.get(thigh.name),
        ),
        appConfig.limits.thigh,
      );
      this.goals.set(thigh.name, tq);
      thigh.quaternion.copy(tq);
      thigh.updateMatrixWorld(true);
      const lq = aimLocal(
        new Vector3(0, -1, 0),
        lower,
        leg.parent!.getWorldQuaternion(new Quaternion()),
        this.rig.rest.get(leg.name),
      );
      // Knees flex backwards around local +X; discard all non-hinge components.
      const kq = hingeClamp(lq, new Vector3(1, 0, 0), 0, appConfig.limits.knee);
      this.goals.set(leg.name, kq);
      leg.quaternion.copy(kq);
      leg.updateMatrixWorld(true);
    }
    for (const m of armMap) {
      const b = this.rig.bones.get(m.bone);
      if (!b) continue;
      if (
        Math.min(f.world[m.from].visibility, f.world[m.to].visibility) <
        appConfig.legConfidence
      ) {
        this.goals.set(m.bone, this.rig.rest.get(m.bone)!.clone());
        continue;
      }
      const q = aimLocal(
        new Vector3(0, -1, 0),
        p[m.to].clone().sub(p[m.from]),
        b.parent!.getWorldQuaternion(new Quaternion()),
        this.rig.rest.get(m.bone),
      );
      this.goals.set(
        m.bone,
        clampRotation(
          q,
          m.bone.includes("ForeArm")
            ? appConfig.limits.elbow
            : appConfig.limits.thigh,
        ),
      );
      b.quaternion.copy(this.goals.get(m.bone)!);
      b.updateMatrixWorld(true);
    }
    saved.forEach((q, n) => this.rig.bones.get(n)!.quaternion.copy(q));
    this.rig.root.updateMatrixWorld(true);
  }
  render(dt: number, now: number) {
    const alpha =
      this.lostAt === null
        ? 1 - Math.pow(1 - appConfig.smoothing.slerpAlpha, dt * 60)
        : Math.min(1, dt * 5);
    for (const [name, bone] of this.rig.bones) {
      let goal = this.goals.get(name);
      if (
        this.lostAt !== null &&
        now - this.lostAt >= appConfig.neutralReturnMs
      )
        goal = this.rig.rest.get(name);
      if (goal) bone.quaternion.slerp(goal, alpha);
      bone.updateMatrixWorld(true);
    }
    const left = this.rig.bones
        .get("LeftFoot")!
        .getWorldPosition(new Vector3()),
      right = this.rig.bones.get("RightFoot")!.getWorldPosition(new Vector3());
    this.rig.hips.position.y +=
      (0.065 - Math.min(left.y, right.y)) * Math.min(1, dt * 10);
    this.rig.root.updateMatrixWorld(true);
  }
}
