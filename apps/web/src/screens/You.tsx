import { useState } from "react";
import { CompanionArt } from "../Companion";
import { DISCLAIMER, PROFESSIONAL_NOTE, TONES } from "../copy";
import { actions, activeCompanion, useData, viewCompanion } from "../store";
import type { Field, FieldType } from "../types";

const TYPES: FieldType[] = ["text", "number", "money", "yesno", "photo"];

export function You() {
  const data = useData();
  const companion = activeCompanion(data)!;
  const habit = data.habits[0];
  const { settings } = data;
  const [confirm, setConfirm] = useState(false);
  const [showProf] = useState(() => ["alcohol", "smoking"].includes(habit.cls) && !localStorage.getItem("detox-prof-note"));
  if (showProf) try { localStorage.setItem("detox-prof-note", "1"); } catch { /* ignore */ }
  const hall = data.companions.filter((c) => c.diedOn);

  const setField = (id: string, patch: Partial<Field>) => actions.updateHabitFields(habit.id, habit.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const addField = () => actions.updateHabitFields(habit.id, [...habit.fields, { id: Math.random().toString(36).slice(2, 8), label: "New question", type: "text", required: false }]);
  const rmField = (id: string) => actions.updateHabitFields(habit.id, habit.fields.filter((f) => f.id !== id));

  function demo(perDay: number, days: number) {
    actions.backdateBirth(companion.id, days);
    actions.demoWeek(habit.id, perDay, days);
  }

  return (
    <main className="screen">
      <h1>You</h1>
      {showProf && <div className="banner" role="note">{PROFESSIONAL_NOTE}</div>}

      <section className="card stack">
        <h2>Tone</h2>
        <div className="chips" role="group" aria-label="Tone">
          {TONES.map((t) => <button key={t.id} className="chip" aria-pressed={settings.tone === t.id} onClick={() => actions.setTone(t.id)}>{t.label}</button>)}
        </div>
        <p className="muted small">“{TONES.find((t) => t.id === settings.tone)!.sample}”</p>
      </section>

      <section className="card stack">
        <h2>Daily reminder</h2>
        <input className="input" type="time" aria-label="Reminder time" value={settings.reminder} onChange={(e) => actions.setSettings({ reminder: e.target.value })} />
        <p className="muted small">Saved. Phone notifications arrive in a later version.</p>
        <label className="field">Currency label<input className="input" value={settings.currency} maxLength={4} onChange={(e) => actions.setSettings({ currency: e.target.value })} /></label>
        <label className="row"><span>Show the death scene</span>
          <input type="checkbox" checked={settings.deathScene} onChange={(e) => actions.setSettings({ deathScene: e.target.checked })} style={{ width: 24, height: 24 }} /></label>
      </section>

      <section className="card stack">
        <h2>{habit.name}: questions</h2>
        {habit.fields.map((f) => (
          <div className="item" key={f.id}>
            <input className="input" value={f.label} aria-label="Question" onChange={(e) => setField(f.id, { label: e.target.value })} />
            <div className="row">
              <select className="input" style={{ width: "auto" }} value={f.type} aria-label="Type" onChange={(e) => setField(f.id, { type: e.target.value as FieldType })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
              <button className="btn danger" onClick={() => rmField(f.id)}>Remove</button>
            </div>
          </div>
        ))}
        <button className="btn secondary" onClick={addField}>Add a question</button>
      </section>

      <section className="card stack">
        <h2>Hall of Companions</h2>
        {hall.length === 0 ? <p className="muted">Nobody yet. {companion.name} is still here.</p> : (
          <div className="hall">
            {hall.map((c) => { const v = viewCompanion(data, c.id); return (
              <div className="item" key={c.id} style={{ justifyItems: "center" }}>
                <CompanionArt species={c.species} stage="frail" mood="dying" age={100} size={110} />
                <b>{c.name}</b><span className="muted small">{data.entries.filter((e) => e.companionId === v.companion.id).length} slips</span>
              </div>); })}
          </div>
        )}
      </section>

      <section className="card stack">
        <h2>Try it</h2>
        <p className="muted small">Fills the past with slips so you can watch {companion.name} age, and see the memorial. The only way back is Delete all data below.</p>
        <div className="actions">
          <button className="btn secondary" onClick={() => demo(1, 7)}>A rough week</button>
          <button className="btn secondary" onClick={() => demo(3, 30)}>A bad month</button>
          <button className="btn secondary" style={{ gridColumn: "1 / -1" }} onClick={() => demo(3, 120)}>Reach the end</button>
        </div>
      </section>

      <section className="card stack">
        <h2>Safety and data</h2>
        <p className="small">{DISCLAIMER}</p>
        <p className="small muted">If you are in crisis: India, Tele-MANAS 14416. US, call or text 988. Elsewhere, contact your local emergency number.</p>
        <button className="btn secondary" onClick={async () => {
          const text = actions.exportJson();
          try { await navigator.clipboard.writeText(text); alert("Copied your data to the clipboard."); }
          catch { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "application/json" })); a.download = "detox-companion.json"; a.click(); }
        }}>Export my data</button>
        {!confirm ? <button className="btn danger" onClick={() => setConfirm(true)}>Delete all data</button> : (
          <div className="actions"><button className="btn danger" onClick={() => actions.resetAll()}>Yes, delete everything</button><button className="btn secondary" onClick={() => setConfirm(false)}>Cancel</button></div>
        )}
      </section>
    </main>
  );
}
