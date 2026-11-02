import { wire } from "./interactions";
import "./styles.css";

/**
 * The page reads in full from its HTML. This entry only wires the small behaviours; the 3D dogs and the live demo
 * (React, three.js and the app's mission engine) load right after, so the first paint never waits for them.
 */
document.documentElement.classList.add("js");
const poster = import.meta.env.DEV ? new URLSearchParams(location.search).get("poster") : null;
if (!poster) wire();
const load = () => void import("./islands").then((m) => m.mountIslands(poster));
if (poster || !("requestIdleCallback" in window)) load();
else requestIdleCallback(load, { timeout: 1200 });
