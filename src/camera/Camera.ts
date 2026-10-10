export class Camera {
  private stream: MediaStream | null = null;
  private generation = 0;
  facing: "user" | "environment" = "environment";
  deviceId = "";
  private readonly storageKey = "posture-camera-device";
  constructor(readonly video: HTMLVideoElement) {
    try {
      this.deviceId = sessionStorage.getItem(this.storageKey) ?? "";
    } catch {
      /* Storage may be disabled. */
    }
    video.muted = true;
    video.playsInline = true;
  }
  async start(deviceId = this.deviceId) {
    this.stop();
    const generation = this.generation;
    if (!navigator.mediaDevices?.getUserMedia)
      throw Error(
        "HTTPSまたはlocalhostで開いてください。カメラ対応ブラウザが必要です。",
      );
    this.deviceId = deviceId;
    const constraints: MediaStreamConstraints = {
      audio: false,
      video: {
        ...(deviceId
          ? { deviceId: { exact: deviceId } }
          : { facingMode: { ideal: this.facing } }),
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 30, max: 30 },
      },
    };
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      if (generation !== this.generation) throw error;
      if (
        !deviceId ||
        !(error instanceof DOMException) ||
        !["NotFoundError", "OverconstrainedError"].includes(error.name)
      )
        throw error;
      this.deviceId = "";
      stream = await navigator.mediaDevices.getUserMedia({
        ...constraints,
        video: {
          facingMode: { ideal: this.facing },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });
    }
    if (generation !== this.generation) {
      stream.getTracks().forEach((t) => t.stop());
      throw new DOMException("カメラ起動を中止しました", "AbortError");
    }
    this.stream = stream;
    this.deviceId =
      stream.getVideoTracks()[0]?.getSettings().deviceId ?? this.deviceId;
    try {
      sessionStorage.setItem(this.storageKey, this.deviceId);
    } catch {
      /* Memory-only selection. */
    }
    this.video.srcObject = stream;
    try {
      await this.video.play();
    } catch (error) {
      this.stop();
      throw error;
    }
  }
  stop() {
    this.generation++;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
  }
  async devices() {
    return (await navigator.mediaDevices.enumerateDevices()).filter(
      (d) => d.kind === "videoinput",
    );
  }
}
export function cameraError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError")
    return "カメラが許可されていません。アドレスバーのサイト設定でカメラを許可して、再試行してください。";
  if (name === "NotFoundError")
    return "カメラが見つかりません。接続を確認して再試行してください。";
  if (name === "NotReadableError")
    return "カメラを使用できません。他のアプリでカメラを使っている場合は閉じてください。";
  return error instanceof Error
    ? error.message
    : "カメラを起動できませんでした。再試行してください。";
}
