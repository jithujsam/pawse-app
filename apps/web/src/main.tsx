import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/geist";
import "@fontsource-variable/nunito";
import "./styles.css";
import { App } from "./App";
import { boot, flush } from "./store";

// Save straight away when the app is hidden or closed, so nothing is lost if the OS kills it.
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") void flush(); });
window.addEventListener("pagehide", () => { void flush(); });

const root = createRoot(document.getElementById("root")!);
void boot().then((b) => root.render(<StrictMode><App boot={b} /></StrictMode>));
