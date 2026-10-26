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

const root = createRoot(document.getElementById("root")!);
// Developer pages, only in a dev build: the art gallery (#gallery) and the read-only copy inspector (#copy).
if (import.meta.env.DEV && location.hash.startsWith("#copy")) { document.getElementById("launch")?.remove(); void import("./text/Inspector").then(({ CopyInspector }) => root.render(<CopyInspector />)); }
else if (import.meta.env.DEV && location.hash.startsWith("#gallery")) { void import("./dev-gallery").then(({ Gallery }) => root.render(<Gallery />)); }
else void restoreLook().finally(() => boot().then((b) => { root.render(<StrictMode><App boot={b} /></StrictMode>); }));

// Offline support for the installed web app. The Android app already ships its files.
if (import.meta.env.PROD && !Capacitor.isNativePlatform() && "serviceWorker" in navigator) {
  window.addEventListener("load", () => { void navigator.serviceWorker.register("./sw.js").catch(() => undefined); });
}
