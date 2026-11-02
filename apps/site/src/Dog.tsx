import { useEffect, useRef, useState } from "react";
import type { Stage } from "@detox/engine";
import { Pet3D, type PetCondition } from "../../web/src/Pet3D";
import { webglOk } from "../../web/src/pet3d-support";
import type { Gesture, Mood } from "../../web/src/Companion";

export const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Mounts only near the viewport, so the page's first paint never waits on three.js. */
function useNear(ref: React.RefObject<HTMLElement | null>, margin = "300px") {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (!("IntersectionObserver" in window)) { setNear(true); return; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setNear(true); io.disconnect(); } }, { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, near, margin]);
  return near;
}

/** The square size the dog can have in its box. */
function useBoxSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize(Math.floor(Math.min(el.clientWidth, el.clientHeight || el.clientWidth)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

export interface DogProps {
  mood: Mood;
  gesture?: Gesture;
  stage?: Stage;
  condition?: PetCondition;
  coat?: string;
  /** The room's light (scene.ts), as on the app's pet page. */
  light?: { color: string; intensity: number };
  /** The still render already in the page, shown until the live model is ready (and kept if 3D can't run). */
  poster: string;
  posterAlt: string;
  /** Tapping the dog pets it (the app's real "petted" reaction). */
  pettable?: boolean;
}

export function Dog({ mood, gesture = "none", stage = "baby", condition, coat = "golden", light, poster, posterAlt, pettable }: DogProps) {
  const box = useRef<HTMLDivElement>(null);
  const near = useNear(box);
  const size = useBoxSize(box);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [petted, setPetted] = useState(0);
  const reduced = reducedMotion();
  const can3d = typeof document !== "undefined" && webglOk() && !failed;
  useEffect(() => { if (!petted) return; const t = setTimeout(() => setPetted(0), 1600); return () => clearTimeout(t); }, [petted]);
  const still = <img className="dog-poster" src={poster} alt={posterAlt} width={640} height={640} decoding="async" />;
  const live = near && can3d && size > 0;
  return (
    <div ref={box} className="dog" data-ready={ready && live ? "" : undefined}>
      {still}
      {live && (
        <div className="dog-live">
          <Pet3D species="dog" coat={coat} stage={stage} mood={mood} gesture={petted ? "petted" : gesture} age={0} size={size}
            condition={condition} light={light} reduced={reduced} fallback={null} loading={null} onReady={() => setReady(true)} onFail={() => setFailed(true)} />
        </div>
      )}
      {pettable && live && ready && (
        <button type="button" className="dog-pet" onClick={() => setPetted((n) => n + 1)} aria-label="Pet the dog">
          <span className="dog-pet-hint" aria-hidden>{petted ? "" : "Tap to pet"}</span>
        </button>
      )}
    </div>
  );
}
