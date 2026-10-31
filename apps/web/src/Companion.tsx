import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { Stage } from "@detox/engine";
import { t } from "./text";
import { haptic } from "./haptics";
import { Burst, PawLoader } from "./ui/Controls";
import { has3D, markPet3d, webglOk, type Species3D } from "./pet3d-support";
import type { PetCondition } from "./Pet3D";
const Pet3D = lazy(() => import("./Pet3D").then((m) => ({ default: m.Pet3D })));
import type { Personality, Species } from "./types";
import { portraitSrc } from "./portrait";

/** How the companion feels right now. "sad" is the hunger strike after a slip: low, not sick. */
export type Mood = "idle" | "waiting" | "happy" | "hurt" | "sick" | "dying" | "sad";
/** Short, one-off behaviours layered on top of the mood. */
export type Gesture =
  | "none" | "yawn" | "perk" | "look" | "petted" | "tilt" | "hop" | "nap" | "side"
  | "giggle" | "dizzy" | "talk";
/** What a tap or stroke on the companion was, so the screen can answer in its voice. */
export type Reaction = "petted" | "giggle" | "dizzy" | "stroke";

/** The art's own colour per species, used for small accents (age bar, chart). */

/** Grey creeps into the face with age, softly: the companion should always still look like itself. */

/** notTracking: today is paused or not tracked, so the pet isn't waiting for anything. */
export function moodFor(stage: Stage, opts: { checkedToday: boolean; slippedToday: boolean; justLogged?: "slip" | "clean" | null; age: number; notTracking?: boolean }): Mood {
  if (opts.justLogged === "slip") return "hurt";
  if (opts.justLogged === "clean") return "happy";
  if (opts.age >= 90) return "dying";
  if (opts.slippedToday) return "sad";
  if (stage === "old" || stage === "frail") return "sick";
  if (!opts.checkedToday) return opts.notTracking ? "idle" : "waiting";
  return "happy";
}

interface ArtProps {
  species: Species; coat?: string; breed?: string; stage: Stage; mood: Mood; age: number; size?: number;
  /** Where the eyes look, -1..1 on each axis. */
  look?: { x: number; y: number };
  gesture?: Gesture;
  /** A rescued pet's condition per trait (see PetCondition in Pet3D.tsx). Missing means well. */
  condition?: PetCondition;
  /** The scene's light (see scene.ts); the pet is lit to match. */
  light?: { color: string; intensity: number };
}

/** A still portrait of the pet, for lists and as the stand-in when 3D is not available. */
export function PetImage({ species, coat, breed, mood, size = 96, round }: { species: Species; coat?: string; breed?: string; mood: Mood; size?: number; round?: boolean }) {
  return <img src={portraitSrc(species, breed, coat, mood)} alt="" width={size} height={size} draggable={false}
    style={{ width: size, height: size, objectFit: "contain", borderRadius: round ? "50%" : undefined, background: round ? "var(--raised)" : undefined, display: "block" }} />;
}

/** Whether this species should be drawn in 3D right now: the setting is on, the phone can do it and it hasn't failed. */
function use3d(species: Species) {
  const [failed, setFailed] = useState(false);
  return { on: !failed && has3D(species) && webglOk(), fail: () => { markPet3d("failed"); setFailed(true); } };
}

/** A calm disc with a small pulsing paw while the model loads, so the old drawing never flashes in before the 3D pet. */
const Waiting3D = ({ size }: { size: number }) => <span className="pet3d-wait" style={{ width: size, height: size }} aria-hidden><PawLoader size={Math.round(size * 0.3)} /></span>;

/**
 * A pet for small, non-interactive spots (the Pets grid, the profile): the same 3D or drawn art as the home screen,
 * following the same setting. `still` forces the drawing, for lists too long to give every pet its own 3D view.
 */
export function PetPortrait({ still, ...art }: ArtProps & { still?: boolean }) {
  const reduce = useReducedMotion();
  const t = use3d(art.species);
  const size = art.size ?? 280;
  if (!t.on || still) return <PetImage {...art} />;
  return (
    <Suspense fallback={<Waiting3D size={size} />}>
      <Pet3D species={art.species as Species3D} coat={art.coat} breed={art.breed} stage={art.stage} mood={art.mood} age={art.age} gesture={art.gesture} condition={art.condition} light={art.light} reduced={!!reduce}
        size={size} onFail={t.fail} loading={<Waiting3D size={size} />} fallback={<PetImage {...art} />} />
    </Suspense>
  );
}

/** Idle behaviours, weighted by personality: a playful pet hops, a calm one naps, a sassy one side-eyes. */
const IDLE: Record<Personality, [Gesture, number][]> = {
  playful: [["hop", 3], ["look", 2], ["perk", 2], ["tilt", 1], ["yawn", 0.5]],
  calm: [["nap", 2], ["yawn", 2], ["look", 1], ["tilt", 1]],
  sassy: [["side", 3], ["look", 1], ["perk", 1], ["yawn", 1]],
  wise: [["tilt", 2], ["look", 2], ["yawn", 1], ["nap", 1]],
};
const PACE: Record<Personality, [number, number]> = { playful: [3000, 3500], calm: [7000, 5000], sassy: [5000, 4000], wise: [6000, 4000] };
const LENGTH: Partial<Record<Gesture, number>> = { yawn: 1500, nap: 3800, hop: 900, side: 1600, tilt: 1400, look: 1200, perk: 900 };
const pick = (xs: [Gesture, number][]) => { let r = Math.random() * xs.reduce((a, [, w]) => a + w, 0); for (const [g, w] of xs) { r -= w; if (r <= 0) return g; } return xs[0][0]; };

/**
 * The companion as a living thing: it blinks, follows your finger with its eyes, reacts differently
 * when you pet its head, tickle its belly or poke it too much, and does small things on its own.
 */
export function LiveCompanion({ interactive = true, personality = "playful", onReact, ...art }: ArtProps & { interactive?: boolean; personality?: Personality; onReact?: (r: Reaction) => void }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [idle, setIdle] = useState<Gesture>("none");
  const [touch, setTouch] = useState<Gesture>("none");
  const [hearts, setHearts] = useState(0);
  const [sparks, setSparks] = useState(0);
  const lastMove = useRef(0);
  const pokes = useRef<number[]>([]);
  const stroke = useRef<{ x: number; dist: number; down: boolean }>({ x: 0, dist: 0, down: false });
  const touchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const low = art.mood === "dying" || art.stage === "frail" || art.stage === "dead";
  const t3d = use3d(art.species);

  useEffect(() => {
    if (!interactive || reduce) return;
    const onMove = (e: PointerEvent) => {
      const el = ref.current; if (!el) return;
      const r = el.getBoundingClientRect();
      setLook({ x: (e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2), y: (e.clientY - (r.top + r.height * 0.4)) / (window.innerHeight / 2) });
      lastMove.current = Date.now();
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [interactive, reduce]);

  useEffect(() => {
    if (!interactive || reduce || low) return;
    let t: ReturnType<typeof setTimeout>;
    const [base, spread] = PACE[personality];
    const tick = () => {
      t = setTimeout(() => {
        if (Date.now() - lastMove.current > 2500 && (!art.gesture || art.gesture === "none")) {
          const g = pick(IDLE[personality].filter(([x]) => art.mood !== "sad" || x !== "hop"));
          setIdle(g);
          if (g === "look") setLook({ x: Math.random() > 0.5 ? 0.9 : -0.9, y: -0.2 });
          setTimeout(() => { setIdle("none"); if (g === "look") setLook({ x: 0, y: 0 }); }, LENGTH[g] ?? 1100);
        }
        tick();
      }, base + Math.random() * spread);
    };
    tick();
    return () => clearTimeout(t);
  }, [interactive, reduce, low, personality, art.mood, art.gesture]);

  const play = (g: Gesture, ms: number) => { clearTimeout(touchTimer.current); setTouch(g); touchTimer.current = setTimeout(() => setTouch("none"), ms); };

  function poke(e: React.PointerEvent) {
    if (!interactive) return;
    const now = Date.now();
    pokes.current = [...pokes.current.filter((x) => now - x < 2000), now];
    if (stroke.current.dist > 60) return; // that was a stroke, handled on move
    const r = ref.current!.getBoundingClientRect();
    const onHead = e.clientY - r.top < r.height * 0.5;
    if (pokes.current.length >= 5 && !low) { pokes.current = []; haptic.warn(); play("dizzy", 1400); onReact?.("dizzy"); return; }
    if (onHead || low) { haptic.tap(); play("petted", 1200); if (!low) setHearts((h) => h + 1); onReact?.("petted"); }
    else { haptic.select(); play("giggle", 1000); setSparks((s) => s + 1); onReact?.("giggle"); }
  }

  const gesture = touch !== "none" ? touch : art.gesture && art.gesture !== "none" ? art.gesture : idle;

  return (
    <motion.div ref={ref} className="live-pet" role={interactive ? "button" : undefined}
      aria-label={interactive ? t("pet.look.interactive") : undefined} tabIndex={interactive ? 0 : -1}
      onPointerDown={(e) => { stroke.current = { x: e.clientX, dist: 0, down: true }; }}
      onPointerMove={(e) => {
        const s = stroke.current; if (!s.down) return;
        s.dist += Math.abs(e.clientX - s.x); s.x = e.clientX;
        if (s.dist > 60 && touch !== "petted") { haptic.tap(); play("petted", 1400); setHearts((h) => h + 1); onReact?.("stroke"); s.dist = 0; s.down = false; stroke.current.dist = 61; }
      }}
      onPointerUp={(e) => { poke(e); stroke.current = { x: 0, dist: 0, down: false }; }}
      onPointerCancel={() => { stroke.current = { x: 0, dist: 0, down: false }; }}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); haptic.tap(); play("petted", 1200); setHearts((h) => h + 1); onReact?.("petted"); } }}
      whileTap={interactive ? { scale: 0.97 } : undefined}>
      {t3d.on
        ? <Suspense fallback={<Waiting3D size={art.size ?? 280} />}><Pet3D species={art.species as Species3D} coat={art.coat} breed={art.breed} stage={art.stage} mood={art.mood} age={art.age} gesture={gesture} look={look} condition={art.condition} light={art.light} reduced={!!reduce}
            size={art.size ?? 280} onFail={t3d.fail} loading={<Waiting3D size={art.size ?? 280} />} fallback={<PetImage {...art} size={art.size ?? 280} />} /></Suspense>
        : <PetImage {...art} size={art.size ?? 280} />}
      <Burst burst={hearts} kind="heart" count={6} />
      <Burst burst={sparks} kind="spark" count={8} />
    </motion.div>
  );
}
