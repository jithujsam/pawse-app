import type { Species } from "./types";

/** Which species have a 3D model, and whether this device can draw it. Kept apart from three.js so it loads lazily. */
export type Species3D = "dog" | "cat" | "fox";
export const MODEL: Record<Species3D, string> = { dog: "models/dog.glb", cat: "models/cat.glb", fox: "models/fox.glb" };

/**
 * Species that can be shown in 3D. Only the dog has the face rig (eyelids, brows, tongue) that gives the 3D pet
 * its emotions. The free cat model is blocky voxel art that clashes with the others, and the fox has no eye parts to rig.
 */
const ENABLED: Species3D[] = ["dog"];
export const has3D = (s: Species): s is Species3D => (ENABLED as Species[]).includes(s);

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
