export class Camera {
  private stream: MediaStream | null = null;
  private generation = 0;
  facing: "user" | "environment" = "environment";
  deviceId = "";
  constructor(readonly video: HTMLVideoElement) {
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
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        ...(deviceId
          ? { deviceId: { exact: deviceId } }
          : { facingMode: { ideal: this.facing } }),
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 30, max: 30 },
      },
    });
    if (generation !== this.generation) {
      stream.getTracks().forEach((t) => t.stop());
      throw new DOMException("カメラ起動を中止しました", "AbortError");
    }
    this.stream = stream;
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
