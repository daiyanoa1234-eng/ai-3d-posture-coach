import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  AmbientLight,
  DirectionalLight,
  GridHelper,
  Mesh,
  CircleGeometry,
  MeshBasicMaterial,
  Color,
  ArrowHelper,
  Vector3,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createMannequin } from "./Mannequin";
import { Retargeter } from "../retarget/Retargeter";
import type { FeedbackState } from "../types";
import { colors } from "../feedback/feedbackConfig";
export class Scene3D {
  readonly rig = createMannequin();
  readonly retargeter = new Retargeter(this.rig);
  readonly renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(38, 1, 0.01, 100);
  private controls: OrbitControls;
  private arrows: ArrowHelper[] = [];
  private feedback: FeedbackState = {
    level: "neutral",
    message: "",
    legPulse: false,
    partial: false,
  };
  constructor(
    private host: HTMLElement,
    debug = false,
  ) {
    this.renderer = new WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "low-power",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    host.prepend(this.renderer.domElement);
    this.scene.add(this.rig.root, new AmbientLight(0xb2e8ff, 2.2));
    const light = new DirectionalLight(0xffffff, 3);
    light.position.set(2, 4, 3);
    this.scene.add(light);
    const grid = new GridHelper(5, 32, 0x255779, 0x152b46);
    this.scene.add(grid);
    const disc = new Mesh(
      new CircleGeometry(0.7, 64),
      new MeshBasicMaterial({
        color: 0x123b51,
        transparent: true,
        opacity: 0.25,
      }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.005;
    this.scene.add(disc);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0.9, 0);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 1.8;
    this.controls.maxDistance = 6;
    this.view("angle");
    if (debug)
      for (const name of [
        "Hips",
        "Spine",
        "Spine1",
        "Spine2",
        "LeftUpLeg",
        "LeftLeg",
      ]) {
        const a = new ArrowHelper(
          new Vector3(0, 1, 0),
          new Vector3(),
          0.18,
          0xffe285,
        );
        a.name = name;
        this.scene.add(a);
        this.arrows.push(a);
      }
    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
  }
  view(view: "angle" | "side" | "front") {
    this.camera.position.set(
      ...((view === "angle"
        ? [2.4, 1.8, 3.5]
        : view === "side"
          ? [4, 1.4, 0]
          : [0, 1.4, 4]) as [number, number, number]),
    );
    this.controls.update();
  }
  private resize() {
    const w = this.host.clientWidth,
      h = this.host.clientHeight;
    if (w && h) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    }
  }
  setFeedback(f: FeedbackState) {
    this.feedback = f;
  }
  render(dt: number, now: number) {
    this.retargeter.render(dt, now);
    this.rig.materials.forEach((list, part) => {
      const leg = part.startsWith("Thigh") || part.startsWith("Shin");
      const level =
        part === "Trunk" || part === "Pelvis"
          ? this.feedback.level
          : leg && (this.feedback.partial || this.feedback.level === "neutral")
            ? "neutral"
            : leg && this.feedback.legPulse
              ? "orange"
              : null;
      const target = new Color(level ? colors[level] : "#3ad6ff");
      for (const m of list) {
        m.color.lerp(target, Math.min(1, dt * 8));
        m.emissive.lerp(target, Math.min(1, dt * 8));
        m.emissiveIntensity =
          leg && this.feedback.legPulse
            ? 0.2 + 0.15 * (1 + Math.sin((now / 1000) * Math.PI * 2))
            : 0.17;
      }
    });
    for (const a of this.arrows) {
      const b = this.rig.bones.get(a.name)!;
      a.position.copy(b.getWorldPosition(new Vector3()));
      a.setDirection(
        new Vector3(0, b.name.includes("Leg") ? -1 : 1, 0)
          .applyQuaternion(b.getWorldQuaternion(b.quaternion.clone()))
          .normalize(),
      );
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    const anchor = this.rig.bones
      .get("Spine2")!
      .getWorldPosition(new Vector3());
    anchor.x += 0.24;
    anchor.project(this.camera);
    return {
      x: (anchor.x * 0.5 + 0.5) * this.host.clientWidth,
      y: (-anchor.y * 0.5 + 0.5) * this.host.clientHeight,
    };
  }
}
