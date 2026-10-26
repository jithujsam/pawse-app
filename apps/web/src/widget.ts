import { Capacitor, registerPlugin } from "@capacitor/core";
import type { Species } from "./types";

/** What each home screen pet widget shows: one stacked card per pet, with its species and mood. Android only. */
export type WidgetMood = "happy" | "idle" | "sad";
export interface WidgetPet { species: Species; mood: WidgetMood }
interface WidgetPlugin { update(o: { pets: WidgetPet[] }): Promise<void> }
const Widget = registerPlugin<WidgetPlugin>("Widget");

let last = "";
export function updateWidget(pets: WidgetPet[]) {
  if (Capacitor.getPlatform() !== "android") return;
  const key = JSON.stringify(pets);
  if (key === last) return;
  last = key;
  void Widget.update({ pets }).catch(() => undefined);
}

/** The widget opens the app at app.detoxcompanion://open/quick; anyone interested listens for this. */
export const OPEN_QUICK = "companion:open-quick";
