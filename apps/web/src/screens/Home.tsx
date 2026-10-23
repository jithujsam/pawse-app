import { useEffect, useState } from "react";
import { STAGE_LABEL } from "@detox/engine";
import { ACCENT, CompanionArt, moodFor } from "../Companion";
import { cleanLine, dyingBanner, statusLine, waitingLine } from "../copy";
import { fmtDay, today, weekStart } from "../dates";
import { actions, activeCompanion, cleanStreak, useData, viewCompanion, weekStats, type Deduction } from "../store";
import { LogSheet } from "./LogSheet";

export function Home() {
  const data = useData();
  const companion = activeCompanion(data)!;
  const view = viewCompanion(data, companion.id);
  const habit = view.habit!;
  const { tone, currency } = data.settings;
  const [sheet, setSheet] = useState(false);
  const [just, setJust] = useState<"slip" | "clean" | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => { if (!just) return; const t = setTimeout(() => setJust(null), 3500); return () => clearTimeout(t); }, [just]);

  const slippedToday = data.entries.some((e) => e.habitId === habit.id && e.day === today());
  const cleanToday = data.cleanDays.some((c) => c.habitId === habit.id && c.day === today());
  const checked = slippedToday || cleanToday;
  const mood = moodFor(view.stage, { checkedToday: checked, slippedToday, justLogged: just, age: view.age });
  const week = weekStats(data, habit.id, weekStart(today()));
  const streak = cleanStreak(data, habit.id);
  const age = Math.round(view.age);
  const danger = view.age >= 80;

  const line = note ?? (just === "clean" ? cleanLine(tone, companion.name, streak) : !checked ? waitingLine(tone, companion.name) : statusLine(tone, companion.name, view.stage));

  function clean() {
    if (actions.markClean(habit.id)) { setJust("clean"); setNote(null); }
    else setNote("You already logged a slip today, so today can't be marked clean.");
  }
  function saved(d: Deduction) { setJust("slip"); setNote(null); void d; }

  return (
    <main className="screen" style={{ ["--pet" as string]: ACCENT[companion.species] }}>
      <section className="hero" aria-label={`${companion.name}, age ${age}`}>
        <div className="title"><h1>{companion.name}</h1><span className="muted small">{fmtDay(today())}</span></div>
        <CompanionArt species={companion.species} stage={view.stage} mood={mood} age={view.age} size={330} />
        <div className="agetext"><span><b>Age {age}</b> · {STAGE_LABEL[view.stage]}</span><span className="muted">Life left {100 - age}</span></div>
        <div className={`agebar${danger ? " danger" : ""}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={age} aria-label="Visible age"><i style={{ width: `${age}%` }} /></div>
        <p style={{ width: "100%" }} aria-live="polite">{line}</p>
      </section>

      {view.age >= 90 && <div className="banner danger" role="alert">{dyingBanner(companion.name, view.age)}</div>}

      <section className="stack" aria-label="Today's check-in">
        <h2>Today's check-in</h2>
        <div className="actions">
          <button className="btn" onClick={() => setSheet(true)}>I slipped</button>
          <button className="btn secondary" onClick={clean} disabled={cleanToday}>{cleanToday ? "Clean today ✓" : "Clean today"}</button>
        </div>
      </section>

      <section className="stats" aria-label="This week">
        <div className="card stat"><div className="muted small">Slips this week</div><div className="v">{week.slips}</div></div>
        <div className="card stat"><div className="muted small">Clean streak</div><div className="v">{streak} {streak === 1 ? "day" : "days"}</div></div>
        {habit.unit === "money" && <div className="card stat" style={{ gridColumn: "1 / -1" }}><div className="muted small">Spent this week</div><div className="v">{currency} {Math.round(week.spend).toLocaleString()}</div></div>}
      </section>

      {sheet && <LogSheet habit={habit} name={companion.name} onClose={() => setSheet(false)} onSaved={saved} />}
    </main>
  );
}
