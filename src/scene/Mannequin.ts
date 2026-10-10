import {
  Bone,
  CapsuleGeometry,
  SphereGeometry,
  Mesh,
  MeshStandardMaterial,
  Group,
  Vector3,
  Quaternion,
} from "three";
import type { BodyPart } from "../types";
export interface Rig {
  root: Group;
  hips: Bone;
  bones: Map<string, Bone>;
  rest: Map<string, Quaternion>;
  materials: Map<BodyPart, MeshStandardMaterial[]>;
}
export function createMannequin(): Rig {
  const root = new Group(),
    bones = new Map<string, Bone>(),
    rest = new Map<string, Quaternion>(),
    materials = new Map<BodyPart, MeshStandardMaterial[]>();
  const bone = (name: string, parent: Bone | Group, pos: Vector3) => {
    const b = new Bone();
    b.name = name;
    b.position.copy(pos);
    parent.add(b);
    bones.set(name, b);
    return b;
  };
  const material = (part: BodyPart) => {
    const m = new MeshStandardMaterial({
      color: 0x197a9c,
      emissive: 0x3ad6ff,
      emissiveIntensity: 0.18,
      roughness: 0.35,
      metalness: 0.4,
    });
    const list = materials.get(part) ?? [];
    list.push(m);
    materials.set(part, list);
    return m;
  };
  const segment = (b: Bone, dir: Vector3, radius: number, part: BodyPart) => {
    const length = dir.length(),
      mesh = new Mesh(
        new CapsuleGeometry(
          radius,
          Math.max(0.001, length - radius * 2),
          4,
          10,
        ),
        material(part),
      );
    mesh.position.copy(dir).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(
      new Vector3(0, 1, 0),
      dir.clone().normalize(),
    );
    b.add(mesh);
    const joint = new Mesh(
      new SphereGeometry(radius * 1.05, 10, 8),
      material(part),
    );
    b.add(joint);
  };
  const hips = bone("Hips", root, new Vector3(0, 0.98, 0));
  segment(hips, new Vector3(0, 0.1, 0), 0.11, "Pelvis");
  const spine = bone("Spine", hips, new Vector3(0, 0.1, 0));
  segment(spine, new Vector3(0, 0.14, 0), 0.105, "Trunk");
  const spine1 = bone("Spine1", spine, new Vector3(0, 0.14, 0));
  segment(spine1, new Vector3(0, 0.14, 0), 0.125, "Trunk");
  const spine2 = bone("Spine2", spine1, new Vector3(0, 0.14, 0));
  segment(spine2, new Vector3(0, 0.14, 0), 0.14, "Trunk");
  const neck = bone("Neck", spine2, new Vector3(0, 0.14, 0));
  segment(neck, new Vector3(0, 0.07, 0), 0.04, "Head");
  const head = bone("Head", neck, new Vector3(0, 0.09, 0));
  const skull = new Mesh(new SphereGeometry(0.1, 18, 14), material("Head"));
  skull.scale.set(0.9, 1.18, 0.95);
  skull.position.y = 0.07;
  head.add(skull);
  const visor = new Mesh(
    new CapsuleGeometry(0.025, 0.09, 4, 10),
    new MeshStandardMaterial({
      color: 0x3ad6ff,
      emissive: 0x3ad6ff,
      emissiveIntensity: 0.6,
    }),
  );
  visor.rotation.z = Math.PI / 2;
  visor.position.set(0, 0.09, 0.083);
  head.add(visor);
  for (const [side, sign, suffix] of [
    ["Left", -1, "L"],
    ["Right", 1, "R"],
  ] as const) {
    const shoulder = bone(
      `${side}Shoulder`,
      spine2,
      new Vector3(sign * 0.13, 0.1, 0),
    );
    const arm = bone(`${side}Arm`, shoulder, new Vector3(sign * 0.06, 0, 0));
    segment(arm, new Vector3(0, -0.27, 0), 0.043, `UpperArm${suffix}`);
    const forearm = bone(`${side}ForeArm`, arm, new Vector3(0, -0.27, 0));
    segment(forearm, new Vector3(0, -0.25, 0), 0.034, `Forearm${suffix}`);
    bone(`${side}Hand`, forearm, new Vector3(0, -0.25, 0));
    const thigh = bone(
      `${side}UpLeg`,
      hips,
      new Vector3(sign * 0.09, -0.04, 0),
    );
    segment(thigh, new Vector3(0, -0.43, 0), 0.064, `Thigh${suffix}`);
    const leg = bone(`${side}Leg`, thigh, new Vector3(0, -0.43, 0));
    segment(leg, new Vector3(0, -0.43, 0), 0.043, `Shin${suffix}`);
    const foot = bone(`${side}Foot`, leg, new Vector3(0, -0.43, 0));
    segment(foot, new Vector3(0, -0.035, 0.14), 0.04, `Foot${suffix}`);
    bone(`${side}ToeBase`, foot, new Vector3(0, -0.035, 0.14));
  }
  bones.forEach((b, name) => rest.set(name, b.quaternion.clone()));
  root.updateMatrixWorld(true);
  return { root, hips, bones, rest, materials };
}
