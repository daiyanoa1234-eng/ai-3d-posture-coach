import type { Landmark } from "../types";
import { CONNECTIONS } from "../pose/landmarks";
export class Overlay {
  constructor(private canvas: HTMLCanvasElement) {}
  clear() {
    this.canvas
      .getContext("2d")
      ?.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
  draw(points: Landmark[], width: number, height: number) {
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    if (points.length < 33) return;
    ctx.strokeStyle = "#3ad6ff";
    ctx.lineWidth = 2.5;
    ctx.fillStyle = "#d3f9ff";
    for (const [a, b] of CONNECTIONS) {
      const p = points[a],
        q = points[b];
      ctx.globalAlpha =
        Math.min(p.visibility, q.visibility) < 0.5 ? 0.18 : 0.85;
      ctx.beginPath();
      ctx.moveTo(p.x * width, p.y * height);
      ctx.lineTo(q.x * width, q.y * height);
      ctx.stroke();
    }
    for (let i = 0; i < points.length; i++) {
      if (i > 0 && i < 7) continue;
      const p = points[i];
      ctx.globalAlpha = p.visibility < 0.5 ? 0.18 : 1;
      ctx.beginPath();
      ctx.arc(p.x * width, p.y * height, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
