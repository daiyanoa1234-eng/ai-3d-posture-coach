import { it, expect, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({
  files: vi.fn(),
  create: vi.fn(),
  detect: vi.fn(),
  close: vi.fn(),
}));
vi.mock("@mediapipe/tasks-vision", () => ({
  FilesetResolver: { forVisionTasks: mocks.files },
  PoseLandmarker: { createFromOptions: mocks.create },
}));
import { PoseEstimator } from "../src/pose/PoseEstimator";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.files.mockResolvedValue({});
  mocks.create.mockResolvedValue({
    detectForVideo: mocks.detect,
    close: mocks.close,
  });
  mocks.detect.mockReturnValue({ landmarks: [], worldLandmarks: [] });
});
it("falls back from GPU to CPU with same-origin assets", async () => {
  mocks.create.mockRejectedValueOnce(Error("GPU unavailable"));
  const p = new PoseEstimator();
  await p.init();
  expect(p.delegate).toBe("CPU");
  expect(mocks.files).toHaveBeenCalledWith(
    expect.stringContaining("mediapipe/wasm"),
  );
  expect(mocks.create.mock.calls[1][1]).toMatchObject({
    baseOptions: { delegate: "CPU" },
    runningMode: "VIDEO",
    numPoses: 1,
  });
});
it("uses monotonically increasing inference timestamps and correct video dimensions", async () => {
  const p = new PoseEstimator();
  await p.init();
  const video = { videoWidth: 640, videoHeight: 480 } as HTMLVideoElement;
  expect(p.detect(video, 100).videoSize).toEqual({ width: 640, height: 480 });
  p.detect(video, 99);
  expect(mocks.detect.mock.calls[1][1]).toBeGreaterThan(
    mocks.detect.mock.calls[0][1],
  );
});
it("closes a task whose initialization was canceled", async () => {
  let resolve!: (value: unknown) => void;
  mocks.create.mockReturnValueOnce(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const p = new PoseEstimator();
  const pending = p.init();
  await vi.waitFor(() => expect(mocks.create).toHaveBeenCalled());
  p.close();
  resolve({ detectForVideo: mocks.detect, close: mocks.close });
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  expect(mocks.close).toHaveBeenCalledOnce();
});
