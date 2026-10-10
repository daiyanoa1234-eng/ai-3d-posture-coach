import type { Mode, Level } from "../types";
export const colors: Record<Level, string> = {
  neutral: "#5b6478",
  green: "#2ee6a6",
  orange: "#ffd23f",
  red: "#ff4d6d",
};
export const thresholds: Record<
  Mode,
  {
    orangeIn: number;
    orangeOut: number;
    redIn: number;
    redOut: number;
    kneeMin?: number;
  }
> = {
  forwardBend: { orangeIn: 25, orangeOut: 20, redIn: 50, redOut: 45 },
  squat: { orangeIn: 25, orangeOut: 20, redIn: 50, redOut: 45, kneeMin: 60 },
  lift: { orangeIn: 25, orangeOut: 20, redIn: 45, redOut: 40, kneeMin: 30 },
};
export const dwell: Record<Level, number> = {
  neutral: 0,
  green: 400,
  orange: 250,
  red: 300,
};
export const hints: Record<Mode, Record<Level, string>> = {
  forwardBend: {
    neutral: "全身が映る位置に立ってください",
    green: "ゆっくり前かがみになってみましょう",
    orange: "前かがみが深くなっています",
    red: "ゆっくり体を起こしましょう",
  },
  squat: {
    neutral: "全身が映る位置に立ってください",
    green: "膝と体幹の動きを見比べましょう",
    orange: "胸を起こして、お尻を後ろへ",
    red: "胸を起こして、お尻を後ろへ",
  },
  lift: {
    neutral: "全身が映る位置に立ってください",
    green: "荷物を体に近づけるイメージで",
    orange: "膝と体幹を一緒に動かしましょう",
    red: "膝を曲げて腰を落としましょう",
  },
};
export const labels: Record<Level, string> = {
  neutral: "— 推定待機",
  green: "○ 基準に近い",
  orange: "△ 前傾が大きい",
  red: "！前傾がかなり大きい",
};

// Educational cues explicitly approved in requirements; these do not estimate lumbar load.
export const warnings = {
  orange: { icon: "△", text: "腰に負担がかかりやすい姿勢です" },
  red: {
    icon: "！",
    text: "腰に負担がかかりやすい姿勢が続いています。膝を曲げて体を起こしましょう",
  },
};
