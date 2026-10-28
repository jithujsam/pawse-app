import type { Species } from "./types";

/** Which species have a 3D model, and whether this device can draw it. Kept apart from three.js so it loads lazily. */
export type Species3D = "dog" | "cat" | "fox";
export const MODEL: Record<Species3D, string> = { dog: "models/dog.glb", cat: "models/cat.glb", fox: "models/fox.glb" };
/** The model for a species, and for a dog, its breed. Breeds share the Shiba Inu rig and clips. */
export const modelFor = (species: Species3D, breed?: string): string => (species === "dog" && breed === "husky" ? "models/husky.glb" : MODEL[species]);

/**
 * Every pet is 3D, each model named for what it is. Only the dog has the face rig (eyelids, brows, tongue);
 * the voxel cat and the fox show their mood in how they move. The drawing is shown only where 3D can't run.
 */
export const STYLE_3D: Record<Species3D, { label: string; note: string }> = {
  dog: { label: "3D dog", note: "A 3D dog with a face that shows how they feel." },
  cat: { label: "Blocky voxel cat", note: "A 3D cat built from little cubes. Its mood shows in how it moves." },
  fox: { label: "3D fox", note: "A 3D fox. Its mood shows in how it moves." },
};
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
