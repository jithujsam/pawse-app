import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/geist";
import "@fontsource-variable/newsreader/opsz.css";
import "./styles.css";
import { App } from "./App";
import { Capacitor } from "@capacitor/core";
import { boot, flush } from "./store";
import { listenForAuthLinks } from "./deeplink";
import { restoreLook } from "./look";

// Save straight away when the app is hidden or closed, so nothing is lost if the OS kills it.
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") void flush(); });
window.addEventListener("pagehide", () => { void flush(); });

listenForAuthLinks();

/** The launch screen in index.html stays up for a beat, so the mark and name are seen, then fades into the app. */
const LAUNCH_MS = 1500;
function dismissLaunch() {
  const el = document.getElementById("launch");
  if (!el) return;
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 900); }, Math.max(0, LAUNCH_MS - performance.now()));
}

const root = createRoot(document.getElementById("root")!);
if (import.meta.env.DEV && location.hash.startsWith("#gallery")) { document.getElementById("launch")?.remove(); void import("./dev-gallery").then(({ Gallery }) => root.render(<Gallery />)); }
else void restoreLook().finally(() => boot().then((b) => { root.render(<StrictMode><App boot={b} /></StrictMode>); dismissLaunch(); }));

// Offline support for the installed web app. The Android app already ships its files.
if (import.meta.env.PROD && !Capacitor.isNativePlatform() && "serviceWorker" in navigator) {
  window.addEventListener("load", () => { void navigator.serviceWorker.register("./sw.js").catch(() => undefined); });
}
