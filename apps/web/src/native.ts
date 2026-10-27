import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { Keyboard } from "@capacitor/keyboard";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";

export const native = Capacitor.isNativePlatform();

/** Lifts the launch splash. Called once the first screen is on its way, or if starting up failed, so it never sticks. */
export function hideSplash() {
  if (native) void SplashScreen.hide({ fadeOutDuration: 180 }).catch(() => undefined);
}

/** System bar icons: light icons over a dark page, dark icons over a light one. */
export function setBarStyle(dark: boolean) {
  if (native) void StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => undefined);
}

/** Opens a web link in the phone's browser (a Custom Tab), so people stay one back-press from the app. */
export function openExternal(url: string) {
  if (native) void Browser.open({ url }).catch(() => undefined);
  else window.open(url, "_blank", "noopener,noreferrer");
}

/** Keeps the field being typed in above the keyboard. The plugin resizes the view; this scrolls the field into it. */
export function listenForKeyboard() {
  if (!native) return;
  const root = document.documentElement;
  void Keyboard.addListener("keyboardWillShow", () => { root.dataset.keyboard = "open"; });
  void Keyboard.addListener("keyboardDidShow", () => {
    const el = document.activeElement as HTMLElement | null;
    if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) el.scrollIntoView({ block: "center", behavior: "smooth" });
  });
  void Keyboard.addListener("keyboardWillHide", () => { delete root.dataset.keyboard; });
}
