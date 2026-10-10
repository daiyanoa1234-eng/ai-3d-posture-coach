import { beforeEach, expect, it, vi } from "vitest";
import { Camera } from "../src/camera/Camera";
const stop = vi.fn();
const stream = {
  getTracks: () => [{ stop }],
  getVideoTracks: () => [
    { getSettings: () => ({ deviceId: "iphone-external" }) },
  ],
};
const getUserMedia = vi.fn();
const enumerateDevices = vi.fn();
const setItem = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("navigator", {
    mediaDevices: { getUserMedia, enumerateDevices },
  });
  vi.stubGlobal("sessionStorage", {
    getItem: () => "iphone-external",
    setItem,
  });
  getUserMedia.mockResolvedValue(stream);
});
const video = () =>
  ({
    play: vi.fn().mockResolvedValue(undefined),
    srcObject: null,
  }) as unknown as HTMLVideoElement;
it("restores selection, requests exact device, and refreshes permission labels", async () => {
  enumerateDevices
    .mockResolvedValueOnce([
      { kind: "videoinput", deviceId: "iphone-external", label: "" },
    ])
    .mockResolvedValueOnce([
      {
        kind: "videoinput",
        deviceId: "iphone-external",
        label: "iPhone Camera",
      },
      { kind: "audioinput" },
    ]);
  const camera = new Camera(video());
  expect((await camera.devices())[0].label).toBe("");
  await camera.start();
  expect(getUserMedia).toHaveBeenCalledWith(
    expect.objectContaining({
      audio: false,
      video: expect.objectContaining({
        deviceId: { exact: "iphone-external" },
      }),
    }),
  );
  expect(await camera.devices()).toHaveLength(1);
  expect(setItem).toHaveBeenCalledWith(
    "posture-camera-device",
    "iphone-external",
  );
  camera.stop();
  expect(stop).toHaveBeenCalledOnce();
});
it("works with disabled storage and falls back when remembered camera disconnects", async () => {
  vi.stubGlobal("sessionStorage", {
    getItem: () => {
      throw Error("blocked");
    },
    setItem: () => {
      throw Error("blocked");
    },
  });
  const camera = new Camera(video());
  camera.deviceId = "disconnected";
  getUserMedia.mockRejectedValueOnce(
    new DOMException("gone", "OverconstrainedError"),
  );
  await camera.start();
  expect(getUserMedia.mock.calls[1][0].video).toMatchObject({
    facingMode: { ideal: "environment" },
  });
});
it("stops a stream resolved after cancellation", async () => {
  let resolve!: (value: typeof stream) => void;
  getUserMedia.mockReturnValueOnce(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const camera = new Camera(video());
  const pending = camera.start();
  camera.stop();
  resolve(stream);
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  expect(stop).toHaveBeenCalledOnce();
});
