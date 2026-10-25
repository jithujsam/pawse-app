import { CompanionArt, type Gesture, type Mood } from "./Companion";
import { COATS, SPECIES } from "./pets";
import { Pet3D, type Species3D } from "./Pet3D";
import type { Stage } from "@detox/engine";

/** Dev-only: every species, coat, mood and stage on one page, for checking the art. Open /#gallery. */
export function Gallery() {
  // #gallery/3d/<species>: the 3D pet in each mood and stage.
  const parts = location.hash.slice(1).split("/");
  if (parts[1] === "3d") {
    const sp = (parts[2] || "dog") as Species3D;
    const rows: [string, Mood, Gesture, Stage, number][] = [["baby", "happy", "none", "baby", 3], ["young idle", "idle", "none", "young", 15], ["adult waiting", "waiting", "none", "adult", 35], ["happy", "happy", "hop", "young", 15], ["hurt", "hurt", "none", "adult", 35], ["petted", "idle", "petted", "adult", 35], ["sick old", "sick", "none", "old", 74], ["frail sad", "sad", "none", "frail", 85], ["dying", "dying", "none", "frail", 95]];
    return <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: 8 }}>{rows.filter((_, i) => !parts[5] || String(i) === parts[5]).map(([l, m, g, st, a]) => (
      <figure key={l} style={{ margin: 0, textAlign: "center", font: "12px sans-serif" }}><Pet3D species={sp} coat={parts[3]} stage={st} mood={m} gesture={g} age={a} size={+parts[4] || 180} fallback={<b>fallback</b>} /><figcaption>{l}</figcaption></figure>))}</div>;
  }
  // #gallery/pet/<species>/<mood>: one pet alone on a clear background, for widget images.
  const [, , sp, md] = location.hash.slice(1).split("/");
  if (sp) return <div id="solo" style={{ width: 256, display: "inline-block" }}><CompanionArt species={sp as never} stage="young" mood={(md as Mood) || "happy"} age={12} size={256} /></div>;
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
