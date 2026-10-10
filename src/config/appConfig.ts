export const isMobile = matchMedia("(pointer: coarse)").matches;
const params = new URLSearchParams(
  typeof location === "undefined" ? "" : location.search,
);
const requestedFps = Number(params.get("fps"));
export const appConfig = {
  model:
    params.get("model") === "lite"
      ? ("lite" as const)
      : params.get("model") === "full"
        ? ("full" as const)
        : isMobile
          ? ("lite" as const)
          : ("full" as const),
  maxInferenceFps:
    requestedFps >= 12 && requestedFps <= 30
      ? requestedFps
      : isMobile
        ? 20
        : 30,
  retargetMode:
    params.get("stable") === "1" ? ("sagittal" as const) : ("basis" as const),
  axisSign: { x: 1, y: -1, z: -1 },
  smoothing: {
    minCutoff: 1,
    worldCutoff: 0.7,
    beta: 0.01,
    dCutoff: 1,
    slerpAlpha: 0.35,
  },
  spineDistribution: [0.4, 0.2, 0.2, 0.2],
  lostTimeoutMs: 500,
  neutralReturnMs: 1000,
  trunkConfidence: 0.6,
  legConfidence: 0.5,
  calibration: {
    countdownMs: 3000,
    collectMs: 1500,
    maxStdDeg: 3,
    minSamples: 10,
  },
  rightFallbackRatio: 0.3,
  quality: { lowFps: 12, durationMs: 3000, fallbackFps: 15 },
  benchmarkMs: 30000,
  limits: { thigh: 130, knee: 150, spine: 45, neck: 40, foot: 40, elbow: 145 },
  voiceIntervalMs: 5000,
};
