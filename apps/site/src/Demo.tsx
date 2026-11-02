import { useId, useMemo, useState } from "react";
import { CONSISTENCY_DAYS, RECOVERY_DAYS, THRIVING_REWARD_EVERY, type AdoptionMode } from "@detox/engine";
import { missionText, rewardName, tierWord } from "../../web/src/mission-text";
import { Dog } from "./Dog";
import { dogState, jumpTo, toRecords, view, type Mark } from "./demo";

const MAX_DAY = 60;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The live panel: the app's mission engine and the app's dog, driven by the visitor. Nothing is saved. */
export function Demo() {
  const [mode, setMode] = useState<AdoptionMode>("rescue");
  const [marks, setMarks] = useState<Mark[]>([]);
  const [tapped, setTapped] = useState(0);
  const v = useMemo(() => view(mode, marks), [mode, marks]);
  const { j } = v;
  const dog = dogState(v, tapped > 0);
  const sliderId = useId();
  const tap = (m: Mark) => { setMarks((x) => (x.length >= MAX_DAY ? x : [...x, m])); setTapped((n) => n + 1); window.setTimeout(() => setTapped(0), 1400); };
  const healedWord = mode === "rescue" ? "Healed" : "Learned";

  let big: string, unit: string;
  if (j.phase === "recovery") { big = String(RECOVERY_DAYS - j.run); unit = `goal-met ${RECOVERY_DAYS - j.run === 1 ? "day" : "days"} to ${mode === "rescue" ? "recover" : "raise"} Miso`; }
  else if (j.issue) { big = String(j.issue.need - j.issue.have); unit = `goal-met ${j.issue.need - j.issue.have === 1 ? "day" : "days"} in a row to clear ${missionText(j.issue.id).title.toLowerCase()}`; }
  else if (j.phase === "consistency") { big = String(CONSISTENCY_DAYS - j.consistency); unit = "days of consistency, then Miso is thriving"; }
  else { big = "Thriving"; unit = `${plural(j.thriving, "well day", "well days")}. Next reward in ${THRIVING_REWARD_EVERY - (j.thriving % THRIVING_REWARD_EVERY)} days.`; }

  const status = j.phase === "recovery"
    ? (j.bestRun > j.run ? `Day ${j.run} of 21 · best run ${j.bestRun}` : `Day ${j.run} of 21`)
    : j.phase === "consistency" ? `Recovered · consistency ${j.consistency} of 21` : "Recovered and thriving";
  // What the last day did, as the app's pop-ups say it (one event per day is shown, like missionUpdate()).
  const lastDay = marks.length ? toRecords(marks).at(-1)!.day : null;
  const latest = lastDay ? j.events.filter((e) => e.day === lastDay).at(-1) ?? null : null;
  const latestLine = !marks.length ? (mode === "rescue" ? "Miso arrives with six conditions. Press Goal met to start." : "Miso is a healthy young dog with six things to learn. Press Goal met to start.")
    : !latest ? (marks.at(-1) === "slip" ? "A slip with no run going yet: still day 0." : "A goal-met day.")
    : latest.kind === "healed" ? `${missionText(latest.id!).title}: ${healedWord.toLowerCase()}.`
    : latest.kind === "recovered" ? (mode === "rescue" ? "Miso is recovered. Now 21 days of consistency." : "Miso is trained. Now 21 days of consistency.")
    : latest.kind === "restart" ? `Recovery starts over. The best run, ${j.bestRun}, is kept.`
    : latest.kind === "issue" ? `${tierWord(latest.tier!)} issue: ${missionText(latest.id!).title.toLowerCase()}. No restart.`
    : latest.kind === "cleared" ? `${missionText(latest.id!).title}: cleared.`
    : `Reward: ${rewardName(latest.n!)}.`;

  return (
    <div className="demo" data-ui>
      <div className="demo-stage">
        <div className="demo-dog dog-box">
          <Dog mood={dog.mood} gesture={dog.gesture} condition={mode === "rescue" ? v.traits : undefined}
            poster={mode === "rescue" ? "/renders/rescue.webp" : "/renders/raise.webp"} posterAlt="Miso, the demo dog" />
        </div>
        <div className="demo-read">
          <p className="demo-status">{status}</p>
          <p className="demo-big"><span className="demo-num">{big}</span> <span className="demo-unit">{unit}</span></p>
          <div className="demo-bar" role="img" aria-label={`Wellness ${v.wellness} of 100`}>
            {Array.from({ length: 20 }, (_, i) => <i key={i} data-on={i < v.wellness / 5 ? "" : undefined} />)}
          </div>
          <p className="demo-news" aria-live="polite">{latestLine}</p>
          <ul className="demo-list" aria-label={mode === "rescue" ? "Conditions" : "Skills"}>
            {j.missions.map((m) => (
              <li key={m.id} data-status={j.phase === "recovery" ? m.status : "healed"}>
                <span className="demo-day">Day {m.at}</span> {missionText(m.id).title}
                <span className="sr-only">{j.phase !== "recovery" || m.status === "healed" ? `, ${healedWord.toLowerCase()}` : m.status === "current" ? ", next" : ""}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="demo-controls">
        <div className="demo-row" role="radiogroup" aria-label="Journey">
          <span className="demo-label">Journey</span>
          <span className="seg">
            {(["rescue", "raise"] as const).map((m) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => { setMode(m); setMarks([]); setTapped(0); }}>{m === "rescue" ? "Rescue" : "Raise"}</button>
            ))}
          </span>
        </div>
        <div className="demo-row">
          <span className="demo-label">Today</span>
          <span className="demo-acts">
            <button type="button" className="act act-met" onClick={() => tap("met")} disabled={marks.length >= MAX_DAY}>Goal met</button>
            <button type="button" className="act act-slip" onClick={() => tap("slip")} disabled={marks.length >= MAX_DAY}>Slip</button>
          </span>
        </div>
        <div className="demo-row demo-row-slider">
          <label className="demo-label" htmlFor={sliderId}>Days logged</label>
          <span className="demo-value">{marks.length}</span>
          <input id={sliderId} type="range" min={0} max={MAX_DAY} step={1} value={marks.length} onChange={(e) => { setMarks((x) => jumpTo(x, Number(e.target.value))); setTapped(0); }} />
        </div>
        <div className="demo-row"><span className="demo-label">Wellness</span><span className="demo-value">{v.wellness}</span></div>
        <div className="demo-row"><span className="demo-label">Stage</span><span className="demo-value">{j.phase === "recovery" ? "Recovery" : j.phase === "consistency" ? "Consistency" : "Thriving"}</span></div>
        <div className="demo-row"><span className="demo-label">Issue</span><span className="demo-value">{j.issue ? `${tierWord(j.issue.tier)}, ${j.issue.have} of ${j.issue.need}` : "None"}</span></div>
        <div className="demo-row"><span className="demo-label">Rewards</span><span className="demo-value">{j.rewards}</span></div>
        <div className="demo-row"><button type="button" className="demo-reset" onClick={() => { setMarks([]); setTapped(0); }}>Start over</button></div>
      </div>
    </div>
  );
}
