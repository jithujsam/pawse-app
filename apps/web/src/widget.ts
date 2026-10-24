import { Capacitor, registerPlugin } from "@capacitor/core";
import type { Species } from "./types";

/** The home screen widget's state: species, name and one short line. Android only. */
interface WidgetPlugin { update(o: { species: Species; name: string; line: string; sad: boolean }): Promise<void> }
const Widget = registerPlugin<WidgetPlugin>("Widget");

let last = "";
export function updateWidget(o: { species: Species; name: string; line: string; sad: boolean }) {
  if (Capacitor.getPlatform() !== "android") return;
  const key = JSON.stringify(o);
  if (key === last) return;
  last = key;
  void Widget.update(o).catch(() => undefined);
}

/** The widget opens the app at app.detoxcompanion://open/quick; anyone interested listens for this. */
export const OPEN_QUICK = "companion:open-quick";
