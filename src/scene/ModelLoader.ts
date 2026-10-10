import { Bone, Mesh, MeshStandardMaterial, Group } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { BodyPart } from "../types";
import type { Rig } from "./Mannequin";
import { requiredBones } from "../retarget/skeletonMap";
// Optional Stage B adapter. No GLB is shipped until a licensed model passes real-device validation.
export async function loadModel(url: string): Promise<Rig> {
  const gltf = await new GLTFLoader().loadAsync(url),
    root = new Group(),
    bones = new Map<string, Bone>(),
    materials = new Map<BodyPart, MeshStandardMaterial[]>();
  root.add(gltf.scene);
  gltf.scene.traverse((obj) => {
    if (obj instanceof Bone) bones.set(obj.name, obj);
    if (obj instanceof Mesh) {
      for (const mat of Array.isArray(obj.material)
        ? obj.material
        : [obj.material]) {
        if (
          mat instanceof MeshStandardMaterial &&
          mat.name.startsWith("Mat_")
        ) {
          const part = mat.name.slice(4) as BodyPart;
          const list = materials.get(part) ?? [];
          list.push(mat);
          materials.set(part, list);
        }
      }
    }
  });
  const missing = requiredBones.filter((n) => !bones.has(n));
  if (missing.length)
    throw Error(`GLBの必須ボーンが不足: ${missing.join(", ")}`);
  if (!materials.has("Trunk") || !materials.has("Pelvis"))
    throw Error("GLBの部位別マテリアルが不足しています");
  const rest = new Map([...bones].map(([n, b]) => [n, b.quaternion.clone()]));
  return { root, hips: bones.get("Hips")!, bones, rest, materials };
}
