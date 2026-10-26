import type { Species } from "./types";

/** Which species have a 3D model, and whether this device can draw it. Kept apart from three.js so it loads lazily. */
export type Species3D = "dog" | "cat" | "fox";
export const MODEL: Record<Species3D, string> = { dog: "models/dog.glb", cat: "models/cat.glb", fox: "models/fox.glb" };

/**
 * Each 3D model, named for what it is, so people can pick the one they like. Only the dog has the face rig
 * (eyelids, brows, tongue); the voxel cat and low-poly fox show their mood in how they move.
 */
export const STYLE_3D: Record<Species3D, { label: string; note: string }> = {
  dog: { label: "3D dog with a face", note: "Animated in 3D, with a face that shows how they feel." },
  cat: { label: "Blocky voxel cat", note: "A 3D cat built from little cubes. Its mood shows in how it moves." },
  fox: { label: "Low-poly 3D fox", note: "An angular 3D fox. Its mood shows in how it moves." },
};
/** The Style choice for one species: drawn, or its named 3D model. */
export const styleOptions = (s: Species3D) => [{ value: false, label: "Drawn" }, { value: true, label: STYLE_3D[s].label }];
/** The 3D list with this species turned on or off. */
export const with3D = (list: Species3D[], s: Species3D, on: boolean): Species3D[] => on ? [...new Set([...list, s])] : list.filter((x) => x !== s);
export const has3D = (s: Species): s is Species3D => s in STYLE_3D;

let webgl: boolean | null = null;
export function webglOk(): boolean {
  if (webgl !== null) return webgl;
  try { const c = document.createElement("canvas"); webgl = !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { webgl = false; }
  return webgl;
}

/** What happened the last time a 3D pet tried to draw, for the settings screen. */
let status: "unused" | "ok" | "failed" = "unused";
export const pet3dStatus = () => (webglOk() ? status : "unsupported");
export const markPet3d = (s: "ok" | "failed") => { status = s; };
