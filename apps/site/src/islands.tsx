import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { petTraits } from "@detox/engine";
import { Dog, type DogProps } from "./Dog";
import { Demo } from "./Demo";

/** The dogs on the page, each a real state of the app's dog (Pet3D + petTraits), never an invented pose. */
const RESCUE_START = petTraits({ mode: "rescue", phase: "recovery", run: 0, issue: null });
const PRESETS: Record<string, Omit<DogProps, "poster" | "posterAlt">> = {
  hero: { mood: "happy", pettable: true },
  rescue: { mood: "idle", condition: RESCUE_START },
  raise: { mood: "waiting" },
  cta: { mood: "happy", pettable: true },
};

function mountDogs() {
  document.querySelectorAll<HTMLElement>("[data-dog]").forEach((el) => {
    const preset = PRESETS[el.dataset.dog ?? ""];
    const img = el.querySelector("img");
    if (!preset || !img) return;
    const poster = img.getAttribute("src")!, posterAlt = img.getAttribute("alt") ?? "";
    createRoot(el).render(<StrictMode><Dog {...preset} poster={poster} posterAlt={posterAlt} /></StrictMode>);
  });
}

function mountDemo() {
  const el = document.querySelector<HTMLElement>("[data-demo]");
  if (el) createRoot(el).render(<StrictMode><Demo /></StrictMode>);
}

/** Dev only: one dog alone on a clear background, for the still renders in public/renders (see README). */
function posterMode(name: string) {
  document.documentElement.classList.add("poster-mode");
  document.body.innerHTML = '<div id="poster"></div>';
  createRoot(document.getElementById("poster")!).render(<Dog {...PRESETS[name]} pettable={false} poster="data:," posterAlt="" />);
}

/** Loaded after first paint by main.ts. */
export function mountIslands(poster: string | null) {
  if (poster && PRESETS[poster]) { posterMode(poster); return; }
  mountDogs();
  mountDemo();
}
