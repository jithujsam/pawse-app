import { Capacitor, registerPlugin } from "@capacitor/core";
import type { Species } from "./types";

/** What each home screen pet widget shows: one card per pet, with its species, mood and name. Android only. */
export type WidgetMood = "happy" | "idle" | "sad";
/** `name` is left out while the app is locked, so no name sits outside the PIN. */
/** `breed` picks the breed's own widget art (a Husky is not drawn as a Shiba Inu). */
/** `frames` are PNGs (base64) of this pet as it looks now, from the 3D model; `idleFrames` the same pet at rest, shown once the day has turned. */
export interface WidgetPet { species: Species; breed?: string; mood: WidgetMood; name?: string; frames?: string[]; idleFrames?: string[] }
interface WidgetPlugin { update(o: { pets: WidgetPet[]; day: string }): Promise<void> }
const Widget = registerPlugin<WidgetPlugin>("Widget");

let last = "";
/** A cheap fingerprint of a set of frames, so an unchanged widget isn't resent. */
const sig = (f?: string[]) => f?.map((x) => `${x.length}:${x.slice(100, 140)}`).join("|");
/** `day` is the app's today: after midnight the widgets show the pets idle until the app sends new moods. */
export function updateWidget(pets: WidgetPet[], day: string) {
  if (Capacitor.getPlatform() !== "android") return;
  const key = JSON.stringify([pets.map((p) => ({ ...p, frames: sig(p.frames), idleFrames: sig(p.idleFrames) })), day]);
  if (key === last) return;
  last = key;
  void Widget.update({ pets, day }).catch(() => undefined);
}

/** The widget opens the app at app.detoxcompanion://open/quick; anyone interested listens for this. */
export const OPEN_QUICK = "companion:open-quick";
