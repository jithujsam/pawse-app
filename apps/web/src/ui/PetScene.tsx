import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Scene } from "../scene";

/** A deterministic 0..1 value per particle, so the scene looks the same on every render. */
const rnd = (i: number, k: number) => ((Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1;

function particles(scene: Scene): { cls: string; style: CSSProperties }[] {
  const out: { cls: string; style: CSSProperties }[] = [];
  for (let i = 0; i < scene.rain; i++) out.push({ cls: "ps-rain", style: { left: `${rnd(i, 1) * 100}%`, animationDelay: `${-rnd(i, 2) * 1.4}s`, animationDuration: `${0.9 + rnd(i, 3) * 0.6}s` } });
  if (scene.mood === "clearing") for (let i = 0; i < 2; i++) out.push({ cls: "ps-cloud", style: { top: `${14 + i * 16}%`, animationDelay: `${-i * 30}s`, width: `${i ? 34 : 44}%` } });
  const fair = scene.mood === "clear" || scene.mood === "golden";
  if (fair && scene.time === "night") for (let i = 0; i < 6; i++) out.push({ cls: "ps-firefly", style: { left: `${14 + rnd(i, 4) * 72}%`, bottom: `${16 + rnd(i, 5) * 30}%`, animationDelay: `${-rnd(i, 6) * 5}s` } });
  else {
    if (scene.mood === "clear" && scene.time === "day") for (let i = 0; i < 5; i++) out.push({ cls: "ps-tuft", style: { left: `${14 + i * 17 + rnd(i, 7) * 6}%`, bottom: `${3 + rnd(i, 8) * 5}%` } });
    if (scene.mood === "golden") for (let i = 0; i < 8; i++) out.push({ cls: "ps-mote", style: { left: `${8 + rnd(i, 9) * 84}%`, bottom: `${12 + rnd(i, 10) * 40}%`, animationDelay: `${-rnd(i, 11) * 9}s` } });
  }
  return out.slice(0, 24);
}

/**
 * The pet's scene: a sky, a ground platform, light weather, and the pet standing on it. Full-bleed, it runs under the
 * status bar. Motion is transform and opacity only, and stops off-screen, in the background and with reduced motion.
 */
export function PetScene({ scene, children, overlay, label }: { scene: Scene; children: ReactNode; overlay?: ReactNode; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [hidden, setHidden] = useState(() => typeof document !== "undefined" && document.hidden);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    const on = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);
  const style = { "--sky-top": scene.skyTop, "--sky-bottom": scene.skyBottom, "--ground-c": scene.ground } as CSSProperties;
  return (
    <section ref={ref} className="pscene" data-mood={scene.mood} data-time={scene.time} data-ink={scene.ink} data-paused={!visible || hidden || undefined} style={style} aria-label={label}>
      <div className="ps-ground" aria-hidden />
      <div className="ps-fx" aria-hidden>{particles(scene).map((p, i) => <i key={i} className={p.cls} style={p.style} />)}</div>
      <div className="ps-pet">{children}</div>
      {overlay && <div className="ps-overlay">{overlay}</div>}
    </section>
  );
}
