import { lazy, Suspense, useEffect, useId, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { Stage } from "@detox/engine";
import { describePet } from "./pet-label";
import { t } from "./text";
import { haptic } from "./haptics";
import { coatFor, mix } from "./pets";
import { Burst } from "./ui/Controls";
import { has3D, markPet3d, webglOk, type Species3D } from "./pet3d-support";
const Pet3D = lazy(() => import("./Pet3D").then((m) => ({ default: m.Pet3D })));
import type { Accessory, Personality, Species } from "./types";

/** How the companion feels right now. "sad" is the hunger strike after a slip: low, not sick. */
export type Mood = "idle" | "waiting" | "happy" | "hurt" | "sick" | "dying" | "sad";
/** Short, one-off behaviours layered on top of the mood. */
export type Gesture =
  | "none" | "yawn" | "perk" | "look" | "petted" | "tilt" | "hop" | "nap" | "side"
  | "giggle" | "dizzy" | "eat" | "refuse" | "talk" | "treat";
/** What a tap or stroke on the companion was, so the screen can answer in its voice. */
export type Reaction = "petted" | "giggle" | "dizzy" | "stroke";

/** The art's own colour per species, used for small accents (age bar, chart). */
export const ACCENT: Record<Species, string> = { dog: "#c98a4b", cat: "#8f8f9c", rabbit: "#d4b8a0", fox: "#e47c3c", owl: "#c99a64", panda: "#55555c" };

const STAGE_SCALE: Record<Stage, number> = { baby: 0.76, young: 0.88, adult: 1, middle: 1.03, old: 1, frail: 0.96, dead: 0.94 };
/** Grey creeps into the face with age, softly: the companion should always still look like itself. */
const STAGE_GREY: Record<Stage, number> = { baby: 0, young: 0, adult: 0, middle: 0.35, old: 0.6, frail: 0.75, dead: 0.75 };

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
  species: Species; coat?: string; stage: Stage; mood: Mood; age: number; size?: number;
  /** Where the eyes look, -1..1 on each axis. */
  look?: { x: number; y: number };
  gesture?: Gesture;
  accessory?: Accessory | null;
  /** Eyes shut for a moment. */
  blink?: boolean;
}

/** Where things sit on each species' head, in art units. */
const HEAD: Record<Species, { cy: number; eyeY: number; eyeDX: number; eyeR: number; top: number; neck: number }> = {
  dog: { cy: 96, eyeY: 92, eyeDX: 17, eyeR: 7.5, top: 54, neck: 138 },
  cat: { cy: 98, eyeY: 94, eyeDX: 18, eyeR: 7.5, top: 60, neck: 138 },
  rabbit: { cy: 102, eyeY: 98, eyeDX: 17, eyeR: 7.5, top: 64, neck: 142 },
  fox: { cy: 98, eyeY: 94, eyeDX: 18, eyeR: 7, top: 60, neck: 138 },
  owl: { cy: 110, eyeY: 108, eyeDX: 20, eyeR: 12, top: 76, neck: 140 },
  panda: { cy: 98, eyeY: 96, eyeDX: 18, eyeR: 5.5, top: 56, neck: 140 },
};

export function CompanionArt({ species, coat, stage, mood, age, size = 280, look = { x: 0, y: 0 }, gesture = "none", accessory = null, blink = false }: ArtProps) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const c = coatFor(species, coat);
  const t = Math.max(0, Math.min(1, age / 100));
  // Age dulls the coat a little, never into something unrecognisable.
  const fur = mix(c.fur, "#a3a3a3", t * 0.28);
  const shade = mix(c.shade, "#858585", t * 0.28);
  const belly = mix(c.belly, "#e3e3e3", t * 0.2);
  const ink = "#2a2320";
  const h = HEAD[species];
  const scale = STAGE_SCALE[stage];
  const grey = STAGE_GREY[stage];
  const baby = stage === "baby";
  const tired = stage === "old" || stage === "frail" || stage === "dead" || mood === "sick";
  const g = gesture;

  const eyes: "open" | "happy" | "closed" | "dizzy" =
    g === "dizzy" ? "dizzy"
      : mood === "dying" || g === "nap" || g === "refuse" ? "closed"
        : g === "petted" || g === "giggle" || g === "treat" || g === "eat" || (mood === "happy" && g === "hop") ? "happy"
          : "open";
  const lid = eyes === "open" ? (blink ? 1 : g === "yawn" ? 0.55 : tired ? 0.38 : mood === "sad" ? 0.3 : g === "side" ? 0.35 : 0) : 0;
  const brows: "sad" | "side" | null = mood === "hurt" || mood === "sad" ? "sad" : g === "side" ? "side" : null;
  const mouth: "smile" | "grin" | "o" | "frown" | "flat" | "talk" =
    g === "talk" || g === "eat" ? "talk"
      : g === "yawn" ? "o"
        : g === "petted" || g === "giggle" || g === "hop" || g === "treat" ? "grin"
          : mood === "hurt" || mood === "sad" || g === "refuse" ? "frown"
            : mood === "happy" || mood === "idle" ? "smile"
              : tired ? "flat" : "smile";
  const px = Math.max(-1, Math.min(1, g === "side" ? 0.9 : look.x)) * h.eyeR * 0.38;
  const py = Math.max(-1, Math.min(1, look.y)) * h.eyeR * 0.3;
  const lidColor = species === "panda" ? c.dark : species === "owl" ? belly : fur;
  const eyeR = h.eyeR * (baby ? 1.18 : 1);
  const bodyRx = species === "owl" ? 54 : stage === "middle" ? 58 : stage === "frail" ? 50 : 54;

  const classes = ["pet", `m-${mood}`, `g-${g}`, `sp-${species}`, baby && "pet-baby"].filter(Boolean).join(" ");
  const furFill = `url(#${id}-fur)`;

  const eye = (cx: number, side: -1 | 1) => {
    if (eyes === "happy") return <path key={side} d={`M${cx - eyeR} ${h.eyeY + 1} q${eyeR} ${-eyeR * 1.2} ${eyeR * 2} 0`} stroke={species === "panda" ? "#f6f2ea" : ink} strokeWidth="3" fill="none" strokeLinecap="round" />;
    if (eyes === "closed") return <path key={side} d={`M${cx - eyeR} ${h.eyeY} q${eyeR} ${eyeR * 0.9} ${eyeR * 2} 0`} stroke={species === "panda" ? "#f6f2ea" : ink} strokeWidth="3" fill="none" strokeLinecap="round" />;
    if (eyes === "dizzy") return <g key={side} stroke={species === "panda" ? "#f6f2ea" : ink} strokeWidth="2.6" strokeLinecap="round"><path d={`M${cx - 5} ${h.eyeY - 5} l10 10 M${cx + 5} ${h.eyeY - 5} l-10 10`} /></g>;
    const panda = species === "panda";
    return (
      <g key={side}>
        {panda && <circle cx={cx} cy={h.eyeY} r={eyeR + 2.2} fill="#f6f2ea" />}
        <circle cx={cx} cy={h.eyeY} r={eyeR} fill={c.iris} />
        <circle cx={cx + px} cy={h.eyeY + py} r={eyeR * (species === "owl" ? 0.55 : 0.68)} fill="#15110f" />
        <circle cx={cx + px + eyeR * 0.32} cy={h.eyeY + py - eyeR * 0.36} r={eyeR * 0.3} fill="#fff" />
        <circle cx={cx + px - eyeR * 0.3} cy={h.eyeY + py + eyeR * 0.3} r={eyeR * 0.13} fill="#fff" opacity=".8" />
        {tired && <circle cx={cx} cy={h.eyeY} r={eyeR} fill="#e4e9ef" opacity={0.18 + grey * 0.2} />}
        {lid > 0 && <rect className="lid" x={cx - eyeR - 1.5} y={h.eyeY - eyeR - 1.5} width={eyeR * 2 + 3} height={(eyeR * 2 + 3) * lid} fill={lidColor} />}
      </g>
    );
  };

  const mouthPath = () => {
    const y = species === "owl" ? h.eyeY + 22 : species === "dog" ? h.cy + 22 : h.cy + 19;
    if (species === "owl") {
      const open = mouth === "talk" || mouth === "o" || mouth === "grin";
      return <g className="mouth">
        <path d={`M112 ${y - 6} L128 ${y - 6} L120 ${y + 6} Z`} fill="#e9a23b" stroke="#b97818" strokeWidth="1.2" strokeLinejoin="round" />
        {open && <path className="beak-low" d={`M114 ${y - 1} L126 ${y - 1} L120 ${y + 9} Z`} fill="#c98620" />}
      </g>;
    }
    switch (mouth) {
      case "grin": return <g className="mouth"><path d={`M108 ${y - 2} Q120 ${y + 14} 132 ${y - 2} Z`} fill="#7a2f2f" stroke={ink} strokeWidth="2" strokeLinejoin="round" />{species === "dog" && <path d={`M115 ${y + 4} q5 9 10 0 Z`} fill="#ee8a8a" />}</g>;
      case "o": return <ellipse className="mouth yawn" cx="120" cy={y + 3} rx="6" ry="7" fill="#7a2f2f" stroke={ink} strokeWidth="1.6" />;
      case "talk": return <ellipse className="mouth talking" cx="120" cy={y + 2} rx="6.5" ry="5" fill="#7a2f2f" stroke={ink} strokeWidth="1.6" />;
      case "frown": return <path className="mouth" d={`M111 ${y + 4} Q120 ${y - 2} 129 ${y + 4}`} stroke={ink} strokeWidth="2.4" fill="none" strokeLinecap="round" />;
      case "flat": return <path className="mouth" d={`M112 ${y + 1} Q120 ${y + 3} 128 ${y + 1}`} stroke={ink} strokeWidth="2.4" fill="none" strokeLinecap="round" />;
      default: return species === "cat" || species === "fox" || species === "rabbit"
        ? <path className="mouth" d={`M120 ${y - 4} v3 M111 ${y} q4.5 5 9 -1 q4.5 6 9 1`} stroke={ink} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        : <path className="mouth" d={`M109 ${y} Q120 ${y + 10} 131 ${y}`} stroke={ink} strokeWidth="2.4" fill="none" strokeLinecap="round" />;
    }
  };

  const nose = () => {
    if (species === "owl") return null;
    const y = h.cy + (species === "dog" ? 11 : 10);
    if (species === "rabbit") return <path d={`M115 ${y} h10 l-5 5 Z`} fill="#e8909a" stroke="#c96f7a" strokeWidth="1" strokeLinejoin="round" />;
    if (species === "cat") return <path d={`M115 ${y} h10 l-5 5.5 Z`} fill={c.id === "tuxedo" ? "#e48f9a" : "#d98088"} strokeLinejoin="round" />;
    return <g><ellipse cx="120" cy={y + 1} rx={species === "dog" ? 7.5 : 6} ry={species === "dog" ? 5.5 : 4.5} fill={ink} /><ellipse cx="118" cy={y - 0.5} rx="2.4" ry="1.4" fill="#fff" opacity=".45" /></g>;
  };

  const ears = () => {
    switch (species) {
      case "dog": return (<>
        <g className="ear ear-l"><path d="M88 64 C66 60 56 92 64 118 C70 130 86 124 92 104 Z" fill={c.inner} /></g>
        <g className="ear ear-r"><path d="M152 64 C174 60 184 92 176 118 C170 130 154 124 148 104 Z" fill={c.inner} /></g>
      </>);
      case "cat": return (<>
        <g className="ear ear-l"><path d="M80 82 Q78 44 90 40 Q104 48 114 64 Z" fill={furFill} /><path d="M87 72 Q87 52 92 50 Q100 56 106 64 Z" fill={c.inner} /></g>
        <g className="ear ear-r"><path d="M160 82 Q162 44 150 40 Q136 48 126 64 Z" fill={furFill} /><path d="M153 72 Q153 52 148 50 Q140 56 134 64 Z" fill={c.inner} /></g>
      </>);
      case "fox": return (<>
        <g className="ear ear-l"><path d="M78 84 L84 30 L116 62 Z" fill={furFill} strokeLinejoin="round" /><path d="M82 52 L84 30 L97 43 Z" fill={c.dark} /><path d="M86 74 L88 46 L106 62 Z" fill={c.belly} opacity=".7" /></g>
        <g className="ear ear-r"><path d="M162 84 L156 30 L124 62 Z" fill={furFill} strokeLinejoin="round" /><path d="M158 52 L156 30 L143 43 Z" fill={c.dark} /><path d="M154 74 L152 46 L134 62 Z" fill={c.belly} opacity=".7" /></g>
      </>);
      case "rabbit": {
        const droop = stage === "frail" ? 26 : tired ? 12 : 6;
        return (<>
          <g className="ear ear-l" style={{ transform: `rotate(${-droop}deg)`, transformOrigin: "104px 74px" }}><ellipse cx="104" cy="40" rx="12" ry="36" fill={furFill} /><ellipse cx="104" cy="44" rx="5.5" ry="25" fill={c.inner} /></g>
          <g className="ear ear-r" style={{ transform: `rotate(${droop}deg)`, transformOrigin: "136px 74px" }}><ellipse cx="136" cy="40" rx="12" ry="36" fill={furFill} /><ellipse cx="136" cy="44" rx="5.5" ry="25" fill={c.inner} /></g>
        </>);
      }
      case "panda": return (<>
        <g className="ear ear-l"><circle cx="84" cy="62" r="15" fill={c.dark} /></g>
        <g className="ear ear-r"><circle cx="156" cy="62" r="15" fill={c.dark} /></g>
      </>);
      case "owl": return (<>
        <g className="ear ear-l"><path d="M80 92 L78 66 L98 80 Z" fill={shade} /></g>
        <g className="ear ear-r"><path d="M160 92 L162 66 L142 80 Z" fill={shade} /></g>
      </>);
    }
  };

  const tail = () => {
    switch (species) {
      case "dog": return <path d="M166 172 C 192 166, 200 140, 190 124" stroke={fur} strokeWidth="12" strokeLinecap="round" fill="none" />;
      case "cat": return <path d="M166 180 C 200 178, 206 150, 194 132 C 188 122, 196 112, 204 116" stroke={fur} strokeWidth="9" strokeLinecap="round" fill="none" />;
      case "fox": return <g><path d="M160 178 C 200 186, 222 150, 206 112 C 200 132, 186 146, 164 156 Z" fill={furFill} /><path d="M206 112 C 214 124, 214 138, 208 148 C 204 136, 202 124, 206 112 Z" fill={c.belly} /></g>;
      case "rabbit": return <circle cx="170" cy="182" r="12" fill={belly} />;
      case "panda": return <circle cx="168" cy="186" r="8" fill={fur} />;
      case "owl": return null;
    }
  };

  const legs = () => {
    if (species === "owl") return (<g fill="#e9a23b" stroke="#b97818" strokeWidth="1"><path d="M100 202 l-6 8 h5 l3 -5 l3 5 h5 l-6 -8 Z" /><path d="M140 202 l-6 8 h5 l3 -5 l3 5 h5 l-6 -8 Z" /></g>);
    const legFill = species === "panda" ? c.dark : furFill;
    const paw = species === "panda" || species === "fox" ? c.dark : belly;
    if (species === "rabbit") return (<><ellipse cx="96" cy="204" rx="16" ry="8" fill={furFill} /><ellipse cx="144" cy="204" rx="16" ry="8" fill={furFill} /></>);
    return (<>
      <rect x="90" y="176" width="19" height="32" rx="9.5" fill={legFill} />
      <rect x="131" y="176" width="19" height="32" rx="9.5" fill={legFill} />
      {species === "fox" && <><rect x="90" y="190" width="19" height="18" rx="9" fill={c.dark} /><rect x="131" y="190" width="19" height="18" rx="9" fill={c.dark} /></>}
      <ellipse cx="99.5" cy="205" rx="10.5" ry="5.5" fill={paw} />
      <ellipse cx="140.5" cy="205" rx="10.5" ry="5.5" fill={paw} />
    </>);
  };

  const body = () => {
    if (species === "owl") return (<>
      <ellipse className="wing wing-l" cx="68" cy="150" rx="16" ry="40" fill={shade} />
      <ellipse className="wing wing-r" cx="172" cy="150" rx="16" ry="40" fill={shade} />
      <ellipse cx="120" cy="146" rx={bodyRx} ry="64" fill={furFill} />
      <ellipse cx="120" cy="166" rx="34" ry="36" fill={belly} />
      <g stroke={c.marks} strokeWidth="2" strokeLinecap="round" fill="none" opacity=".7">
        <path d="M108 158 l4 4 l4 -4 M124 158 l4 4 l4 -4 M116 172 l4 4 l4 -4 M104 184 l4 4 l4 -4 M128 184 l4 4 l4 -4" />
      </g>
    </>);
    return (<>
      {species !== "rabbit" && <><ellipse cx="80" cy="186" rx="18" ry="20" fill={species === "panda" ? c.dark : shade} /><ellipse cx="160" cy="186" rx="18" ry="20" fill={species === "panda" ? c.dark : shade} /></>}
      <ellipse cx="120" cy="166" rx={bodyRx} ry={species === "rabbit" ? 42 : 38} fill={furFill} />
      {species === "panda" && <path d={`M${120 - bodyRx + 4} 150 Q120 128 ${120 + bodyRx - 4} 150 L${120 + bodyRx - 10} 162 Q120 146 ${120 - bodyRx + 10} 162 Z`} fill={c.dark} />}
      <ellipse cx="120" cy="176" rx={bodyRx * 0.58} ry="24" fill={belly} opacity={species === "panda" ? 0 : 0.95} />
      {c.marks && species === "cat" && <g stroke={c.marks} strokeWidth="4" strokeLinecap="round" fill="none" opacity=".55"><path d="M76 160 q6 -6 12 0 M70 172 q6 -6 12 0 M152 160 q6 -6 12 0 M158 172 q6 -6 12 0" /></g>}
    </>);
  };

  const head = () => {
    if (species === "owl") return (<>
      <circle cx="100" cy={h.eyeY} r="22" fill={belly} />
      <circle cx="140" cy={h.eyeY} r="22" fill={belly} />
      <path d={`M100 ${h.eyeY - 22} Q120 ${h.eyeY - 10} 140 ${h.eyeY - 22}`} stroke={shade} strokeWidth="3" fill="none" opacity=".5" />
    </>);
    return (<>
      {species === "cat" || species === "fox"
        ? <ellipse cx="120" cy={h.cy} rx="47" ry="41" fill={furFill} />
        : <circle cx="120" cy={h.cy} r={species === "rabbit" ? 42 : 44} fill={furFill} />}
      {species === "fox" && <path d={`M74 ${h.cy + 4} Q88 ${h.cy + 40} 120 ${h.cy + 36} Q152 ${h.cy + 40} 166 ${h.cy + 4} Q150 ${h.cy + 20} 120 ${h.cy + 22} Q90 ${h.cy + 20} 74 ${h.cy + 4} Z`} fill={belly} />}
      {species === "panda" && <>
        <ellipse cx={120 - h.eyeDX} cy={h.eyeY + 1} rx="13" ry="16" fill={c.dark} transform={`rotate(28 ${120 - h.eyeDX} ${h.eyeY + 1})`} />
        <ellipse cx={120 + h.eyeDX} cy={h.eyeY + 1} rx="13" ry="16" fill={c.dark} transform={`rotate(-28 ${120 + h.eyeDX} ${h.eyeY + 1})`} />
      </>}
      {(species === "dog" || species === "panda" || species === "rabbit" || species === "cat") && (
        <ellipse cx="120" cy={h.cy + 17} rx={species === "dog" ? 23 : 18} ry={species === "dog" ? 16 : 13} fill={belly} />
      )}
      {c.id === "tuxedo" && <path d={`M113 ${h.cy - 2} Q120 ${h.cy - 12} 127 ${h.cy - 2} Q142 ${h.cy + 26} 120 ${h.cy + 36} Q98 ${h.cy + 26} 113 ${h.cy - 2} Z`} fill={belly} />}
      {c.marks && species === "cat" && <g stroke={c.marks} strokeWidth="3.4" strokeLinecap="round" opacity=".6"><path d={`M120 ${h.cy - 36} v10 M110 ${h.cy - 34} l2 9 M130 ${h.cy - 34} l-2 9`} /></g>}
      {grey > 0 && <ellipse cx="120" cy={h.cy + 17} rx="22" ry="15" fill="#c9c9cc" opacity={grey * 0.55} />}
    </>);
  };

  const cheeks = mood === "happy" || g === "petted" || g === "treat" || g === "giggle" || baby;
  const whiskers = species === "cat" || species === "fox" || species === "rabbit";

  return (
    <svg className={classes} viewBox="20 14 200 204" width={size} height={size * (204 / 200)} role="img" aria-label={describePet(species, stage, mood)}>
      <defs>
        <radialGradient id={`${id}-fur`} cx="38%" cy="28%" r="80%">
          <stop offset="0" stopColor={mix(fur, "#ffffff", 0.22)} />
          <stop offset=".55" stopColor={fur} />
          <stop offset="1" stopColor={shade} />
        </radialGradient>
      </defs>
      <ellipse cx="120" cy="212" rx={66 * scale} ry="6.5" fill="currentColor" opacity="0.1" className="pet-shadow" />
      <g className="pet-scale" style={{ transform: `translate(120px, 212px) scale(${scale}) translate(-120px, -212px)` }}>
        <g className="pet-jump">
          <g className="pet-body">
            <g className="pet-tail" style={{ transformOrigin: species === "fox" ? "162px 170px" : "168px 172px" }}>{tail()}</g>
            {body()}
            {legs()}
            <g className="pet-head" style={{ transformOrigin: `120px ${h.cy + 40}px` }}>
              <g className="pet-ears">{ears()}</g>
              {head()}
              {cheeks && <g className="blush"><ellipse cx={120 - h.eyeDX - 8} cy={h.eyeY + 15} rx="7" ry="4" fill="#f29a9a" opacity="0.45" /><ellipse cx={120 + h.eyeDX + 8} cy={h.eyeY + 15} rx="7" ry="4" fill="#f29a9a" opacity="0.45" /></g>}
              {brows === "sad" && <g stroke={species === "panda" ? "#f6f2ea" : ink} strokeWidth="2.4" strokeLinecap="round" opacity=".75"><path d={`M${120 - h.eyeDX - 8} ${h.eyeY - eyeR - 5} l12 -4`} /><path d={`M${120 + h.eyeDX + 8} ${h.eyeY - eyeR - 5} l-12 -4`} /></g>}
              {brows === "side" && <g stroke={species === "panda" ? "#f6f2ea" : ink} strokeWidth="2.4" strokeLinecap="round" opacity=".75"><path d={`M${120 - h.eyeDX - 7} ${h.eyeY - eyeR - 4} h13`} /><path d={`M${120 + h.eyeDX - 6} ${h.eyeY - eyeR - 8} l12 3`} /></g>}
              <g className={`pet-eyes${blink ? " blinking" : ""}`}>{eye(120 - h.eyeDX, -1)}{eye(120 + h.eyeDX, 1)}</g>
              {nose()}
              {mouthPath()}
              {whiskers && <path d={`M96 ${h.cy + 14} h-16 M96 ${h.cy + 19} l-15 3 M144 ${h.cy + 14} h16 M144 ${h.cy + 19} l15 3`} stroke={ink} strokeWidth="1.3" opacity=".35" />}
              {accessory && <Wear kind={accessory} h={h} species={species} />}
              {mood === "dying" && <g className="zzz" fill="currentColor"><text x="160" y={h.top + 8} fontSize="14">z</text><text x="171" y={h.top - 4} fontSize="11">z</text></g>}
              {g === "nap" && <g className="zzz" fill="currentColor"><text x="160" y={h.top + 8} fontSize="14">z</text><text x="171" y={h.top - 4} fontSize="11">z</text></g>}
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}

function Wear({ kind, h, species }: { kind: Accessory; h: (typeof HEAD)[Species]; species: Species }) {
  const ny = h.neck;
  switch (kind) {
    case "bandana": return <g><path d={`M90 ${ny - 6} Q120 ${ny + 4} 150 ${ny - 6} L120 ${ny + 22} Z`} fill="#d9534f" /><circle cx="112" cy={ny + 2} r="1.8" fill="#fff" /><circle cx="126" cy={ny + 4} r="1.8" fill="#fff" /><circle cx="119" cy={ny + 11} r="1.8" fill="#fff" /></g>;
    case "scarf": return <g><path d={`M86 ${ny - 8} Q120 ${ny + 6} 154 ${ny - 8} L154 ${ny + 2} Q120 ${ny + 16} 86 ${ny + 2} Z`} fill="#3f9e8f" /><path d={`M138 ${ny + 4} l6 26 l10 -2 l-4 -26 Z`} fill="#358a7c" /></g>;
    case "bow": { const x = species === "rabbit" ? 120 : 98, y = h.top + 4; return <g><path d={`M${x} ${y} l-13 -8 v16 Z M${x} ${y} l13 -8 v16 Z`} fill="#ec7aa4" stroke="#c9557f" strokeWidth="1.2" strokeLinejoin="round" /><circle cx={x} cy={y} r="4" fill="#c9557f" /></g>; }
    case "flowers": return <g>{[-30, -15, 0, 15, 30].map((dx, i) => <g key={dx} transform={`translate(${120 + dx} ${h.top + 4 + Math.abs(dx) * 0.22})`}>{[0, 72, 144, 216, 288].map((a) => <circle key={a} cx={Math.cos((a * Math.PI) / 180) * 3.6} cy={Math.sin((a * Math.PI) / 180) * 3.6} r="3" fill={["#f6c445", "#f08bb0", "#9ed0f0", "#f08bb0", "#f6c445"][i]} />)}<circle r="2.2" fill="#fff6d8" /></g>)}</g>;
    case "glasses": return <g fill="none" stroke="#2a2320" strokeWidth="2.4"><circle cx={120 - h.eyeDX} cy={h.eyeY} r={h.eyeR + 5} /><circle cx={120 + h.eyeDX} cy={h.eyeY} r={h.eyeR + 5} /><path d={`M${120 - h.eyeDX + h.eyeR + 5} ${h.eyeY} h${2 * h.eyeDX - 2 * h.eyeR - 10}`} /></g>;
    case "crown": return <g><path d={`M102 ${h.top + 6} l2 -16 l8 9 l8 -13 l8 13 l8 -9 l2 16 Z`} fill="#f2c230" stroke="#c99a12" strokeWidth="1.4" strokeLinejoin="round" /><circle cx="120" cy={h.top - 1} r="2.4" fill="#e65d5d" /></g>;
  }
}

/** Whether this species should be drawn in 3D right now: the setting is on, the phone can do it and it hasn't failed. */
function use3d(species: Species) {
  const [failed, setFailed] = useState(false);
  return { on: !failed && has3D(species) && webglOk(), fail: () => { markPet3d("failed"); setFailed(true); } };
}

/** A calm blank disc while the model loads, so the old drawing never flashes in before the 3D pet. */
const Waiting3D = ({ size }: { size: number }) => <span className="pet3d-wait" style={{ width: size, height: size }} aria-hidden />;

/**
 * A pet for small, non-interactive spots (the Pets grid, the profile): the same 3D or drawn art as the home screen,
 * following the same setting. `still` forces the drawing, for lists too long to give every pet its own 3D view.
 */
export function PetPortrait({ still, ...art }: ArtProps & { still?: boolean }) {
  const reduce = useReducedMotion();
  const t = use3d(art.species);
  const size = art.size ?? 280;
  if (!t.on || still) return <CompanionArt {...art} />;
  return (
    <Suspense fallback={<Waiting3D size={size} />}>
      <Pet3D species={art.species as Species3D} coat={art.coat} stage={art.stage} mood={art.mood} age={art.age} gesture={art.gesture} reduced={!!reduce}
        size={size} onFail={t.fail} loading={<Waiting3D size={size} />} fallback={<CompanionArt {...art} />} />
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
  const [blink, setBlink] = useState(false);
  const [hearts, setHearts] = useState(0);
  const [sparks, setSparks] = useState(0);
  const lastMove = useRef(0);
  const pokes = useRef<number[]>([]);
  const stroke = useRef<{ x: number; dist: number; down: boolean }>({ x: 0, dist: 0, down: false });
  const touchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const low = art.mood === "dying" || art.stage === "frail" || art.stage === "dead";
  const t3d = use3d(art.species);

  // Blink on an irregular rhythm, like something alive.
  useEffect(() => {
    if (reduce) return;
    let t: ReturnType<typeof setTimeout>;
    const next = () => { t = setTimeout(() => { setBlink(true); setTimeout(() => setBlink(false), 140); next(); }, 2200 + Math.random() * 4200); };
    next();
    return () => clearTimeout(t);
  }, [reduce]);

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
        ? <Suspense fallback={<Waiting3D size={art.size ?? 280} />}><Pet3D species={art.species as Species3D} coat={art.coat} stage={art.stage} mood={art.mood} age={art.age} gesture={gesture} look={look} reduced={!!reduce}
            size={art.size ?? 280} onFail={t3d.fail} loading={<Waiting3D size={art.size ?? 280} />} fallback={<CompanionArt {...art} look={look} gesture={gesture} blink={blink} />} /></Suspense>
        : <CompanionArt {...art} look={look} gesture={gesture} blink={blink && gesture !== "nap"} />}
      <Burst burst={hearts} kind="heart" count={6} />
      <Burst burst={sparks} kind="spark" count={8} />
    </motion.div>
  );
}
