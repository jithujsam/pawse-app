import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Ambient, Scene } from "../scene";

/** A deterministic 0..1 value per particle, so the room looks the same on every render. */
const rnd = (i: number, k: number) => ((Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1;

const MAX = 24;
const drift = (i: number, k: number, extra: CSSProperties = {}): CSSProperties => ({ left: `${4 + rnd(i, k) * 92}%`, animationDelay: `${-rnd(i, k + 1) * 9}s`, animationDuration: `${6 + rnd(i, k + 2) * 5}s`, ...extra });
const LEAVES = ["#c8742e", "#a8532a", "#d9a13b", "#8f4a22"];

function particles(scene: Scene, ambient: Ambient | null): { cls: string; style: CSSProperties }[] {
  const out: { cls: string; style: CSSProperties }[] = [];
  for (let i = 0; i < scene.rain; i++) out.push({ cls: "ps-rain", style: { left: `${rnd(i, 1) * 100}%`, animationDelay: `${-rnd(i, 2) * 1.6}s`, animationDuration: `${1.1 + rnd(i, 3) * 0.7}s` } });
  const fair = scene.mood === "clear" || scene.mood === "golden";
  if (fair && scene.time === "night" && !ambient) for (let i = 0; i < 6; i++) out.push({ cls: "ps-firefly", style: { left: `${12 + rnd(i, 4) * 76}%`, top: `${38 + rnd(i, 5) * 34}%`, animationDelay: `${-rnd(i, 6) * 5}s` } });
  if (scene.mood === "golden" && scene.time !== "night") for (let i = 0; i < 6; i++) out.push({ cls: "ps-mote", style: { left: `${8 + rnd(i, 9) * 84}%`, top: `${30 + rnd(i, 10) * 44}%`, animationDelay: `${-rnd(i, 11) * 9}s` } });
  if (ambient) {
    if (ambient.period === "night" || ambient.period === "midnight") {
      for (let i = 0; i < 5; i++) out.push({ cls: "ps-star", style: { left: `${(i % 2 ? 74 : 4) + rnd(i, 20) * 22}%`, top: `${4 + rnd(i, 21) * 34}%`, animationDelay: `${-rnd(i, 22) * 4}s` } });
      if (fair) for (let i = 0; i < 4; i++) out.push({ cls: "ps-firefly", style: { left: `${12 + rnd(i, 4) * 76}%`, top: `${40 + rnd(i, 5) * 30}%`, animationDelay: `${-rnd(i, 6) * 5}s` } });
    }
    if (ambient.season === "winter") {
      for (let i = 0; i < 10; i++) out.push({ cls: "ps-snow", style: drift(i, 30, { animationDuration: `${7 + rnd(i, 33) * 5}s` }) });
      for (let i = 0; i < 3; i++) out.push({ cls: "ps-wind", style: { top: `${18 + rnd(i, 40) * 50}%`, animationDelay: `${-rnd(i, 41) * 6}s`, animationDuration: `${3.5 + rnd(i, 42) * 2}s` } });
    } else if (ambient.season === "spring") for (let i = 0; i < 7; i++) out.push({ cls: "ps-petal", style: drift(i, 50) });
    else if (ambient.season === "autumn") for (let i = 0; i < 7; i++) out.push({ cls: "ps-leaf", style: drift(i, 60, { "--lc": LEAVES[i % 4] } as CSSProperties) });
  }
  return out.slice(0, MAX);
}

/**
 * The room the pet lives in. It has no edges: a wash of the day's light (storm grey to golden) fades into the page, so
 * the pet is held by the screen rather than boxed in a card. Weather is only light and a few particles, transform and
 * opacity only; they stop off-screen, in the background and with reduced motion. With `ambient` (Me, Appearance) a
 * sun or moon, stars and the season's snow, petals or leaves join in.
 */
export function PetScene({ scene, ambient = null, children, label, className = "" }: { scene: Scene; ambient?: Ambient | null; children: ReactNode; label?: string; className?: string }) {
  const ref = useRef<HTMLElement>(null);
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
  const period = ambient?.period;
  return (
    <section ref={ref} className={`pscene ${className}`} data-mood={scene.mood} data-ink={scene.ink} data-period={period} data-season={ambient?.season}
      data-paused={!visible || hidden || undefined} aria-label={label}>
      {(period === "morning" || period === "afternoon") && <i className="ps-sun" aria-hidden />}
      {(period === "night" || period === "midnight") && <i className="ps-moon" aria-hidden />}
      <div className="ps-fx" aria-hidden>{particles(scene, ambient).map((p, i) => <i key={i} className={p.cls} style={p.style} />)}</div>
      <div className="ps-content">{children}</div>
    </section>
  );
}
