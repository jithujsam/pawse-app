import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { STAGE_LABEL } from "@detox/engine";
import { CompanionArt, LiveCompanion } from "../Companion";
import { ACCESSORIES, COATS, PERSONALITIES, SPECIES } from "../pets";
import { has3D, pet3dStatus } from "../pet3d-support";
import { say } from "../voice";
import { DISCLAIMER, PROFESSIONAL_NOTE, TONES, tonePreview } from "../copy";
import { daysBetween, fmtDay, fmtTime, today } from "../dates";
import { TimePicker } from "../ui/TimePicker";
import { localCurrency, placeName, timeZone } from "../region";
import { haptic } from "../haptics";
import { cancelDaily, remindersSupported, requestReminders, scheduleDaily } from "../notify";
import { rise, spring, stagger } from "../motion";
import { actions, bestStreak, cleanStreak, useActiveView, useData, vault, viewCompanion } from "../store";
import { careDays } from "../recovery";
import { PlanPage } from "./Plan";
import { configured, useSession } from "../supabase";
import { useSyncStatus } from "../sync";
import { Button, Chip, Icon, Segmented, Switch } from "../ui/Controls";
import { Group, Row, SubPage } from "../ui/Settings";
import { toast } from "../ui/Toast";
import { Account } from "./Account";
import { SecurityCard } from "./Security";
import { Simulator } from "./Simulator";
import { APP_VERSION, checkForUpdate, openDownload, RELEASES_PAGE } from "../update";
import type { Field, FieldType, Settings } from "../types";

const TYPES: { value: FieldType; label: string }[] = [
  { value: "choice", label: "Pick one" }, { value: "multi", label: "Pick any" }, { value: "scale", label: "1 to 5" }, { value: "text", label: "Text" },
  { value: "number", label: "Number" }, { value: "money", label: "Money" }, { value: "yesno", label: "Yes / no" }, { value: "photo", label: "Photo" },
];
const SPECIES_LABEL: Record<string, string> = { dog: "Dog", cat: "Cat", rabbit: "Rabbit", fox: "Fox", owl: "Owl", panda: "Panda" };

type Page = "plan" | "appearance" | "pet" | "voice" | "reminders" | "questions" | "security" | "account" | "data" | "feel" | "about" | null;

export function Me() {
  const data = useData();
  const view = useActiveView()!;
  const { companion } = view;
  const habit = view.habit ?? data.habits[0];
  const { settings } = data;
  const [page, setPage] = useState<Page>(null);
  const [sim, setSim] = useState(false);
  const { session } = useSession();
  const sync = useSyncStatus();
  const together = Math.max(1, daysBetween(companion.bornOn, today()) + 1);
  const close = () => setPage(null);
  const [showProf] = useState(() => {
    try { const show = ["alcohol", "smoking"].includes(habit.cls) && !localStorage.getItem("detox-prof-note"); if (show) localStorage.setItem("detox-prof-note", "1"); return show; } catch { return false; }
  });

  return (
    <motion.main className="screen" variants={stagger} initial="hidden" animate="show">
      <motion.h1 variants={rise}>Me</motion.h1>
      <motion.button className="profile-card" variants={rise} whileTap={{ scale: 0.985 }} onClick={() => { haptic.tap(); setPage("pet"); }}>
        <span className="profile-art"><CompanionArt species={companion.species} coat={companion.coat} accessory={settings.wear} stage={view.stage} mood="idle" age={view.age} size={84} /></span>
        <span className="profile-text">
          <b className="profile-name">{companion.name}</b>
          <span className="muted small">{SPECIES_LABEL[companion.species]} · {PERSONALITIES.find((p) => p.id === (companion.personality ?? "playful"))?.label} · {STAGE_LABEL[view.stage]} · day {together}</span>
          <span className="small">Watching: {habit.name}</span>
        </span>
        <span className="srow-chev" aria-hidden>{Icon.chevR}</span>
      </motion.button>
      {showProf && <motion.div className="banner" role="note" variants={rise}>{PROFESSIONAL_NOTE}</motion.div>}

      <motion.div variants={rise}>
        <Group title="Your plan">
          <Row icon={Icon.list} label="Goal, reasons and what helps" value={settings.plan?.goal ? { stop: "Stop", reduce: "Cut down", understand: "Understand" }[settings.plan.goal] : "Not set"} onClick={() => setPage("plan")} />
        </Group>
      </motion.div>
      <motion.div variants={rise}>
        <Group title="Companion">
          <Row icon={Icon.paw} label="Your companion" value={companion.name} onClick={() => setPage("pet")} />
          <Row icon={Icon.chat} label="Voice" value={TONES.find((t) => t.id === settings.tone)?.label} onClick={() => setPage("voice")} />
        </Group>
      </motion.div>
      <motion.div variants={rise}>
        <Group title="Tracking">
          <Row icon={Icon.list} label="Check-in questions" value={`${habit.fields.length}`} onClick={() => setPage("questions")} />
          <Row icon={Icon.bell} label="Reminders" value={settings.remindersOn ? fmtTime(settings.reminder) : "Off"} onClick={() => setPage("reminders")} />
        </Group>
      </motion.div>
      <motion.div variants={rise}>
        <Group title="Privacy">
          {configured && <Row icon={Icon.cloud} label="Account and backup" value={session ? (sync.state === "error" ? "Needs attention" : "On") : "Off"} onClick={() => setPage("account")} />}
          <Row icon={Icon.lock} label="App lock" value={vault.hasPin() ? "On" : "Off"} onClick={() => setPage("security")} />
          <Row icon={Icon.data} label="Your data" onClick={() => setPage("data")} />
        </Group>
      </motion.div>
      <motion.div variants={rise}>
        <Group title="App">
          <Row icon={Icon.sun} label="Appearance" value={`${THEME_LABEL[settings.theme]} · ${ACCENT_OPTS.find((a) => a.id === settings.accent)?.label}`} onClick={() => setPage("appearance")} />
          <Row icon={Icon.phone} label="Feel and region"  value={placeName()} onClick={() => setPage("feel")} />
          <Row icon={Icon.info} label="About and help" value={APP_VERSION.name} onClick={() => setPage("about")} />
        </Group>
      </motion.div>
      <motion.div variants={rise}>
        <Group title="Developer">
          <Row icon={Icon.flask} label="Test the simulation" onClick={() => setSim(true)} />
        </Group>
      </motion.div>

      <SubPage open={page === "plan"} title="Your plan" onClose={close}><PlanPage /></SubPage>
      <SubPage open={page === "pet"} title="Your companion" onClose={close}><PetPage /></SubPage>
      <SubPage open={page === "voice"} title="Voice" onClose={close}><VoicePage /></SubPage>
      <SubPage open={page === "reminders"} title="Reminders" onClose={close}><RemindersPage /></SubPage>
      <SubPage open={page === "questions"} title="Check-in questions" onClose={close}><QuestionsPage /></SubPage>
      <SubPage open={page === "security"} title="App lock" onClose={close}><SecurityCard /></SubPage>
      {configured && <SubPage open={page === "account"} title="Account and backup" onClose={close}><section className="card stack"><Account /></section></SubPage>}
      <SubPage open={page === "data"} title="Your data" onClose={close}><DataPage /></SubPage>
      <SubPage open={page === "appearance"} title="Appearance" onClose={close}><AppearancePage /></SubPage>
      <SubPage open={page === "feel"} title="Feel and region" onClose={close}><FeelPage /></SubPage>
      <SubPage open={page === "about"} title="About and help" onClose={close}><AboutPage /></SubPage>
      <Simulator open={sim} onClose={() => setSim(false)} species={companion.species} coat={companion.coat} name={companion.name} habit={habit} />
    </motion.main>
  );
}

function PetPage() {
  const data = useData();
  const view = useActiveView()!;
  const { companion } = view;
  const habit = view.habit ?? data.habits[0];
  const { settings } = data;
  const [name, setName] = useState(companion.name);
  const hall = data.companions.filter((c) => c.diedOn);
  const best = Math.max(bestStreak(data, habit.id), cleanStreak(data, habit.id));
  const care = careDays(data, habit.id);
  // Classic rules can only be switched on if the history wouldn't already mean death under them.
  const classicDead = settings.petLife !== "classic" && viewCompanion({ ...data, settings: { ...settings, petLife: "classic" } }, companion.id).states.some((s) => s.stage === "dead");
  const save = () => {
    const n = name.trim();
    if (!n || n === companion.name) { setName(companion.name); return; }
    actions.renameCompanion(companion.id, n);
    haptic.success();
    toast(`Say hi to ${n}`, { kind: "good" });
  };
  return (<>
    <section className="card stack">
      <div className="pet-stage"><LiveCompanion species={companion.species} coat={companion.coat} personality={companion.personality} accessory={settings.wear} stage={view.stage} mood="happy" age={view.age} size={170} /></div>
      <div className="stats">
        <div className="stat item"><span className="muted small">Age</span><b className="v">{Math.round(view.age)}</b></div>
        <div className="stat item"><span className="muted small">Born</span><b>{fmtDay(companion.bornOn)}</b></div>
      </div>
    </section>
    <section className="card stack">
      <label className="field"><span className="field-label">Name</span>
        <input className="input" autoComplete="off" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} onBlur={save} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
      </label>
      <div className="field"><span className="field-label">Species</span>
        <div className="chips" role="radiogroup" aria-label="Species">
          {SPECIES.map((sp) => <Chip key={sp.id} pressed={companion.species === sp.id} onClick={() => { if (sp.id !== companion.species) { actions.setSpecies(companion.id, sp.id); haptic.success(); toast(`${companion.name} is a ${sp.label.toLowerCase()} now. Same name, same history.`, { kind: "good" }); } }}>
            {sp.label}{has3D(sp.id) && <span className="badge-3d">3D</span>}</Chip>)}
        </div>
        {!has3D(companion.species) && <span className="muted small">Dogs and foxes are animated in 3D. Others use the drawn style.</span>}
      </div>
      <div className="field"><span className="field-label">Coat</span>
        <div className="chips" role="radiogroup" aria-label="Coat">
          {COATS[companion.species].map((c) => <Chip key={c.id} pressed={(companion.coat ?? COATS[companion.species][0].id) === c.id} onClick={() => actions.setCompanionLook(companion.id, { coat: c.id, personality: companion.personality })}><i className="coat-dot" style={{ background: c.fur }} />{c.label}</Chip>)}
        </div>
      </div>
      <div className="field"><span className="field-label">Personality</span>
        <div className="choice-grid" role="radiogroup" aria-label="Personality">
          {PERSONALITIES.map((p) => (
            <motion.button key={p.id} role="radio" aria-checked={(companion.personality ?? "playful") === p.id} className="choice" whileTap={{ scale: 0.97 }}
              onClick={() => { haptic.select(); actions.setCompanionLook(companion.id, { coat: companion.coat, personality: p.id }); toast(say("petted", p.id, settings.tone), { ms: 2500 }); }}>
              <b>{p.label}</b><div className="small muted">{p.blurb}</div>
            </motion.button>
          ))}
        </div>
      </div>
    </section>
    <section className="card stack">
      <div className="row"><h2>Wardrobe</h2><span className="muted small">{care} {care === 1 ? "day" : "days"} of care</span></div>
      <div className="wardrobe">
        <motion.button className="ward" data-on={!settings.wear} whileTap={{ scale: 0.94 }} onClick={() => { haptic.select(); actions.setSettings({ wear: null }); }}><b>None</b></motion.button>
        {ACCESSORIES.map((a) => {
          const open = Math.max(best, care) >= a.days;
          return (
            <motion.button key={a.id} className="ward" data-on={settings.wear === a.id} disabled={!open} whileTap={open ? { scale: 0.94 } : undefined}
              onClick={() => { haptic.select(); actions.setSettings({ wear: a.id }); }}>
              <b>{a.label}</b><span className="small muted">{open ? "Unlocked" : `${a.days} days of care`}</span>
            </motion.button>
          );
        })}
      </div>
      <p className="muted small">Days of care are days with your goal met or an urge managed. They add up and never reset, and every unlock stays yours.</p>
    </section>
    <section className="card stack">
      <h2>How {companion.name}'s health works</h2>
      <p className="small">Slips you log age {companion.name} a little. Days with your goal met heal them. Days you don't record change nothing. {settings.petLife === "classic"
        ? "Classic rules are on: some damage is permanent, and at 100 a companion dies and you adopt a new one."
        : `${companion.name} can get very frail but never dies, and every month can heal back with enough good days.`}</p>
      <Switch checked={settings.petLife === "classic"} onChange={(v) => { if (v && classicDead) return; actions.setSettings({ petLife: v ? "classic" : "continuity" }); }}
        label="Classic rules" hint={classicDead ? `Not available: under classic rules ${companion.name}'s history would already have ended.` : "Permanent scars and death at 100. Off by default."} />
    </section>
    <section className="card stack">
      <Switch checked={settings.careNotes} onChange={(v) => actions.setSettings({ careNotes: v })} label={`Notes from ${companion.name}`} hint={settings.remindersOn ? "A thank-you after good days, and a note when it won't eat" : "Needs reminders to be on"} />
    </section>
    <section className="card stack">
      <h2>Hall of Companions</h2>
      {hall.length === 0 ? <p className="muted">Nobody yet. {companion.name} is still here.</p> : (
        <div className="hall">
          {hall.map((c) => (
            <div className="item hall-item" key={c.id}>
              <CompanionArt species={c.species} coat={c.coat} stage="frail" mood="dying" age={100} size={96} />
              <b>{c.name}</b><span className="muted small">{data.entries.filter((e) => e.companionId === c.id).length} slips</span>
            </div>
          ))}
        </div>
      )}
    </section>
  </>);
}

function VoicePage() {
  const { settings } = useData();
  const { companion } = useActiveView()!;
  return (
    <section className="card stack">
      <p className="muted">How {companion.name} talks to you, everywhere in the app and in reminders.</p>
      <Segmented label="Tone" value={settings.tone} onChange={(t) => { actions.setTone(t); if (settings.remindersOn) void scheduleDaily(settings.reminder, t, companion.name); }} options={TONES.map((t) => ({ value: t.id, label: t.label }))} />
      <AnimatePresence mode="wait"><motion.p key={settings.tone} className="bubble" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>“{tonePreview(settings.tone, companion.name)}”</motion.p></AnimatePresence>
      <p className="muted small">Every tone is respectful. It describes what happened, never who you are.</p>
    </section>
  );
}

function RemindersPage() {
  const { settings } = useData();
  const { companion } = useActiveView()!;
  async function toggle(on: boolean) {
    if (!on) { await cancelDaily(); actions.setSettings({ remindersOn: false }); return; }
    const ok = await requestReminders(settings.reminder, settings.tone, companion.name);
    if (!ok) toast(remindersSupported ? "Notifications are blocked. You can allow them in your phone's settings." : "Reminders work in the Android app. The web version can't send them on time.", { kind: "bad" });
  }
  async function setTime(time: string) {
    actions.setSettings({ reminder: time });
    if (settings.remindersOn) await scheduleDaily(time, settings.tone, companion.name);
  }
  return (
    <section className="card stack">
      <Switch checked={settings.remindersOn} onChange={toggle} label="Daily check-in reminder" hint={settings.remindersOn ? `Every day at ${fmtTime(settings.reminder)}` : "Off"} />
      <AnimatePresence>{settings.remindersOn && (
        <motion.div className="field" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
          <span className="field-label">Time</span>
          <TimePicker label="Reminder time" value={settings.reminder} onChange={(v) => void setTime(v)} />
        </motion.div>
      )}</AnimatePresence>
      <p className="muted small">One quiet nudge a day, in {companion.name}'s voice.</p>
      <Switch checked={settings.riskNudge} onChange={(v) => actions.setSettings({ riskNudge: v })} label="Risky-hour heads-up" hint="Once your pattern is clear, a note half an hour before your usual slip time" />
      <Switch checked={settings.careNotes} onChange={(v) => actions.setSettings({ careNotes: v })} label={`Notes from ${companion.name}`} hint="A thank-you after good days, and a note when it won't eat" />
    </section>
  );
}

function QuestionsPage() {
  const data = useData();
  const habit = useActiveView()!.habit ?? data.habits[0];
  const [editing, setEditing] = useState(false);
  const setField = (id: string, patch: Partial<Field>) => actions.updateHabitFields(habit.id, habit.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const addField = () => { haptic.tap(); actions.updateHabitFields(habit.id, [...habit.fields, { id: Math.random().toString(36).slice(2, 8), label: "New question", type: "choice", required: false, options: [{ id: "yes", label: "Yes" }, { id: "no", label: "No" }] }]); };
  const rmField = (id: string) => {
    const before = habit.fields;
    actions.updateHabitFields(habit.id, habit.fields.filter((f) => f.id !== id));
    toast("Question removed", { action: { label: "Undo", run: () => actions.updateHabitFields(habit.id, before) } });
  };
  return (
    <section className="card stack">
      <div className="row"><p className="muted small">Asked after each slip. Short answers make your insights sharper.</p><Button variant="text" onClick={() => setEditing(!editing)}>{editing ? "Done" : "Edit"}</Button></div>
      <motion.div className="list" layout>
        <AnimatePresence initial={false}>
          {habit.fields.map((f) => (
            <motion.div layout className="item" key={f.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={spring.soft}>
              {editing ? (<>
                <input className="input" autoComplete="off" value={f.label} aria-label="Question" maxLength={80} onChange={(e) => setField(f.id, { label: e.target.value })} />
                <div className="row">
                  <select className="input select" value={f.type} aria-label="Type" onChange={(e) => setField(f.id, { type: e.target.value as FieldType })}>{TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
                  <button className="icon-btn danger" aria-label="Remove question" onClick={() => rmField(f.id)}>{Icon.trash}</button>
                </div>
                {(f.type === "choice" || f.type === "multi") && (
                  <input className="input" autoComplete="off" aria-label="Answers, separated by commas" placeholder="Answers, separated by commas" maxLength={300}
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
    </section>
  );
}

function DataPage() {
  const { companion } = useActiveView()!;
  const { session } = useSession();
  const [confirm, setConfirm] = useState(false);
  function exportData() {
    const text = actions.exportJson();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    a.download = `pawse-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast("Your data was saved as a file", { kind: "good" });
  }
  return (<>
    <section className="card stack">
      <h2>Backup file</h2>
      <p className="muted small">A copy of everything on this phone, as a file you keep.</p>
      <div className="actions">
        <Button variant="secondary" onClick={exportData}>Export</Button>
        <label className="btn secondary file-btn">Restore<input type="file" accept="application/json,.json" className="sr-only" onChange={async (e) => {
          const f = e.target.files?.[0]; e.target.value = "";
          if (!f) return;
          if (f.size > 50_000_000) { toast("That file is too big to be a backup", { kind: "bad" }); return; }
          const ok = actions.importJson(await f.text());
          toast(ok ? "Backup restored" : "That file isn't a Pawse backup", { kind: ok ? "good" : "bad" });
        }} /></label>
      </div>
    </section>
    <section className="card stack">
      <h2>Start over</h2>
      <AnimatePresence mode="wait" initial={false}>
        {!confirm
          ? <motion.div key="a" exit={{ opacity: 0 }}><Button variant="danger" onClick={() => setConfirm(true)}>Delete all data on this phone</Button></motion.div>
          : <motion.div key="b" className="stack tight" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <p className="small">{session
                ? `This removes ${companion.name}, every log and your settings from this phone only. Your account keeps its copy, so it comes back here while you're signed in. To remove it everywhere, delete your account in Account and backup.`
                : `This removes ${companion.name}, every log and your settings from this phone. It can't be undone.`}</p>
              <div className="actions"><Button variant="danger" onClick={() => { haptic.heavy(); void actions.resetAll(); }}>Yes, delete</Button><Button variant="secondary" onClick={() => setConfirm(false)}>Cancel</Button></div>
            </motion.div>}
      </AnimatePresence>
    </section>
  </>);
}

const THEME_LABEL = { system: "System", light: "Light", dark: "Dark" } as const;
const ACCENT_OPTS: { id: Settings["accent"]; label: string; color: string }[] = [
  { id: "pet", label: "Match my pet", color: "conic-gradient(#c2572a, #2f7a52, #2f6aa3, #b03f6b, #c2572a)" },
  { id: "coral", label: "Coral", color: "#c2572a" }, { id: "ocean", label: "Ocean", color: "#2f6aa3" }, { id: "forest", label: "Forest", color: "#2f7a52" },
  { id: "berry", label: "Berry", color: "#b03f6b" }, { id: "plum", label: "Plum", color: "#6b4fb0" }, { id: "slate", label: "Slate", color: "#4b5a6b" },
];

function AppearancePage() {
  const { settings } = useData();
  return (<>
    <section className="card stack">
      <h2>Theme</h2>
      <div className="theme-grid" role="radiogroup" aria-label="Theme">
        {(["system", "light", "dark"] as const).map((t) => (
          <motion.button key={t} role="radio" aria-checked={settings.theme === t} className="theme-opt" data-on={settings.theme === t} whileTap={{ scale: 0.96 }}
            onClick={() => { haptic.select(); actions.setSettings({ theme: t }); }}>
            <span className={`theme-swatch ts-${t}`} aria-hidden><i /><i /></span>
            <b>{THEME_LABEL[t]}</b>
          </motion.button>
        ))}
      </div>
      <p className="muted small">System follows your phone's light or dark setting.</p>
    </section>
    <section className="card stack">
      <h2>Colour</h2>
      <div className="accent-grid" role="radiogroup" aria-label="Accent colour">
        {ACCENT_OPTS.map((a) => (
          <motion.button key={a.id} role="radio" aria-checked={settings.accent === a.id} aria-label={a.label} className="accent-opt" data-on={settings.accent === a.id} whileTap={{ scale: 0.92 }}
            onClick={() => { haptic.select(); actions.setSettings({ accent: a.id }); }}>
            <span className="accent-dot" style={{ background: a.color }}>{settings.accent === a.id && Icon.check}</span>
            <span className="small">{a.label}</span>
          </motion.button>
        ))}
      </div>
      <p className="muted small">"Match my pet" picks a colour that suits your companion.</p>
    </section>
  </>);
}

function FeelPage() {
  const { settings } = useData();
  return (
    <section className="card stack">
      <Switch checked={settings.haptics} onChange={(v) => actions.setSettings({ haptics: v })} label="Haptics" hint="Small vibrations when you tap" />
      <Switch checked={settings.pet3d} onChange={(v) => actions.setSettings({ pet3d: v })} label="3D pet" hint={`Dogs and foxes in animated 3D. ${({ ok: "Working on this phone.", failed: "Couldn't load on this phone, so the drawing is shown.", unsupported: "This phone can't draw 3D, so the drawing is shown.", unused: "Shows on Home for a dog or fox." } as const)[pet3dStatus()]}`} />
      <Switch checked={settings.deathScene} onChange={(v) => actions.setSettings({ deathScene: v })} label="Show the farewell scene" hint="Turn off to see only the memorial text" />
      <label className="field"><span className="field-label">Currency</span><input className="input" autoComplete="off" value={settings.currency} maxLength={4} onChange={(e) => actions.setSettings({ currency: e.target.value })} /></label>
      <div className="row"><span className="small muted">Clock and region: {placeName()} ({timeZone()}), 12-hour time</span>
        {localCurrency(settings.currency) !== settings.currency && <Button variant="text" onClick={() => actions.setSettings({ currency: localCurrency(settings.currency) })}>Use {localCurrency(settings.currency)}</Button>}</div>
    </section>
  );
}

function AboutPage() {
  const [checking, setChecking] = useState(false);
  async function check() {
    setChecking(true);
    const latest = await checkForUpdate();
    setChecking(false);
    if (latest) toast(`Version ${latest.name} is ready`, { action: { label: "Get it", run: () => openDownload(latest.url) }, ms: 8000 });
    else toast("You have the latest version", { kind: "good" });
  }
  return (<>
    <section className="card stack">
      <div className="row"><h2>Version</h2><span className="muted">{APP_VERSION.name}</span></div>
      <div className="actions">
        <Button variant="secondary" disabled={checking} onClick={check}>{checking ? "Checking…" : "Check for updates"}</Button>
        <Button variant="secondary" onClick={() => openDownload(RELEASES_PAGE)}>All versions</Button>
      </div>
    </section>
    <section className="card stack">
      <h2>Safety</h2>
      <p className="small">{DISCLAIMER}</p>
      <p className="small muted">If you are in crisis: India, Tele-MANAS 14416. US, call or text 988. Elsewhere, contact your local emergency number.</p>
    </section>
  </>);
}
