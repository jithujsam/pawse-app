import type { Stage } from "@detox/engine";
import type { Species } from "./types";

export type Mood = "idle" | "waiting" | "happy" | "hurt" | "sick" | "dying";

export const ACCENT: Record<Species, string> = { dog: "#c98a4b", cat: "#8f8f9c", rabbit: "#d4b8a0" };

const STAGE_SCALE: Record<Stage, number> = { baby: 0.74, young: 0.88, adult: 1, middle: 1.04, old: 1, frail: 0.94, dead: 0.9 };
const STAGE_GREY: Record<Stage, number> = { baby: 0, young: 0, adult: 0.05, middle: 0.5, old: 0.85, frail: 1, dead: 1 };

function coat(species: Species, age: number) {
  const base = { dog: [30, 52, 58], cat: [240, 6, 60], rabbit: [24, 38, 74] }[species];
  const t = Math.min(1, age / 100);
  return `hsl(${base[0]} ${Math.round(base[1] * (1 - 0.55 * t))}% ${Math.round(base[2] - 16 * t)}%)`;
}

export function moodFor(stage: Stage, opts: { checkedToday: boolean; slippedToday: boolean; justLogged?: "slip" | "clean" | null; age: number }): Mood {
  if (opts.justLogged === "slip") return "hurt";
  if (opts.justLogged === "clean") return "happy";
  if (opts.age >= 90) return "dying";
  if (stage === "old" || stage === "frail") return "sick";
  if (!opts.checkedToday) return "waiting";
  return opts.slippedToday ? "idle" : "happy";
}

export function CompanionArt({ species, stage, mood, age, size = 280 }: { species: Species; stage: Stage; mood: Mood; age: number; size?: number }) {
  const fur = coat(species, age);
  const dark = `hsl(0 0% ${20 - Math.min(8, age / 15)}%)`;
  const scale = STAGE_SCALE[stage];
  const grey = STAGE_GREY[stage];
  const frail = stage === "frail" || stage === "dead" || mood === "dying";
  const bodyRx = stage === "frail" ? 46 : stage === "middle" ? 60 : 55;
  const headDrop = frail ? 22 : stage === "old" ? 8 : 0;
  const baby = stage === "baby";
  const eyeR = baby ? 9 : 6.5;
  const cloudy = stage === "old" || stage === "frail";
  const asleep = mood === "dying";
  const classes = [
    "pet",
    mood === "happy" && "pet-happy", mood === "hurt" && "pet-hurt", mood === "sick" && "pet-sick",
    mood === "dying" && "pet-dying", mood === "waiting" && "pet-waiting", baby && "pet-baby",
  ].filter(Boolean).join(" ");

  return (
    <svg className={classes} viewBox="20 24 200 190" width={size} height={size * (190 / 200)} role="img"
      aria-label={`${species}, ${stage}, ${mood}`}>
      <ellipse cx="120" cy="206" rx={70 * scale} ry="7" fill="currentColor" opacity="0.08" />
      <g transform={`translate(120 206) scale(${scale}) translate(-120 -206)`}>
        <g className="pet-body">
          {/* tail */}
          <g className="pet-tail" style={{ transformOrigin: "172px 168px" }}>
            {species === "rabbit"
              ? <circle cx="178" cy="170" r="12" fill="#f4efe9" />
              : <path d="M172 170 C 200 160, 205 135, 192 124" stroke={fur} strokeWidth="11" strokeLinecap="round" fill="none" />}
          </g>
          {/* body */}
          <ellipse cx="120" cy="164" rx={bodyRx} ry={frail ? 32 : 38} fill={fur} />
          <ellipse cx="120" cy="176" rx={bodyRx * 0.62} ry={frail ? 18 : 22} fill="#fff" opacity="0.22" />
          {/* legs */}
          <rect x="84" y="182" width="18" height="22" rx="9" fill={fur} />
          <rect x="138" y="182" width="18" height="22" rx="9" fill={fur} />
          {/* head */}
          <g className="pet-head" transform={`translate(0 ${headDrop})`}>
            {species === "dog" && (<>
              <ellipse cx="80" cy="92" rx="15" ry="27" fill={dark} transform="rotate(14 80 92)" opacity="0.85" />
              <ellipse cx="160" cy="92" rx="15" ry="27" fill={dark} transform="rotate(-14 160 92)" opacity="0.85" />
            </>)}
            {species === "cat" && (<>
              <path d="M84 70 L88 36 L112 58 Z" fill={fur} /><path d="M156 70 L152 36 L128 58 Z" fill={fur} />
              <path d="M90 62 L92 46 L103 57 Z" fill="#e7b9b3" /><path d="M150 62 L148 46 L137 57 Z" fill="#e7b9b3" />
            </>)}
            {species === "rabbit" && (<>
              <ellipse cx="100" cy="46" rx="11" ry="34" fill={fur} transform={frail ? "rotate(-28 100 70)" : "rotate(-6 100 70)"} />
              <ellipse cx="140" cy="46" rx="11" ry="34" fill={fur} transform={frail ? "rotate(28 140 70)" : "rotate(6 140 70)"} />
              <ellipse cx="100" cy="50" rx="5" ry="22" fill="#e7b9b3" transform={frail ? "rotate(-28 100 70)" : "rotate(-6 100 70)"} />
              <ellipse cx="140" cy="50" rx="5" ry="22" fill="#e7b9b3" transform={frail ? "rotate(28 140 70)" : "rotate(6 140 70)"} />
            </>)}
            <circle cx="120" cy="100" r="43" fill={fur} />
            {/* muzzle and grey */}
            <ellipse cx="120" cy="116" rx="21" ry="16" fill="#f6efe7" />
            <ellipse cx="120" cy="116" rx="21" ry="16" fill="#9a9aa0" opacity={grey} />
            {grey > 0.3 && <path d="M80 92 C 90 80, 100 78, 108 82 M160 92 C 150 80, 140 78, 132 82" stroke="#b8b8be" strokeWidth="5" opacity={grey * 0.7} strokeLinecap="round" fill="none" />}
            <ellipse cx="120" cy="108" rx="7" ry="5" fill={dark} />
            <path d={frail || mood === "hurt" ? "M110 124 Q120 119 130 124" : "M110 120 Q120 128 130 120"} stroke={dark} strokeWidth="2.5" fill="none" strokeLinecap="round" />
            {/* eyes */}
            {asleep ? (<>
              <path d="M95 94 q8 5 16 0" stroke={dark} strokeWidth="3" fill="none" strokeLinecap="round" />
              <path d="M129 94 q8 5 16 0" stroke={dark} strokeWidth="3" fill="none" strokeLinecap="round" />
            </>) : (<g className="pet-eyes">
              <circle cx="103" cy="93" r={eyeR} fill={dark} /><circle cx="137" cy="93" r={eyeR} fill={dark} />
              {cloudy && <><circle cx="103" cy="93" r={eyeR} fill="#dfe6ee" opacity="0.65" /><circle cx="137" cy="93" r={eyeR} fill="#dfe6ee" opacity="0.65" /></>}
              <circle cx="105.5" cy="90.5" r="2.2" fill="#fff" /><circle cx="139.5" cy="90.5" r="2.2" fill="#fff" />
              {(mood === "sick" || frail) && <><path d="M93 80 l16 4" stroke={dark} strokeWidth="2.5" strokeLinecap="round" /><path d="M147 80 l-16 4" stroke={dark} strokeWidth="2.5" strokeLinecap="round" /></>}
            </g>)}
            {species !== "dog" && <path d="M92 112 h-14 M92 117 h-13 M148 112 h14 M148 117 h13" stroke={dark} strokeWidth="1.4" opacity="0.5" />}
            {mood === "sick" && <g className="pet-cough" fill="currentColor" opacity="0.35"><circle cx="158" cy="126" r="3" /><circle cx="168" cy="120" r="2.2" /><circle cx="176" cy="113" r="1.6" /></g>}
          </g>
        </g>
      </g>
    </svg>
  );
}
