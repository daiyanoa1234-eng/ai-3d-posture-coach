import { Quaternion, Vector3, Matrix4 } from "three";
import type { V3 } from "../types";
import { appConfig } from "../config/appConfig";
export const toThree = (p: V3, mirror = false) =>
  new Vector3(
    p.x * appConfig.axisSign.x * (mirror ? -1 : 1),
    p.y * appConfig.axisSign.y,
    p.z * appConfig.axisSign.z,
  );
export function basisQuat(up: Vector3, right: Vector3): Quaternion {
  if (up.lengthSq() < 1e-10) return new Quaternion();
  const y = up.clone().normalize();
  const z = new Vector3().crossVectors(right, y);
  if (z.lengthSq() < 1e-10)
    z.crossVectors(
      Math.abs(y.x) < 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 0, 1),
      y,
    );
  z.normalize();
  const x = new Vector3().crossVectors(y, z).normalize();
  return new Quaternion().setFromRotationMatrix(
    new Matrix4().makeBasis(x, y, z),
  );
}
export function basisDelta(
  up: Vector3,
  right: Vector3,
  restUp = new Vector3(0, 1, 0),
  restRight = new Vector3(1, 0, 0),
) {
  return basisQuat(up, right).multiply(basisQuat(restUp, restRight).invert());
}
export function hingeClamp(
  q: Quaternion,
  axis: Vector3,
  minDeg: number,
  maxDeg: number,
): Quaternion {
  const a = axis.clone().normalize();
  let twist = new Quaternion(
    a.x * (q.x * a.x + q.y * a.y + q.z * a.z),
    a.y * (q.x * a.x + q.y * a.y + q.z * a.z),
    a.z * (q.x * a.x + q.y * a.y + q.z * a.z),
    q.w,
  );
  if (twist.lengthSq() < 1e-10) return new Quaternion();
  twist = twist.normalize();
  let angle =
    2 * Math.atan2(new Vector3(twist.x, twist.y, twist.z).dot(a), twist.w);
  if (angle > Math.PI) angle -= 2 * Math.PI;
  if (angle < -Math.PI) angle += 2 * Math.PI;
  return new Quaternion().setFromAxisAngle(
    a,
    (Math.max(minDeg, Math.min(maxDeg, (angle * 180) / Math.PI)) * Math.PI) /
      180,
  );
}
export function clampRotation(q: Quaternion, maxDeg: number): Quaternion {
  const out = q.clone().normalize(),
    angle = out.angleTo(new Quaternion()),
    max = (maxDeg * Math.PI) / 180;
  return angle > max ? new Quaternion().slerp(out, max / angle) : out;
}
export function aimLocal(
  restDir: Vector3,
  targetDirWorld: Vector3,
  parentWorld: Quaternion,
  restQ = new Quaternion(),
): Quaternion {
  if (targetDirWorld.lengthSq() < 1e-10) return restQ.clone();
  return new Quaternion()
    .setFromUnitVectors(
      restDir.clone().normalize(),
      targetDirWorld
        .clone()
        .applyQuaternion(parentWorld.clone().invert())
        .normalize(),
    )
    .multiply(restQ);
}
