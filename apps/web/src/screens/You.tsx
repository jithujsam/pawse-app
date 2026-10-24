import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CompanionArt } from "../Companion";
import { DISCLAIMER, PROFESSIONAL_NOTE, TONES, tonePreview } from "../copy";
import { haptic } from "../haptics";
import { cancelDaily, requestReminders, scheduleDaily } from "../notify";
import { rise, spring, stagger } from "../motion";
import { actions, useActiveView, useData } from "../store";
import { configured } from "../supabase";
import { Button, Icon, Segmented, Switch } from "../ui/Controls";
import { toast } from "../ui/Toast";
import { Account } from "./Account";
import { SecurityCard } from "./Security";
import { Simulator } from "./Simulator";
import type { Field, FieldType, Tint } from "../types";

const TYPES: { value: FieldType; label: string }[] = [
  { value: "choice", label: "Pick one" }, { value: "multi", label: "Pick any" }, { value: "scale", label: "1 to 5" }, { value: "text", label: "Text" },
  { value: "number", label: "Number" }, { value: "money", label: "Money" }, { value: "yesno", label: "Yes / no" }, { value: "photo", label: "Photo" },
];
const TINTS: [Tint, string][] = [["ocean", "#7fb1e6"], ["meadow", "#86d1a4"], ["blossom", "#f0a0c0"], ["sunrise", "#f1cb6c"]];

export function You() {
  const data = useData();
  const view = useActiveView()!;
  const { companion } = view;
  const habit = data.habits[0];
  const { settings } = data;
  const [confirm, setConfirm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [sim, setSim] = useState(false);
  const [showProf] = useState(() => {
    try { const show = ["alcohol", "smoking"].includes(habit.cls) && !localStorage.getItem("detox-prof-note"); if (show) localStorage.setItem("detox-prof-note", "1"); return show; } catch { return false; }
  });
  const hall = data.companions.filter((c) => c.diedOn);

  const setField = (id: string, patch: Partial<Field>) => actions.updateHabitFields(habit.id, habit.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const addField = () => { haptic.tap(); actions.updateHabitFields(habit.id, [...habit.fields, { id: Math.random().toString(36).slice(2, 8), label: "New question", type: "choice", required: false, options: [{ id: "yes", label: "Yes" }, { id: "no", label: "No" }] }]); };
  const rmField = (id: string) => {
    const before = habit.fields;
    actions.updateHabitFields(habit.id, habit.fields.filter((f) => f.id !== id));
    toast("Question removed", { action: { label: "Undo", run: () => actions.updateHabitFields(habit.id, before) } });
  };

  async function toggleReminders(on: boolean) {
    if (!on) { await cancelDaily(); actions.setSettings({ remindersOn: false }); return; }
    const ok = await requestReminders(settings.reminder, settings.tone, companion.name);
    if (!ok) toast("Notifications are blocked. You can allow them in your phone's settings.", { kind: "bad" });
  }
  async function setReminder(time: string) {
    actions.setSettings({ reminder: time });
    if (settings.remindersOn) await scheduleDaily(time, settings.tone, companion.name);
  }

  function exportData() {
    const text = actions.exportJson();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    a.download = `companion-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast("Your data was saved as a file", { kind: "good" });
  }

  return (
    <motion.main className="screen" variants={stagger} initial="hidden" animate="show">
      <motion.div className="profile" variants={rise}>
        <CompanionArt species={companion.species} stage={view.stage} mood="idle" age={view.age} size={72} />
        <div><h1>{companion.name}</h1><p className="muted small">Watching: {habit.name}</p></div>
      </motion.div>
      {showProf && <motion.div className="banner" role="note" variants={rise}>{PROFESSIONAL_NOTE}</motion.div>}

      {configured && (
        <motion.section className="card stack" variants={rise}>
          <div className="row" style={{ justifyContent: "flex-start", gap: 8 }}>{Icon.cloud}<h2>Account and backup</h2></div>
          <Account />
        </motion.section>
      )}

      <motion.div variants={rise}><SecurityCard /></motion.div>

      <motion.section className="card stack" variants={rise}>
        <h2>Voice</h2>
        <Segmented label="Tone" value={settings.tone} onChange={(t) => { actions.setTone(t); if (settings.remindersOn) void scheduleDaily(settings.reminder, t, companion.name); }} options={TONES.map((t) => ({ value: t.id, label: t.label }))} />
        <AnimatePresence mode="wait"><motion.p key={settings.tone} className="muted small" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>“{tonePreview(settings.tone, companion.name)}”</motion.p></AnimatePresence>
        <h2>Colours</h2>
        <div className="tintrow" role="radiogroup" aria-label="Colour">
          {TINTS.map(([id, c]) => (
            <motion.button key={id} role="radio" className="swatch" aria-label={id} aria-checked={settings.tint === id} style={{ background: c }}
              whileTap={{ scale: 0.88 }} animate={{ scale: settings.tint === id ? 1.12 : 1 }} transition={spring.bouncy}
              onClick={() => { haptic.select(); actions.setSettings({ tint: id }); }}>
              {settings.tint === id && <motion.span className="swatch-check" initial={{ scale: 0 }} animate={{ scale: 1 }}>{Icon.check}</motion.span>}
            </motion.button>
          ))}
        </div>
      </motion.section>

      <motion.section className="card stack" variants={rise}>
        <h2>Reminders and feel</h2>
        <Switch checked={settings.remindersOn} onChange={toggleReminders} label="Daily check-in reminder" hint={settings.remindersOn ? `Every day at ${settings.reminder}` : "Off"} />
        <AnimatePresence>{settings.remindersOn && (
          <motion.label className="field" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <span className="field-label">Time</span>
            <input className="input" type="time" value={settings.reminder} onChange={(e) => void setReminder(e.target.value)} />
          </motion.label>
        )}</AnimatePresence>
        <Switch checked={settings.haptics} onChange={(v) => actions.setSettings({ haptics: v })} label="Haptics" hint="Small vibrations when you tap" />
        <Switch checked={settings.deathScene} onChange={(v) => actions.setSettings({ deathScene: v })} label="Show the farewell scene" hint="Turn off to see only the memorial text" />
        <label className="field"><span className="field-label">Currency label</span><input className="input" value={settings.currency} maxLength={4} onChange={(e) => actions.setSettings({ currency: e.target.value })} /></label>
      </motion.section>

      <motion.section className="card stack" variants={rise}>
        <div className="row"><h2>Check-in questions</h2><Button variant="text" onClick={() => setEditing(!editing)}>{editing ? "Done" : "Edit"}</Button></div>
        <motion.div className="list" layout>
          <AnimatePresence initial={false}>
            {habit.fields.map((f) => (
              <motion.div layout className="item" key={f.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={spring.soft}>
                {editing ? (<>
                  <input className="input" value={f.label} aria-label="Question" maxLength={80} onChange={(e) => setField(f.id, { label: e.target.value })} />
                  <div className="row">
                    <select className="input select" value={f.type} aria-label="Type" onChange={(e) => setField(f.id, { type: e.target.value as FieldType })}>{TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
                    <button className="icon-btn danger" aria-label="Remove question" onClick={() => rmField(f.id)}>{Icon.trash}</button>
                  </div>
                  {(f.type === "choice" || f.type === "multi") && (
                    <input className="input" aria-label="Answers, separated by commas" placeholder="Answers, separated by commas" maxLength={300}
                      defaultValue={(f.options ?? []).map((o) => o.label).join(", ")}
                      onBlur={(e) => setField(f.id, { options: e.target.value.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 12).map((label) => ({ id: f.options?.find((o) => o.label === label)?.id ?? label.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40), label: label.slice(0, 40), trigger: f.options?.find((o) => o.label === label)?.trigger })) })} />
                  )}
                </>) : (
                  <div className="row"><span>{f.label}</span><span className="muted small">{TYPES.find((t) => t.value === f.type)?.label}</span></div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
        {editing && <div className="actions">
          <Button variant="secondary" onClick={addField}>Add a question</Button>
          <Button variant="secondary" onClick={() => { const before = habit.fields; actions.refreshQuestions(habit.id); toast("Switched to the recommended questions", { action: { label: "Undo", run: () => actions.updateHabitFields(habit.id, before) } }); }}>Use recommended</Button>
        </div>}
      </motion.section>

      <motion.section className="card stack" variants={rise}>
        <h2>Hall of Companions</h2>
        {hall.length === 0 ? <p className="muted">Nobody yet. {companion.name} is still here.</p> : (
          <div className="hall">
            {hall.map((c) => (
              <div className="item hall-item" key={c.id}>
                <CompanionArt species={c.species} stage="frail" mood="dying" age={100} size={96} />
                <b>{c.name}</b><span className="muted small">{data.entries.filter((e) => e.companionId === c.id).length} slips</span>
              </div>
            ))}
          </div>
        )}
      </motion.section>

      <motion.section className="card stack" variants={rise}>
        <h2>Safety and data</h2>
        <p className="small">{DISCLAIMER}</p>
        <p className="small muted">If you are in crisis: India, Tele-MANAS 14416. US, call or text 988. Elsewhere, contact your local emergency number.</p>
        <div className="actions">
          <Button variant="secondary" onClick={exportData}>Export</Button>
          <label className="btn secondary file-btn">Restore<input type="file" accept="application/json,.json" className="sr-only" onChange={async (e) => {
            const f = e.target.files?.[0]; e.target.value = "";
            if (!f) return;
            if (f.size > 50_000_000) { toast("That file is too big to be a backup", { kind: "bad" }); return; }
            const ok = actions.importJson(await f.text());
            toast(ok ? "Backup restored" : "That file isn't a Companion backup", { kind: ok ? "good" : "bad" });
          }} /></label>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          {!confirm
            ? <motion.div key="a" exit={{ opacity: 0 }}><Button variant="danger" onClick={() => setConfirm(true)}>Delete all data</Button></motion.div>
            : <motion.div key="b" className="stack tight" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                <p className="small">This removes {companion.name}, every log and your settings from this phone. It can't be undone.</p>
                <div className="actions"><Button variant="danger" onClick={() => { haptic.heavy(); void actions.resetAll(); }}>Yes, delete</Button><Button variant="secondary" onClick={() => setConfirm(false)}>Cancel</Button></div>
              </motion.div>}
        </AnimatePresence>
      </motion.section>

      <motion.section className="card stack" variants={rise}>
        <div className="row" style={{ justifyContent: "flex-start", gap: 8 }}>{Icon.spark}<h2>Test the simulation</h2></div>
        <p className="muted small">Watch a life play out in fast forward: every 2 seconds is a day, and you can see how fast {companion.name} would age toward the end with different patterns. Your real logs are never touched.</p>
        <Button variant="secondary" onClick={() => setSim(true)}>Run the simulation</Button>
      </motion.section>
      <Simulator open={sim} onClose={() => setSim(false)} species={companion.species} name={companion.name} habit={habit} />
    </motion.main>
  );
}
