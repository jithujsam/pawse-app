import type { CSSProperties } from "react";
import type { Scene } from "../scene";

const rnd = (i: number, k: number) => ((Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1;

/** The few particles that carry the weather inside the pet's card: rain, golden motes, night fireflies. At most 24. */
export function heroWeather(scene: Scene): { cls: string; style: CSSProperties }[] {
  const out: { cls: string; style: CSSProperties }[] = [];
  for (let i = 0; i < scene.rain; i++) out.push({ cls: "wx-rain", style: { left: `${rnd(i, 1) * 100}%`, animationDelay: `${-rnd(i, 2) * 1.6}s`, animationDuration: `${1.1 + rnd(i, 3) * 0.7}s` } });
  const fair = scene.mood === "clear" || scene.mood === "golden";
  if (fair && scene.time === "night") for (let i = 0; i < 6; i++) out.push({ cls: "wx-firefly", style: { left: `${12 + rnd(i, 4) * 76}%`, top: `${30 + rnd(i, 5) * 40}%`, animationDelay: `${-rnd(i, 6) * 5}s` } });
  else if (scene.mood === "golden") for (let i = 0; i < 8; i++) out.push({ cls: "wx-mote", style: { left: `${8 + rnd(i, 9) * 84}%`, top: `${25 + rnd(i, 10) * 45}%`, animationDelay: `${-rnd(i, 11) * 9}s` } });
  return out.slice(0, 24);
}
