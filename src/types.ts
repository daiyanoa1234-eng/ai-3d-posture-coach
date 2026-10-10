export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
  presence?: number;
}
export interface PoseFrame {
  timestampMs: number;
  image: Landmark[];
  world: Landmark[];
  videoSize: { width: number; height: number };
  inferenceMs: number;
}
export type TrackingState = "TRACKING" | "PARTIAL" | "LOST";
export interface Confidence {
  state: TrackingState;
  valid: boolean;
  trunk: number;
  legL: number;
  legR: number;
  side: "left" | "right";
}
export interface V2 {
  x: number;
  y: number;
}
export interface V3 extends V2 {
  z: number;
}
export interface Calibration {
  trunkVec2D: V2;
  trunkVec3D: V3;
  rightVec3D: V3;
  shoulderWidthPx: number;
  createdAt: number;
}
export interface JointAngles {
  trunkFlexion: number | null;
  hipFlexion: number | null;
  kneeFlexion: number | null;
  quality: "calibrated" | "uncalibrated" | "reference";
}
export type Mode = "forwardBend" | "squat" | "lift";
export type Level = "neutral" | "green" | "orange" | "red";
export type BodyPart =
  | "Head"
  | "Trunk"
  | "Pelvis"
  | "ThighL"
  | "ThighR"
  | "ShinL"
  | "ShinR"
  | "FootL"
  | "FootR"
  | "UpperArmL"
  | "UpperArmR"
  | "ForearmL"
  | "ForearmR";
export interface FeedbackState {
  level: Level;
  message: string;
  legPulse: boolean;
  partial: boolean;
}
