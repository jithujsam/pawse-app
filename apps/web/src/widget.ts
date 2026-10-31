import { Capacitor, registerPlugin } from "@capacitor/core";
import type { Species } from "./types";

/** What each home screen pet widget shows: one card per pet, with its species, mood and name. Android only. */
export type WidgetMood = "happy" | "idle" | "sad";
/** `name` is left out while the app is locked, so no name sits outside the PIN. */
/** `breed` picks the breed's own widget art (a Husky is not drawn as a Shiba Inu). */
export interface WidgetPet { species: Species; breed?: string; mood: WidgetMood; name?: string }
interface WidgetPlugin { update(o: { pets: WidgetPet[]; day: string }): Promise<void> }
const Widget = registerPlugin<WidgetPlugin>("Widget");

let last = "";
/** `day` is the app's today: after midnight the widgets show the pets idle until the app sends new moods. */
export function updateWidget(pets: WidgetPet[], day: string) {
  if (Capacitor.getPlatform() !== "android") return;
  const key = JSON.stringify([pets, day]);
  if (key === last) return;
  last = key;
  void Widget.update({ pets, day }).catch(() => undefined);
}

/** The widget opens the app at app.detoxcompanion://open/quick; anyone interested listens for this. */
export const OPEN_QUICK = "companion:open-quick";
