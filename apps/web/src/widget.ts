import { Capacitor, registerPlugin } from "@capacitor/core";
import type { Species } from "./types";

/** What each home screen pet widget shows: one stacked card per pet, with its species and mood. Android only. */
export type WidgetMood = "happy" | "idle" | "sad";
export interface WidgetPet { species: Species; mood: WidgetMood }
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
