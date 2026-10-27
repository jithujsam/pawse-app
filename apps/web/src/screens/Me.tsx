import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { STAGE_LABEL } from "@detox/engine";
import { CompanionArt, LiveCompanion, PetPortrait } from "../Companion";
import { ACCESSORIES, COATS, PERSONALITIES, SPECIES } from "../pets";
import { has3D, pet3dStatus, STYLE_3D } from "../pet3d-support";
import { say } from "../voice";
import { DISCLAIMER, PROFESSIONAL_NOTE, TONES, tonePreview } from "../copy";
import { concernIn } from "../guard";
import { money } from "../format";
import { t } from "../text";
import { APP_NAME, CONTACT_EMAIL } from "../brand";
import { Dropdown } from "../ui/Dropdown";
import { fmtDay, fmtTime, today, uses12h } from "../dates";
import { TimePicker } from "../ui/TimePicker";
import { localCurrency, placeName, timeZone } from "../region";
import { haptic } from "../haptics";
import { cancelDaily, remindersSupported, requestReminders, scheduleDaily } from "../notify";
import { rise, spring, stagger } from "../motion";
import { actions, canAllowPassingAway, useActiveView, useData, vault } from "../store";
import { daysTogether, trackSummary } from "../progress";
import { companionsOf, trackState } from "../tracks";
import { PlanPage } from "./Plan";
import { configured, useSession } from "../supabase";
import { useSyncStatus } from "../sync";
import { Button, ConcernNote, GuardedInput, Icon, PawLogo, Select, SelectOther, Switch } from "../ui/Controls";
import { Group, Row, SubPage } from "../ui/Settings";
import { toast } from "../ui/Toast";
import { Account } from "./Account";
import { SecurityCard } from "./Security";
import { Simulator } from "./Simulator";
import { APP_VERSION, checkUpdate, openDownload, RELEASES_PAGE, runUpdate } from "../update";
import type { Field, FieldType, Settings } from "../types";

const TYPES: { value: FieldType; label: string }[] = [
  { value: "choice", label: t("me.questions.t_choice") }, { value: "multi", label: t("me.questions.t_multi") }, { value: "scale", label: t("me.questions.t_scale") }, { value: "text", label: t("me.questions.t_text") },
  { value: "number", label: t("me.questions.t_number") }, { value: "money", label: t("me.questions.t_money") }, { value: "yesno", label: t("me.questions.t_yesno") }, { value: "photo", label: t("me.questions.t_photo") },
];
const SPECIES_LABEL: Record<string, string> = { dog: "Dog", cat: "Cat", rabbit: "Rabbit", fox: "Fox", owl: "Owl", panda: "Panda" };

type Page = "plan" | "appearance" | "pet" | "voice" | "reminders" | "questions" | "security" | "account" | "data" | "feel" | "about" | null;

export function Me() {
  const data = useData();
  const view = useActiveView()!;
  const { companion } = view;
  const habit = view.habit ?? data.habits[0];
  const { settings } = data;
  const track = trackState(data, habit.id);
  const [page, setPage] = useState<Page>(null);
  const [sim, setSim] = useState(false);
  const { session } = useSession();
  const sync = useSyncStatus();
  const together = daysTogether(companion.bornOn, today());
  const close = () => setPage(null);
  const [showProf] = useState(() => {
    try { const show = ["alcohol", "smoking"].includes(habit.cls) && !localStorage.getItem("detox-prof-note"); if (show) localStorage.setItem("detox-prof-note", "1"); return show; } catch { return false; }
  });

  return (
    <motion.main className="screen" variants={stagger} initial="hidden" animate="show">
      <motion.h1 variants={rise}>{t("me.profile.title")}</motion.h1>
      <motion.button className="profile-card" variants={rise} whileTap={{ scale: 0.985 }} onClick={() => { haptic.tap(); setPage("pet"); }}>
        <span className="profile-art"><PetPortrait species={companion.species} coat={companion.coat} accessory={track.wear} stage={view.stage} mood="idle" age={view.age} size={84} /></span>
        <span className="profile-text">
          <b className="profile-name">{companion.name}</b>
          <span className="muted small">{t("me.profile.summary", { species: SPECIES_LABEL[companion.species], personality: PERSONALITIES.find((p) => p.id === (companion.personality ?? "playful"))?.label ?? "", stage: STAGE_LABEL[view.stage], day: together })}</span>
          <span className="small">{t("me.profile.tracking", { track: habit.name })}</span>
        </span>
        <span className="srow-chev" aria-hidden>{Icon.chevR}</span>
      </motion.button>
      {showProf && <motion.div className="banner" role="note" variants={rise}>{PROFESSIONAL_NOTE}</motion.div>}

      <motion.div variants={rise}>
        <Group title={t("me.profile.g_plan")}>
          <Row icon={Icon.flag} label={t("me.profile.row_plan")} value={track.plan?.goal ? { stop: t("me.profile.goal_stop"), reduce: t("me.profile.goal_reduce"), understand: t("me.profile.goal_understand") }[track.plan.goal] : t("me.profile.goal_none")} onClick={() => setPage("plan")} />
          <Row icon={Icon.chat} label={t("me.profile.row_voice")} value={TONES.find((t) => t.id === settings.tone)?.label} onClick={() => setPage("voice")} />
        </Group>
      </motion.div>
      <motion.div variants={rise}>
        <Group title={t("me.profile.g_tracking")}>
          <Row icon={Icon.list} label={t("me.profile.row_questions")} value={`${habit.fields.length}`} onClick={() => setPage("questions")} />
          <Row icon={Icon.bell} label={t("me.profile.row_reminders")} value={settings.remindersOn ? fmtTime(settings.reminder) : t("me.profile.off")} onClick={() => setPage("reminders")} />
        </Group>
      </motion.div>
      <motion.div variants={rise}>
        <Group title={t("me.profile.g_privacy")}>
          {configured && <Row icon={Icon.cloud} label={t("me.profile.row_account")} value={session ? (sync.state === "error" ? t("me.profile.needs_attention") : t("me.profile.on")) : t("me.profile.off")} onClick={() => setPage("account")} />}
          <Row icon={Icon.lock} label={t("me.profile.row_lock")} value={vault.hasPin() ? t("me.profile.on") : t("me.profile.off")} onClick={() => setPage("security")} />
          <Row icon={Icon.data} label={t("me.profile.row_data")} onClick={() => setPage("data")} />
        </Group>
      </motion.div>
      <motion.div variants={rise}>
        <Group title={t("me.profile.g_app")}>
          <Row icon={Icon.palette} label={t("me.profile.row_appearance")} value={`${THEME_LABEL[settings.theme]} · ${ACCENT_OPTS.find((a) => a.id === settings.accent)?.label}`} onClick={() => setPage("appearance")} />
          <Row icon={Icon.phone} label={t("me.profile.row_feel")} value={placeName()} onClick={() => setPage("feel")} />
          <Row icon={Icon.info} label={t("me.profile.row_about")} value={APP_VERSION.name} onClick={() => setPage("about")} />
        </Group>
      </motion.div>
      {import.meta.env.DEV && <motion.div variants={rise}>
        <Group title={t("me.profile.g_dev")}>
          <Row icon={Icon.flask} label={t("me.profile.row_sim")} onClick={() => setSim(true)} />
        </Group>
      </motion.div>}

      <SubPage open={page === "plan"} title={t("me.profile.row_plan")} onClose={close}><PlanPage key={habit.id} habitId={habit.id} /></SubPage>
      <SubPage open={page === "pet"} title={t("me.profile.page_pet")} onClose={close}><PetPage /></SubPage>
      <SubPage open={page === "voice"} title={t("me.profile.row_voice")} onClose={close}><VoicePage /></SubPage>
      <SubPage open={page === "reminders"} title={t("me.profile.row_reminders")} onClose={close}><RemindersPage /></SubPage>
      <SubPage open={page === "questions"} title={t("me.profile.row_questions")} onClose={close}><QuestionsPage /></SubPage>
      <SubPage open={page === "security"} title={t("me.profile.row_lock")} onClose={close}><SecurityCard /></SubPage>
      {configured && <SubPage open={page === "account"} title={t("me.profile.row_account")} onClose={close}><section className="card stack"><Account /></section></SubPage>}
      <SubPage open={page === "data"} title={t("me.profile.row_data")} onClose={close}><DataPage /></SubPage>
      <SubPage open={page === "appearance"} title={t("me.profile.row_appearance")} onClose={close}><AppearancePage /></SubPage>
      <SubPage open={page === "feel"} title={t("me.profile.row_feel")} onClose={close}><FeelPage /></SubPage>
      <SubPage open={page === "about"} title={t("me.profile.row_about")} onClose={close}><AboutPage /></SubPage>
      {import.meta.env.DEV && <Simulator open={sim} onClose={() => setSim(false)} species={companion.species} coat={companion.coat} name={companion.name} habit={habit} />}
    </motion.main>
  );
}

function PetPage() {
  const data = useData();
  const view = useActiveView()!;
  const { companion } = view;
  const habit = view.habit ?? data.habits[0];
  const { settings } = data;
  const track = trackState(data, habit.id);
  const [name, setName] = useState(companion.name);
  const hall = companionsOf(data, habit.id).filter((c) => c.diedOn);
  const { best, care } = trackSummary(data, habit.id, today());
  // Classic rules can only be switched on if the history wouldn't already mean death under them.
  const classicDead = settings.petLife !== "classic" && !canAllowPassingAway(data);
  const save = () => {
    const n = name.trim();
    if (!n || n === companion.name || concernIn(n)) { if (concernIn(n) === null) setName(companion.name); return; }
    if (!actions.renameCompanion(companion.id, n)) return;
    haptic.success();
    toast(t("me.pet.hi", { name: n }), { kind: "good" });
  };
  return (<>
    <section className="card stack">
      <div className="pet-stage"><LiveCompanion species={companion.species} coat={companion.coat} personality={companion.personality} accessory={track.wear} stage={view.stage} mood="happy" age={view.age} size={170} /></div>
      <div className="stats">
        <div className="stat item"><span className="muted small">{t("me.pet.days")}</span><b className="v">{daysTogether(companion.bornOn, today())}</b></div>
        <div className="stat item"><span className="muted small">{t("me.pet.born")}</span><b>{fmtDay(companion.bornOn)}</b></div>
      </div>
    </section>
    <section className="card stack">
      <label className="field"><span className="field-label">{t("me.pet.name")}</span>
        <GuardedInput className="input" autoComplete="off" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} onBlur={save} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
      </label>
      <div className="field"><span className="field-label">{t("me.pet.species")}</span>
        <Select label={t("me.pet.species")} value={companion.species} options={SPECIES.filter((sp) => !sp.off || sp.id === companion.species).map((sp) => ({ value: sp.id, label: has3D(sp.id) ? STYLE_3D[sp.id].label : sp.label }))}
          onChange={(id) => { if (id !== companion.species) { actions.setSpecies(companion.id, id); haptic.success(); toast(t("me.pet.species_changed", { name: companion.name, species: SPECIES.find((x) => x.id === id)!.label.toLowerCase() }), { kind: "good" }); } }} />
      </div>
      {has3D(companion.species) && <span className="muted small">{pet3dStatus() === "failed" ? t("me.pet.style_failed") : pet3dStatus() === "unsupported" ? t("me.pet.style_unsupported") : STYLE_3D[companion.species].note}</span>}
      <div className="field"><span className="field-label">{t("me.pet.coat")}</span>
        <Select label={t("me.pet.coat")} value={companion.coat ?? COATS[companion.species][0].id} options={COATS[companion.species].map((c) => ({ value: c.id, label: c.label }))}
          onChange={(id) => actions.setCompanionLook(companion.id, { coat: id, personality: companion.personality })} />
      </div>
      <div className="field"><span className="field-label">{t("me.pet.personality")}</span>
        <Select label={t("me.pet.personality")} value={companion.personality ?? "playful"} options={PERSONALITIES.map((p) => ({ value: p.id, label: `${p.label}: ${p.blurb}` }))}
          onChange={(id) => { actions.setCompanionLook(companion.id, { coat: companion.coat, personality: id }); toast(say("petted", id, settings.tone), { ms: 2500 }); }} />
      </div>
    </section>
    <section className="card stack">
      <div className="row"><h2>{t("me.pet.wardrobe")}</h2><span className="muted small">{care === 1 ? t("me.pet.day_of_care", { n: care }) : t("me.pet.days_of_care", { n: care })}</span></div>
      <Select label={t("me.pet.accessory")} value={track.wear ?? "none"} onChange={(id) => actions.setTrackSettings(habit.id, { wear: id === "none" ? null : id })}
        options={[{ value: "none", label: t("me.pet.none") }, ...ACCESSORIES.map((a) => ({ value: a.id as string, label: Math.max(best, care) >= a.days ? a.label : t("me.pet.unlocks", { label: a.label, n: a.days }), disabled: Math.max(best, care) < a.days }))] as { value: NonNullable<typeof track.wear> | "none"; label: string; disabled?: boolean }[]} />
      <p className="muted small">{t("me.pet.care_note")}</p>
    </section>
    <section className="card stack">
      <h2>{t("me.pet.health_title", { name: companion.name })}</h2>
      <p className="small">{t("me.pet.health_body", { name: companion.name })} {settings.petLife === "classic"
        ? t("me.pet.classic_on")
        : t("me.pet.continuity", { name: companion.name })}</p>
      <Switch checked={settings.petLife === "classic"} onChange={(v) => { if (v && classicDead) return; actions.setSettings({ petLife: v ? "classic" : "continuity" }); }}
        label={t("me.pet.classic_label")} hint={classicDead ? t("me.pet.classic_blocked", { name: companion.name }) : t("me.pet.classic_hint")} />
      {settings.petLife === "classic" && <Switch checked={settings.deathScene} onChange={(v) => actions.setSettings({ deathScene: v })} label={t("me.pet.farewell")} hint={t("me.pet.farewell_hint")} />}
    </section>
    <section className="card stack">
      <h2>{t("me.pet.hall")}</h2>
      {hall.length === 0 ? <p className="muted">{t("me.pet.hall_empty", { name: companion.name })}</p> : (
        <div className="hall">
          {hall.map((c) => (
            <div className="item hall-item" key={c.id}>
              <CompanionArt species={c.species} coat={c.coat} stage="frail" mood="dying" age={100} size={96} />
              <b>{c.name}</b><span className="muted small">{data.entries.filter((e) => e.companionId === c.id).length === 1 ? t("me.pet.hall_slips_one", { n: 1 }) : t("me.pet.hall_slips_other", { n: data.entries.filter((e) => e.companionId === c.id).length })}</span>
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
  const [name, setName] = useState(settings.userName ?? "");
  const saveName = () => { const n = name.trim().slice(0, 30); if (concernIn(n)) return; setName(n); if (n !== (settings.userName ?? "")) actions.setSettings({ userName: n }); };
  return (
    <section className="card stack">
      <p className="muted">{t("me.voice.intro", { name: companion.name })}</p>
      <label className="field"><span className="field-label">{t("me.voice.call_you", { name: companion.name })}</span>
        <GuardedInput className="input" autoComplete="given-name" value={name} placeholder={t("me.voice.call_you_placeholder")} maxLength={30} onChange={(e) => setName(e.target.value)} onBlur={saveName} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
      </label>
      <Select label={t("me.voice.field")} value={settings.tone} onChange={(tn) => { actions.setTone(tn); if (settings.remindersOn) void scheduleDaily(settings.reminder, tn, companion.name); }} options={TONES.map((tn) => ({ value: tn.id, label: tn.label }))} />
      <AnimatePresence mode="wait"><motion.p key={settings.tone} className="bubble" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>"{tonePreview(settings.tone, companion.name)}"</motion.p></AnimatePresence>
      <p className="muted small">{t("me.voice.note")}</p>
    </section>
  );
}

function RemindersPage() {
  const { settings } = useData();
  const { companion } = useActiveView()!;
  async function toggle(on: boolean) {
    if (!on) { await cancelDaily(); actions.setSettings({ remindersOn: false }); return; }
    const ok = await requestReminders(settings.reminder, settings.tone, companion.name);
    if (!ok) toast(remindersSupported ? t("notifications.permission.blocked") : t("notifications.permission.web"), { kind: "bad" });
  }
  async function setTime(time: string) {
    actions.setSettings({ reminder: time });
    if (settings.remindersOn) await scheduleDaily(time, settings.tone, companion.name);
  }
  return (
    <section className="card stack">
      <Switch checked={settings.remindersOn} onChange={toggle} label={t("me.reminders.daily")} hint={settings.remindersOn ? t("me.reminders.daily_on", { time: fmtTime(settings.reminder) }) : t("me.reminders.daily_off")} />
      <AnimatePresence>{settings.remindersOn && (
        <motion.div className="field" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
          <span className="field-label">{t("me.reminders.time")}</span>
          <TimePicker label={t("me.reminders.time_aria")} value={settings.reminder} onChange={(v) => void setTime(v)} />
        </motion.div>
      )}</AnimatePresence>
      <p className="muted small">{t("me.reminders.note", { name: companion.name })}</p>
      <Switch checked={settings.riskNudge} onChange={(v) => actions.setSettings({ riskNudge: v })} label={t("me.reminders.risk")} hint={t("me.reminders.risk_hint")} />
      <Switch checked={settings.careNotes} onChange={(v) => actions.setSettings({ careNotes: v })} label={t("me.reminders.care", { name: companion.name })} hint={t("me.reminders.care_hint")} />
    </section>
  );
}

/** A question's wording: checked as it is typed, and only a wording that passes is saved. */
function LabelInput({ value, onCommit }: { value: string; onCommit: (label: string) => void }) {
  const [draft, setDraft] = useState(value);
  const concern = concernIn(draft);
  return (<>
    <input className="input" autoComplete="off" value={draft} aria-label={t("me.questions.question_aria")} maxLength={80} aria-invalid={concern ? true : undefined}
      onChange={(e) => { setDraft(e.target.value); if (!concernIn(e.target.value)) onCommit(e.target.value); }} />
    <ConcernNote concern={concern} />
  </>);
}

/** The answers to a choice question, comma separated. Saved when the box is left, and only if every answer passes. */
function AnswersInput({ value, onCommit }: { value: string; onCommit: (text: string) => void }) {
  const [draft, setDraft] = useState(value);
  const concern = concernIn(draft);
  return (<>
    <input className="input" autoComplete="off" aria-label={t("me.questions.answers")} placeholder={t("me.questions.answers")} maxLength={300} value={draft} aria-invalid={concern ? true : undefined}
      onChange={(e) => setDraft(e.target.value)} onBlur={() => { if (!concern) onCommit(draft); }} />
    <ConcernNote concern={concern} />
  </>);
}

function QuestionsPage() {
  const data = useData();
  const habit = useActiveView()!.habit ?? data.habits[0];
  const [editing, setEditing] = useState(false);
  const setField = (id: string, patch: Partial<Field>) => actions.updateHabitFields(habit.id, habit.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const addField = () => { haptic.tap(); actions.updateHabitFields(habit.id, [...habit.fields, { id: Math.random().toString(36).slice(2, 8), label: t("me.questions.new_question"), type: "choice", required: false, options: [{ id: "yes", label: "Yes" }, { id: "no", label: "No" }] }]); };
  const rmField = (id: string) => {
    const before = habit.fields;
    actions.updateHabitFields(habit.id, habit.fields.filter((f) => f.id !== id));
    toast(t("me.questions.removed"), { action: { label: t("ui.common.undo"), run: () => actions.updateHabitFields(habit.id, before) } });
  };
  return (
    <section className="card stack">
      <div className="row"><p className="muted small">{t("me.questions.intro")}</p><Button variant="text" onClick={() => setEditing(!editing)}>{editing ? t("ui.common.done") : t("ui.common.edit")}</Button></div>
      <motion.div className="list" layout>
        <AnimatePresence initial={false}>
          {habit.fields.map((f) => (
            <motion.div layout className="item" key={f.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={spring.soft}>
              {editing ? (<>
                <LabelInput value={f.label} onCommit={(label) => setField(f.id, { label })} />
                <div className="row">
                  <Dropdown className="select" label={t("me.questions.type_aria")} selected={f.type} items={TYPES.map((ty) => ({ key: ty.value, label: ty.label }))}
                    onPick={(k) => setField(f.id, { type: k as FieldType })} />
                  <button className="icon-btn danger" aria-label={t("me.questions.remove_aria")} onClick={() => rmField(f.id)}>{Icon.trash}</button>
                </div>
                {(f.type === "choice" || f.type === "multi") && (
                  <AnswersInput value={(f.options ?? []).map((o) => o.label).join(", ")}
                    onCommit={(text) => setField(f.id, { options: text.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 12).map((label) => ({ id: f.options?.find((o) => o.label === label)?.id ?? label.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40), label: label.slice(0, 40), trigger: f.options?.find((o) => o.label === label)?.trigger })) })} />
                )}
              </>) : (
                <div className="row"><span>{f.label}</span><span className="muted small">{TYPES.find((ty) => ty.value === f.type)?.label}</span></div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
      {editing && <div className="actions">
        <Button variant="secondary" onClick={addField}>{t("me.questions.add")}</Button>
        <Button variant="secondary" onClick={() => { const before = habit.fields; actions.refreshQuestions(habit.id); toast(t("me.questions.switched"), { action: { label: t("ui.common.undo"), run: () => actions.updateHabitFields(habit.id, before) } }); }}>{t("me.questions.recommended")}</Button>
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
    toast(t("me.data.exported"), { kind: "good" });
  }
  return (<>
    <section className="card stack" aria-label={t("privacy.flows.title")}>
      <h2>{t("privacy.flows.title")}</h2>
      <p className="small">{t("privacy.flows.phone")}</p>
      <p className="small">{t("privacy.flows.account")}</p>
      <p className="small">{t("privacy.flows.ai")}</p>
      <p className="small muted">{t("privacy.flows.ai_how")}</p>
      <p className="small muted">{t("privacy.flows.updates")} {t("privacy.flows.control")}</p>
    </section>
    <section className="card stack">
      <h2>{t("me.data.backup")}</h2>
      <p className="muted small">{t("me.data.backup_hint")}</p>
      <div className="actions">
        <Button variant="secondary" onClick={exportData}>{t("me.data.export")}</Button>
        <label className="btn secondary file-btn">{t("me.data.restore")}<input type="file" accept="application/json,.json" className="sr-only" onChange={async (e) => {
          const f = e.target.files?.[0]; e.target.value = "";
          if (!f) return;
          if (f.size > 50_000_000) { toast(t("me.data.too_big"), { kind: "bad" }); return; }
          const ok = actions.importJson(await f.text());
          toast(ok ? t("me.data.restored") : t("me.data.not_backup"), { kind: ok ? "good" : "bad" });
        }} /></label>
      </div>
    </section>
    <section className="card stack">
      <h2>{t("me.data.start_over")}</h2>
      <AnimatePresence mode="wait" initial={false}>
        {!confirm
          ? <motion.div key="a" exit={{ opacity: 0 }}><Button variant="danger" onClick={() => setConfirm(true)}>{t("me.data.delete_all")}</Button></motion.div>
          : <motion.div key="b" className="stack tight" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <p className="small">{session ? t("me.data.delete_body_signed_in") : t("me.data.delete_body")}</p>
              <div className="actions"><Button variant="danger" onClick={() => { haptic.heavy(); void actions.resetAll(); }}>{t("me.data.yes_delete")}</Button><Button variant="secondary" onClick={() => setConfirm(false)}>{t("ui.common.cancel")}</Button></div>
            </motion.div>}
      </AnimatePresence>
    </section>
  </>);
}

/** Common currency symbols. Anything else, up to four characters, can be typed. */
export const CURRENCIES = [{ sym: "₹", name: "Indian rupee" }, { sym: "$", name: "Dollar" }, { sym: "€", name: "Euro" }, { sym: "£", name: "Pound" }, { sym: "¥", name: "Yen or yuan" }, { sym: "₩", name: "Won" }, { sym: "R$", name: "Brazilian real" }, { sym: "₦", name: "Naira" }];
const THEME_LABEL = { system: t("me.appearance.theme_system"), light: t("me.appearance.theme_light"), dark: t("me.appearance.theme_dark") } as const;
const ACCENT_OPTS: { id: Settings["accent"]; label: string; color: string }[] = [
  { id: "pet", label: t("me.appearance.accent_pet"), color: "conic-gradient(#c2572a, #2f7a52, #2f6aa3, #b03f6b, #c2572a)" },
  { id: "coral", label: t("me.appearance.accent_coral"), color: "#c2572a" }, { id: "ocean", label: t("me.appearance.accent_ocean"), color: "#2f6aa3" }, { id: "forest", label: t("me.appearance.accent_forest"), color: "#2f7a52" },
  { id: "berry", label: t("me.appearance.accent_berry"), color: "#b03f6b" }, { id: "plum", label: t("me.appearance.accent_plum"), color: "#6b4fb0" }, { id: "slate", label: t("me.appearance.accent_slate"), color: "#4b5a6b" },
];

function AppearancePage() {
  const { settings } = useData();
  return (<>
    <section className="card stack">
      <h2>{t("me.appearance.theme")}</h2>
      <Select label={t("me.appearance.theme")} value={settings.theme} onChange={(th) => actions.setSettings({ theme: th })} options={(["system", "light", "dark"] as const).map((th) => ({ value: th, label: THEME_LABEL[th] }))} />
      <p className="muted small">{t("me.appearance.theme_hint")}</p>
    </section>
    <section className="card stack">
      <h2>{t("me.appearance.colour")}</h2>
      <Select label={t("me.appearance.accent")} value={settings.accent} onChange={(a) => actions.setSettings({ accent: a })} options={ACCENT_OPTS.map((a) => ({ value: a.id, label: a.label }))} />
      <p className="muted small">{t("me.appearance.accent_hint")}</p>
    </section>
  </>);
}

function FeelPage() {
  const data = useData();
  const { settings } = data;
  return (
    <section className="card stack">
      <Switch checked={settings.haptics} onChange={(v) => actions.setSettings({ haptics: v })} label={t("me.feel.haptics")} hint={t("me.feel.haptics_hint")} />
      <div className="field"><span className="field-label">{t("me.feel.currency")}</span>
        <SelectOther label={t("me.feel.currency_aria")} value={settings.currency} onChange={(c) => actions.setSettings({ currency: c })} maxLength={4}
          options={CURRENCIES.map((c) => ({ value: c.sym, label: `${c.sym}  ${c.name}` }))} otherLabel={t("me.feel.currency_other")} otherPlaceholder={t("me.feel.currency_own")} /></div>
      <div className="row"><span className="small muted">{t("me.feel.region", { place: placeName(), zone: timeZone(), clock: uses12h() ? t("me.feel.clock_12") : t("me.feel.clock_24") })}</span>
        {localCurrency(settings.currency) !== settings.currency && <Button variant="text" onClick={() => actions.setSettings({ currency: localCurrency(settings.currency) })}>{t("me.feel.use_currency", { currency: localCurrency(settings.currency) })}</Button>}</div>
    </section>
  );
}

function AboutPage() {
  const [checking, setChecking] = useState(false);
  async function check() {
    setChecking(true);
    const r = await checkUpdate();
    setChecking(false);
    if (r.status === "available") toast(t("me.about.ready", { version: r.latest.name }), { action: { label: t("home.header.update_cta"), run: () => void runUpdate(r.latest) }, ms: 8000 });
    else if (r.status === "error") toast(t("me.about.error"), { kind: "bad" });
    else toast(t("me.about.latest"), { kind: "good" });
  }
  return (<>
    <section className="card stack about-hero">
      <PawLogo size={72} />
      <h2 className="brand">{APP_NAME}</h2>
      <p className="muted">{t("me.about.tagline")}</p>
    </section>
    <section className="card stack">
      <h2>{t("me.about.what_title")}</h2>
      <p>{t("me.about.what_body")}</p>
      <div className="about-pets" aria-hidden>
        {(["dog", "cat", "fox"] as const).map((sp) => <PetPortrait key={sp} species={sp} stage="adult" mood="happy" age={4} size={96} />)}
      </div>
      <p className="muted small">{t("me.about.pets_caption")}</p>
    </section>
    <section className="card stack">
      <h2>{t("me.about.contact_title")}</h2>
      <p>{t("me.about.contact_body")}</p>
      <Button variant="secondary" onClick={() => { window.location.href = `mailto:${CONTACT_EMAIL}`; }}>{t("me.about.contact_cta", { email: CONTACT_EMAIL })}</Button>
    </section>
    <section className="card stack">
      <div className="row"><h2>{t("me.about.version")}</h2><span className="muted">{APP_VERSION.name}</span></div>
      <div className="actions">
        <Button variant="secondary" disabled={checking} onClick={check}>{checking ? t("me.about.checking") : t("me.about.check")}</Button>
        <Button variant="secondary" onClick={() => openDownload(RELEASES_PAGE)}>{t("me.about.all")}</Button>
      </div>
    </section>
    <section className="card stack">
      <h2>{t("me.about.safety")}</h2>
      <p className="small">{DISCLAIMER}</p>
      <p className="small muted">{t("safety.helplines.in_crisis", { helplines: t("safety.helplines.short") })}</p>
    </section>
  </>);
}
