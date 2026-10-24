import type { Species } from "./types";

/** Which species have a 3D model, and whether this device can draw it. Kept apart from three.js so it loads lazily. */
export type Species3D = "dog" | "cat" | "fox";
export const MODEL: Record<Species3D, string> = { dog: "models/dog.glb", cat: "models/cat.glb", fox: "models/fox.glb" };

/** Species shown in 3D. The free cat model is blocky voxel art that clashes with the others, so cats stay 2D. */
const ENABLED: Species3D[] = ["dog", "fox"];
export const has3D = (s: Species): s is Species3D => (ENABLED as Species[]).includes(s);

let webgl: boolean | null = null;
export function webglOk(): boolean {
  if (webgl !== null) return webgl;
  try { const c = document.createElement("canvas"); webgl = !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { webgl = false; }
  return webgl;
}
