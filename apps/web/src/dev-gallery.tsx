import { CompanionArt, type Gesture, type Mood } from "./Companion";
import { COATS, SPECIES } from "./pets";
import { Pet3D, type Species3D } from "./Pet3D";
import type { Stage } from "@detox/engine";
import { useState } from "react";
import { actions } from "./store";
import { blank } from "./persist";
import { defaultTrackState } from "./tracks";
import { shiftDays } from "./progress";
import { today } from "./dates";
import { JourneyMoment, MissionsSheet } from "./screens/MissionsSheet";
import { Home } from "./screens/Home";
import { Me } from "./screens/Me";
import { Pets } from "./screens/Pets";
import { Tutorial } from "./ui/Tutorial";
import { UpdateDialog } from "./ui/UpdateDialog";
import { previewUpdate } from "./update";

function UpdateDemo() {
  useState(() => {
    const note = "One clear number for your pet: wellness. 21 goal-met days in a row heal a rescue, your best run is always kept, and a rescued dog now talks about its past in a way that fits your habit.";
    previewUpdate({ name: "9.3.0", code: 9003, url: "https://raw.githubusercontent.com/jithujsam/pawse-releases/main/apk/x.apk", notes: note,
      history: [1, 2, 3, 4].map((k) => ({ name: `9.${3 - k}.0`, code: 9003 - k, notes: note })) });
    return true;
  });
  return <main className="screen"><UpdateDialog /></main>;
}

/** Seeds one track with `days` goal-met days ending yesterday (and optionally a slip today), then shows the Missions button. */
function MissionsDemo({ mode, days, slip, home, moment, page }: { mode: "raise" | "rescue"; days: number; slip: boolean; home: boolean; moment: boolean; page?: string }) {
  const [ready] = useState(() => {
    const T = today(), d = blank();
    actions.applyRemote({
      ...d, settings: { ...d.settings, onboarded: true, activeHabit: "h1", coachSeen: true },
      companions: [{ id: "c1", species: "dog", name: "Scout", bornOn: shiftDays(T, -60), diedOn: null, finalAge: null, trackId: "h1", adoption: mode }],
      habits: [{ id: "h1", name: "Smoking", cls: "smoking", classWeight: 1.4, companionId: "c1", unit: "count", fields: [], track: defaultTrackState(shiftDays(T, -60)) }],
      cleanDays: Array.from({ length: days }, (_, i) => ({ habitId: "h1", day: shiftDays(T, -(days - i)) })),
    });
    if (slip) actions.logSlip("h1", {});
    else if (moment) actions.markClean("h1");
    return moment ? actions.recordMissions("c1") ?? true : true;
  });
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(true);
  if (ready && moment && typeof ready === "object") return <main className="screen"><JourneyMoment event={shown ? ready : null} companionId="c1" onClose={() => setShown(false)} /></main>;
  if (ready && page === "me") return <Me />;
  if (ready && page === "pets") return <Pets onOpen={() => undefined} />;
  if (ready && page === "tutorial") return <main className="screen"><Tutorial firstRun /></main>;
  if (ready && home) return <Home />;
  return <main className="screen" style={{ padding: 16 }}>{ready && <><button className="btn" onClick={() => setOpen(true)}>Missions</button><MissionsSheet open={open} onClose={() => setOpen(false)} companionId="c1" /></>}</main>;
}

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
  // #gallery/update: the update popup with several versions of long notes, for layout checks.
  if (parts[1] === "update") return <UpdateDemo />;
  // #gallery/missions/<raise|rescue>/<goal-met days>[/slip]: the Missions button and sheet over seeded data, for layout checks.
  if (parts[1] === "missions") return <MissionsDemo mode={parts[2] === "rescue" ? "rescue" : "raise"} days={Number(parts[3] ?? 8)} slip={parts[4] === "slip"} home={parts.includes("home")} moment={parts.includes("moment")} page={parts.find((x) => ["me", "pets", "tutorial"].includes(x))} />;
  // #gallery/solo3d/<species>/<mood>: one 3D pet alone on a clear background, for widget images.
  if (parts[1] === "solo3d") return <div id="solo" style={{ width: 256, display: "inline-block" }}><Pet3D species={parts[2] as Species3D} stage="young" mood={(parts[3] as Mood) || "happy"} age={12} size={256} fallback={<b>fallback</b>} /></div>;
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
