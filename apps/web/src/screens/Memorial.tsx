import { useState } from "react";
import { CompanionArt } from "../Companion";
import { deathLine } from "../copy";
import { addDays, daysBetween } from "../dates";
import { actions, useData, type CompanionView } from "../store";
import type { Species } from "../types";

export function Memorial({ view, onDone }: { view: CompanionView; onDone: () => void }) {
  const data = useData();
  const { companion, habit } = view;
  const [name, setName] = useState("");
  const [species, setSpecies] = useState<Species>(companion.species);
  const es = data.entries.filter((e) => e.companionId === companion.id);
  const lived = daysBetween(companion.bornOn, companion.diedOn ?? companion.bornOn) + 1;
  const spend = es.reduce((a, e) => a + (e.amount ?? 0), 0);
  const lastMonth = es.filter((e) => e.day > addDays(companion.diedOn ?? companion.bornOn, -30)).length;
  const tone = data.settings.tone;

  return (
    <main className="screen memorial">
      <h1 className="fade-in">{companion.name}</h1>
      {data.settings.deathScene && <div className="card fade-in" style={{ width: "100%" }}><CompanionArt species={companion.species} stage="frail" mood="dying" age={100} size={240} /></div>}
      <p className="fade-in">{deathLine(tone, companion.name)}</p>
      <section className="card stack" style={{ width: "100%", textAlign: "left" }}>
        <h2>A life in numbers</h2>
        <div className="row"><span>Lived</span><b>{lived} {lived === 1 ? "day" : "days"}</b></div>
        <div className="row"><span>Slips</span><b>{es.length}</b></div>
        {habit?.unit === "money" && <div className="row"><span>Spent</span><b>{data.settings.currency} {Math.round(spend).toLocaleString()}</b></div>}
        <div className="row"><span>Slips in the final month</span><b>{lastMonth}</b></div>
      </section>
      <section className="stack" style={{ width: "100%", textAlign: "left" }}>
        <h2>Start again</h2>
        <p className="muted small">The new life begins at age 0. Your history stays in your reports, and {companion.name} stays in the Hall of Companions.</p>
        <div className="chips">
          {(["dog", "cat", "rabbit"] as Species[]).map((s) => <button key={s} className="chip" aria-pressed={species === s} onClick={() => setSpecies(s)} style={{ textTransform: "capitalize" }}>{s}</button>)}
        </div>
        <label className="field">New name<input className="input" value={name} maxLength={20} placeholder="Biscuit" onChange={(e) => setName(e.target.value)} /></label>
        <button className="btn" onClick={() => { actions.adopt(habit!.id, name, species); onDone(); }}>Adopt a new puppy</button>
      </section>
    </main>
  );
}
