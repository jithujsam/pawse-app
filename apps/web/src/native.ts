import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { Keyboard } from "@capacitor/keyboard";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";

const native = Capacitor.isNativePlatform();

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

/**
 * Keeps the field being typed in above the keyboard. Edge-to-edge Android doesn't resize the web view for the
 * keyboard, so the keyboard would cover the bottom of the screen (the password field on sign-in). This sets --kb to
 * the part of the keyboard that still covers the view (zero where the view did resize), which the styles turn into
 * room at the bottom of screens and sheets, then scrolls the focused field into view, also when moving between fields.
 */
export function listenForKeyboard() {
  if (!native) return;
  const root = document.documentElement;
  let before = window.innerHeight;
  const reveal = () => {
    const el = document.activeElement as HTMLElement | null;
    if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) el.scrollIntoView({ block: "center", behavior: "smooth" });
  };
  void Keyboard.addListener("keyboardWillShow", () => { before = window.innerHeight; root.dataset.keyboard = "open"; });
  void Keyboard.addListener("keyboardDidShow", (info) => {
    const shrunk = Math.max(0, before - window.innerHeight);
    root.style.setProperty("--kb", `${Math.max(0, Math.round(info.keyboardHeight - shrunk))}px`);
    requestAnimationFrame(reveal);
  });
  void Keyboard.addListener("keyboardWillHide", () => { delete root.dataset.keyboard; root.style.setProperty("--kb", "0px"); });
  document.addEventListener("focusin", () => { if (root.dataset.keyboard === "open") setTimeout(reveal, 50); });
}
