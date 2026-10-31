import { createRoot } from "react-dom/client";
import type { Stage } from "@detox/engine";
import type { Mood } from "./Companion";
import type { PetCondition, Species3D } from "./Pet3D";
import { has3D, webglOk } from "./pet3d-support";
import type { Species } from "./types";

/**
 * Pictures of a pet for the home screen widget, taken from the same 3D model the app shows, so the widget has the
 * pet's breed, coat, age, mood and rescue conditions as they are right now. A hidden Pet3D is mounted, left to
 * play its animation, and a few frames of its canvas are saved as PNGs (base64, no data: prefix).
 */
export interface WidgetLook { species: Species; coat?: string; breed?: string; stage: Stage; mood: Mood; age: number; condition?: PetCondition }

const SIZE = 192;
const FRAMES = 6;
const GAP_MS = 170;
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const cache = new Map<string, string[]>();
/** One capture at a time: each is a graphics context of its own. */
let chain: Promise<unknown> = Promise.resolve();

/** Frames for a look, or null when this pet has no 3D model or the phone can't draw it (the widget then keeps its drawn art). */
export function widgetFrames(look: WidgetLook): Promise<string[] | null> {
  if (typeof document === "undefined" || !has3D(look.species) || !webglOk()) return Promise.resolve(null);
  const key = JSON.stringify(look);
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  const run = chain.then(() => capture(look)).then((frames) => {
    if (frames) { cache.set(key, frames); if (cache.size > 24) cache.delete(cache.keys().next().value as string); }
    return frames;
  }, () => null);
  chain = run;
  return run;
}

async function capture(look: WidgetLook): Promise<string[] | null> {
  const { Pet3D } = await import("./Pet3D");
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = `position:fixed;left:0;top:0;width:${SIZE}px;height:${SIZE}px;opacity:0;pointer-events:none;z-index:-1`;
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    const ready = new Promise<boolean>((resolve) => {
      const giveUp = setTimeout(() => resolve(false), 10000);
      root.render(<Pet3D {...look} species={look.species as Species3D} size={SIZE} capture fallback={null}
        onReady={() => { clearTimeout(giveUp); resolve(true); }} onFail={() => { clearTimeout(giveUp); resolve(false); }} />);
    });
    if (!(await ready)) return null;
    await wait(450); // the pose and the first clip settle
    const canvas = host.querySelector("canvas");
    if (!canvas) return null;
    const flat = document.createElement("canvas");
    flat.width = flat.height = SIZE;
    const cx = flat.getContext("2d");
    if (!cx) return null;
    const frames: string[] = [];
    for (let i = 0; i < FRAMES; i++) {
      cx.clearRect(0, 0, SIZE, SIZE);
      cx.drawImage(canvas, 0, 0, SIZE, SIZE);
      frames.push(flat.toDataURL("image/png").split(",")[1] ?? "");
      await wait(GAP_MS);
    }
    return frames.every(Boolean) ? frames : null;
  } finally {
    root.unmount();
    host.remove();
  }
}
