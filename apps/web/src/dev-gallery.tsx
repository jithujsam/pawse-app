import { CompanionArt, type Gesture, type Mood } from "./Companion";
import { COATS, SPECIES } from "./pets";
import type { Stage } from "@detox/engine";

/** Dev-only: every species, coat, mood and stage on one page, for checking the art. Open /#gallery. */
export function Gallery() {
  const moods: [Mood, Gesture, Stage, number][] = [["happy", "none", "baby", 2], ["idle", "none", "adult", 35], ["sad", "none", "adult", 40], ["hurt", "none", "young", 20], ["happy", "petted", "young", 15], ["sick", "none", "old", 74], ["dying", "none", "frail", 92], ["idle", "side", "adult", 30]];
  return (
    <div style={{ padding: 12, display: "grid", gap: 8 }}>
      {SPECIES.map((s) => (
        <div key={s.id} style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {COATS[s.id].map((c) => <CompanionArt key={c.id} species={s.id} coat={c.id} stage="young" mood="happy" age={12} size={120} />)}
          {moods.map(([m, g, st, a], i) => <CompanionArt key={i} species={s.id} stage={st} mood={m} gesture={g} age={a} size={120} accessory={i === 1 ? "scarf" : i === 4 ? "flowers" : i === 7 ? "glasses" : null} />)}
        </div>
      ))}
    </div>
  );
}
