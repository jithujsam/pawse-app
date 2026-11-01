import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Scene } from "../scene";

/** A deterministic 0..1 value per particle, so the room looks the same on every render. */
const rnd = (i: number, k: number) => ((Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1;

function particles(scene: Scene): { cls: string; style: CSSProperties }[] {
  const out: { cls: string; style: CSSProperties }[] = [];
  for (let i = 0; i < scene.rain; i++) out.push({ cls: "ps-rain", style: { left: `${rnd(i, 1) * 100}%`, animationDelay: `${-rnd(i, 2) * 1.6}s`, animationDuration: `${1.1 + rnd(i, 3) * 0.7}s` } });
  const fair = scene.mood === "clear" || scene.mood === "golden";
  if (fair && scene.time === "night") for (let i = 0; i < 6; i++) out.push({ cls: "ps-firefly", style: { left: `${12 + rnd(i, 4) * 76}%`, top: `${38 + rnd(i, 5) * 34}%`, animationDelay: `${-rnd(i, 6) * 5}s` } });
  else if (scene.mood === "golden") for (let i = 0; i < 8; i++) out.push({ cls: "ps-mote", style: { left: `${8 + rnd(i, 9) * 84}%`, top: `${30 + rnd(i, 10) * 44}%`, animationDelay: `${-rnd(i, 11) * 9}s` } });
  return out.slice(0, 24);
}

/**
 * The room the pet lives in. It has no edges: a wash of the day's light (storm grey to golden) fades into the page, so
 * the pet is held by the screen rather than boxed in a card. Weather is only light and a few particles, transform and
 * opacity only; they stop off-screen, in the background and with reduced motion.
 */
export function PetScene({ scene, children, label, className = "" }: { scene: Scene; children: ReactNode; label?: string; className?: string }) {
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
  // Fair days are lit in the pet's own colour and the day's warm light; only grey weather turns the room cool.
  const grey = scene.mood === "storm" || scene.mood === "overcast";
  const style = { "--wash": grey ? scene.skyTop : "var(--accent)", "--glow": grey ? scene.skyBottom : scene.light.color } as CSSProperties;
  return (
    <section ref={ref} className={`pscene ${className}`} data-mood={scene.mood} data-time={scene.time} data-paused={!visible || hidden || undefined} style={style} aria-label={label}>
      <div className="ps-fx" aria-hidden>{particles(scene).map((p, i) => <i key={i} className={p.cls} style={p.style} />)}</div>
      <div className="ps-content">{children}</div>
    </section>
  );
}
