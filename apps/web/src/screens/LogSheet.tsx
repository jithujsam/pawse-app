import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { aiForSlip } from "../ai";
import { absorbedLine, bingeLine, EFFECT_LABEL } from "../copy";
import { t } from "../text";
import { money } from "../format";
import { frictionIdeas, lapseHeadline, progressKept } from "../recovery";
import { EDIT_DAYS, trackSummary } from "../progress";
import { concernIn, type Concern } from "../guard";
import { OTHER_PREFIX, otherAnswer } from "../questions";
import { addDays, fmtDay, fmtTime, today } from "../dates";
import { TimePicker } from "../ui/TimePicker";
import { haptic } from "../haptics";
import { rise, spring, stagger } from "../motion";
import { actions, slipRequest, useData, type Deduction } from "../store";
import { trackState } from "../tracks";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import { Button, ConcernNote, GuardedInput, Icon, MultiSelect, plainOpts, Select, SelectOther, Switch } from "../ui/Controls";
import { Sheet } from "../ui/Sheet";
import type { Entry, Habit } from "../types";

async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, 640 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.7);
  } finally { URL.revokeObjectURL(url); }
}

/** 1 to 5, with the ends named by the question ("Barely" to "Overwhelming"). */
const scaleOptions = (labels: [string, string]): { value: string; label: string }[] =>
  [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: n === 1 ? t("sheets.log.scale_first", { label: labels[0] }) : n === 5 ? t("sheets.log.scale_last", { label: labels[1] }) : String(n) }));

/**
 * What the typed parts of a slip need. A note is checked for crisis language; an answer someone typed to a question
 * ("Type your own") is checked for food and weight talk as well. Picked answers are the app's own and need no check.
 */
function answersConcern(habit: Habit, values: Entry["values"]): Concern | null {
  const found: (Concern | null)[] = [];
  for (const f of habit.fields) {
    const v = values[f.id];
    if (typeof v !== "string" || !v) continue;
    if (f.type === "text") found.push(concernIn(v, "crisis"));
    else if (f.type === "choice" || f.type === "multi") for (const part of f.type === "multi" ? v.split(",") : [v]) if (part.startsWith(OTHER_PREFIX)) found.push(concernIn(part.slice(OTHER_PREFIX.length)));
  }
  return found.includes("crisis") ? "crisis" : found.includes("restriction") ? "restriction" : null;
}

/** `day` presets the slip's date, e.g. from the calendar: today or one of the two days before it. */
interface Props { open: boolean; habit: Habit; name: string; age: number; onClose: () => void; onSaved: (d: Deduction) => void; day?: string }

export function LogSheet(props: Props) {
  return (
    <Sheet open={props.open} onClose={props.onClose} label={t("sheets.log.label")}>
      {props.open && <LogBody {...props} />}
    </Sheet>
  );
}

function LogBody({ habit, name, age, onClose, onSaved, day: presetDay }: Props) {
  const data = useData();
  const [values, setValues] = useState<Entry["values"]>({});
  const [day, setDay] = useState(presetDay ?? today());
  const [time, setTime] = useState("");
  const born = data.companions.find((c) => c.id === habit.companionId)?.bornOn;
  // A slip can be logged for today or one of the EDIT_DAYS before it, as on the calendar, and not before the pet was born.
  const days = Array.from({ length: EDIT_DAYS + 1 }, (_, i) => addDays(today(), -i)).filter((x) => !born || x >= born);
  const [crisis, setCrisis] = useState(false);
  const [result, setResult] = useState<Deduction | null>(null);
  const [ageBefore] = useState(age);
  // What the person had built before this slip, so the result can say plainly that it still stands.
  const [kept] = useState(() => trackSummary(data, habit.id, today()));
  const keptMet = kept.metDays, keptUrges = kept.managedUrges;
  const alive = useRef(true);
  const [polishing, setPolishing] = useState(false);
  const [shake, setShake] = useState(0);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const set = (id: string, v: string | boolean) => setValues((s) => ({ ...s, [id]: v }));

  const missing = habit.fields.filter((f) => f.required && (values[f.id] === undefined || values[f.id] === ""));
  const amountField = habit.fields.find((f) => f.amount);
  const recent = amountField
    ? [...new Set(data.entries.filter((e) => e.habitId === habit.id && e.amount !== null).slice(-12).reverse().map((e) => e.amount as number))].slice(0, 4)
    : [];
  const unitLabel = habit.unit === "minutes" ? t("sheets.log.minutes_unit") : "";
  const liveConcern = answersConcern(habit, values);

  function save() {
    if (missing.length) { haptic.warn(); setShake((s) => s + 1); return; }
    if (liveConcern === "crisis") { setCrisis(true); return; }
    if (liveConcern) { haptic.warn(); return; } // the note under the form says why
    const d = actions.logSlip(habit.id, values, day, time || null);
    if (!d) { haptic.warn(); onClose(); return; } // the track is paused or archived for that day
    setResult(d);
    onSaved(d);
    const req = slipRequest(d.entry.id);
    if (req) {
      setPolishing(true);
      void aiForSlip(req).then((r) => {
        if (!r) return;
        const months = actions.applyAi(d.entry.id, r);
        if (months === null) return;
        if (alive.current) setResult((cur) => cur && ({
          ...cur, line: r.explanation, entry: { ...cur.entry, months, source: "ai" },
          effectLine: r.effects.map((e) => EFFECT_LABEL[e]).filter(Boolean).slice(0, 2).join(" ") || cur.effectLine,
        }));
      }).finally(() => { if (alive.current) setPolishing(false); });
    }
  }

  if (crisis) return (
    <motion.div className="stack" variants={stagger} initial="hidden" animate="show">
      <motion.h2 variants={rise}>{t("safety.crisis.title")}</motion.h2>
      <motion.div variants={rise}><ConcernNote concern="crisis" /></motion.div>
      <motion.div variants={rise}><Button variant="secondary" onClick={onClose}>{t("safety.crisis.close")}</Button></motion.div>
    </motion.div>
  );

  if (result) {
    const felt = Math.max(0, result.entry.months - result.absorbed);
    const ageAfter = Math.min(100, ageBefore + (felt / 1200) * 100);
    const shrugged = result.absorbed > 0 && felt < 0.05;
    return (
      <motion.div className="stack" variants={stagger} initial="hidden" animate="show">
        <motion.h2 variants={rise}>{lapseHeadline(data.settings.tone, name)}</motion.h2>
        <motion.p className="muted small" variants={rise}>{t("sheets.log.logged", { when: day === today() ? t("sheets.log.when_today") : day === addDays(today(), -1) ? t("sheets.log.when_yesterday") : fmtDay(day) })}{time ? t("sheets.log.logged_at", { time: fmtTime(time) }) : ""}</motion.p>
        <motion.div className="deduction" variants={rise}>
          <span>{shrugged ? t("sheets.log.shrugged", { name }) : t("sheets.log.cost", { name })}</span>
          <b className={shrugged ? "" : "neg"}>−<AnimatedNumber value={felt} from={0} decimals={1} /> {Math.round(felt * 10) / 10 === 1 ? t("sheets.log.month") : t("sheets.log.months")}</b>
          <div className="delta-bar" aria-hidden>
            <i className="before" style={{ width: `${ageBefore}%` }} />
            <motion.i className="added" initial={{ width: 0 }} animate={{ width: `${Math.max(0.6, ageAfter - ageBefore)}%` }} transition={{ ...spring.calm, delay: 0.35 }} style={{ left: `${ageBefore}%` }} />
          </div>
          {result.absorbed > 0 && <span className="small">{absorbedLine(data.settings.tone, name, result.streakBefore, result.absorbed, shrugged)}</span>}
          {result.binge && data.settings.petLife === "classic" && <span className="small">{bingeLine(data.settings.tone, name)}</span>}
          {!shrugged && result.effectLine && <span>{result.effectLine}</span>}
          <span className="muted small">{result.nthToday > 1 ? t("sheets.log.slip_n", { n: result.nthToday }) : ""}{result.weekSlips === 1 ? t("sheets.log.this_week_one") : t("sheets.log.this_week_other", { n: result.weekSlips })}</span>
        </motion.div>
        <AnimatePresence mode="wait">
          <motion.p key={result.line} className="bubble" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring.soft}>
            {result.line}{result.entry.source === "ai" && <span className="ai-tag" title={t("sheets.log.ai_tag")}>{Icon.spark}</span>}
          </motion.p>
        </AnimatePresence>
        {polishing && <div className="shimmer-line" aria-live="polite"><span className="sr-only">{t("sheets.log.polishing")}</span></div>}
        <motion.p className="muted small" variants={rise}>{progressKept(data.settings.tone, keptMet, keptUrges)}</motion.p>
        <motion.div variants={rise}><LapseReflection entryId={result.entry.id} habit={habit} onDone={onClose} /></motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div className="stack" variants={stagger} initial="hidden" animate="show">
      <motion.div className="row" variants={rise}><h2>{t("sheets.log.title")}</h2><Button variant="text" onClick={onClose}>{t("ui.common.cancel")}</Button></motion.div>
      <motion.div className="field" variants={rise}>
        <span className="field-label">{t("sheets.log.when")}</span>
        <Select label={t("sheets.log.day_aria")} value={day} onChange={setDay}
          options={days.map((x, i) => ({ value: x, label: i === 0 ? t("sheets.log.today") : i === 1 ? t("sheets.log.yesterday") : fmtDay(x) }))} />
      </motion.div>
      <motion.div className="field" variants={rise}>
        <span className="field-label">{t("sheets.log.time")}</span>
        <Select label={t("sheets.log.time_aria")} value={time ? "set" : "none"} options={[{ value: "none", label: t("sheets.log.time_none") }, { value: "set", label: t("sheets.log.time_set") }]}
          onChange={(v) => {
            if (v === "none") { setTime(""); return; }
            const n = new Date();
            setTime(`${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes() - (n.getMinutes() % 5)).padStart(2, "0")}`);
          }} />
        {time && <TimePicker label={t("sheets.log.time_picker")} value={time} onChange={setTime} />}
      </motion.div>
      {habit.fields.map((f) => (
        <motion.div className="field" key={f.id} variants={rise}
          animate={missing.some((m) => m.id === f.id) && shake ? { x: [0, -8, 8, -5, 5, 0] } : undefined} transition={{ duration: 0.4 }}>
          <span className="field-label">{f.label}{f.required && <span className="req" aria-label={t("sheets.log.required")}> ·</span>}</span>
          {f.type === "text" && <GuardedInput strict="crisis" className="input" autoComplete="off" maxLength={120} value={String(values[f.id] ?? "")} onChange={(e) => set(f.id, e.target.value)} aria-label={f.label} />}
          {(f.type === "number" || f.type === "money") && (<>
            <div className="amount-wrap">
              {f.type === "money" && <span className="prefix">{data.settings.currency}</span>}
              <input className="input amount" inputMode="decimal" type="number" min="0" placeholder="0" aria-label={f.label}
                value={String(values[f.id] ?? "")} onChange={(e) => set(f.id, e.target.value)} />
              {f.type === "number" && habit.unit === "minutes" && <span className="suffix">{t("sheets.log.minutes_unit")}</span>}
            </div>
            {f.amount && recent.length > 0 && (
              <Select label={t("sheets.log.recent_aria")} placeholder={t("sheets.log.recent_placeholder")} value={String(values[f.id] ?? "")}
                options={recent.map((a) => ({ value: String(a), label: habit.unit === "money" ? money(data.settings.currency, a) : `${a}${unitLabel ? ` ${unitLabel}` : ""}` }))}
                onChange={(v) => set(f.id, v)} />
            )}
          </>)}
          {f.type === "choice" && (
            <SelectOther label={f.label} placeholder={t("sheets.log.choose_one")} clearLabel={t("sheets.log.skip_this")} otherPlaceholder={t("sheets.log.type_own")} maxLength={40}
              options={(f.options ?? []).map((o) => ({ value: o.id, label: o.label }))}
              value={String(values[f.id] ?? "").startsWith(OTHER_PREFIX) ? String(values[f.id]).slice(OTHER_PREFIX.length) : String(values[f.id] ?? "")}
              onChange={(v) => set(f.id, !v || (f.options ?? []).some((o) => o.id === v) ? v : otherAnswer(v))} />
          )}
          {f.type === "multi" && (
            <MultiSelect label={f.label} placeholder={t("sheets.log.pick_any")} ownPrefix={OTHER_PREFIX} maxLength={40} max={8}
              options={(f.options ?? []).map((o) => ({ value: o.id, label: o.label }))}
              value={String(values[f.id] ?? "").split(",").filter(Boolean)}
              onChange={(v) => set(f.id, v.join(","))} />
          )}
          {f.type === "scale" && (
            <Select label={f.label} placeholder={t("sheets.log.choose_scale")} clearLabel={t("sheets.log.skip_this")} value={String(values[f.id] ?? "")}
              options={scaleOptions(f.scaleLabels ?? [t("sheets.log.scale_low"), t("sheets.log.scale_high")])} onChange={(v) => set(f.id, v)} onClear={() => set(f.id, "")} />
          )}
          {f.type === "yesno" && (
            <Select label={f.label} placeholder={t("sheets.log.choose_one")} clearLabel={t("sheets.log.skip_this")} value={typeof values[f.id] === "boolean" ? (values[f.id] as boolean) : undefined}
              options={[{ value: true, label: t("sheets.log.yes") }, { value: false, label: t("sheets.log.no") }]} onChange={(v) => set(f.id, v)} onClear={() => set(f.id, "")} />
          )}
          {f.type === "photo" && (
            <label className="photo-tile">
              {typeof values[f.id] === "string" && values[f.id]
                ? <motion.img src={String(values[f.id])} alt={t("sheets.log.photo_alt")} width={640} height={480} initial={{ opacity: 0, scale: 1.05 }} animate={{ opacity: 1, scale: 1 }} />
                : <span className="muted">{Icon.camera} {t("sheets.log.photo")}</span>}
              <input type="file" accept="image/*" className="sr-only" onChange={async (e) => { const file = e.target.files?.[0]; if (file) set(f.id, await shrink(file)); }} />
            </label>
          )}
        </motion.div>
      ))}
      <motion.div variants={rise}><ConcernNote concern={liveConcern} /></motion.div>
      <motion.div variants={rise}><Button onClick={save} className={missing.length || liveConcern === "restriction" ? "soft-disabled" : ""}>{t("sheets.log.save")}</Button></motion.div>
    </motion.div>
  );
}

/**
 * Optional, after a slip: what came before it and one small adjustment. Skipping is always fine, and nothing
 * here changes the companion. The adjustment can go into the plan as an if-then.
 */
function LapseReflection({ entryId, habit, onDone }: { entryId: string; habit: Habit; onDone: () => void }) {
  const data = useData();
  const plan = trackState(data, habit.id).plan;
  const [open, setOpen] = useState(false);
  const [before, setBefore] = useState("");
  const [adjust, setAdjust] = useState("");
  const [keep, setKeep] = useState(true);
  const concern = concernIn(before, "crisis") ?? concernIn(adjust);
  const ideas = [...(plan?.ifThen ?? []).slice(0, 1), ...frictionIdeas(habit.cls, habit.name).slice(0, 2), t("sheets.reflection.idea_checkin")];
  function save() {
    if (concern) return;
    if (before.trim() || adjust.trim()) actions.reflectOnLapse(entryId, { before, adjust });
    if (keep && adjust.trim()) actions.addIfThen(adjust, habit.id);
    haptic.success();
    onDone();
  }
  if (!open) return (
    <div className="stack tight">
      {plan?.firstStep && <p className="small">{t("sheets.reflection.back_to_plan")} <b>{plan.firstStep}</b></p>}
      <Button onClick={onDone}>{t("sheets.reflection.back")}</Button>
      <Button variant="secondary" onClick={() => setOpen(true)}>{t("sheets.reflection.reflect")}</Button>
    </div>
  );
  return (
    <div className="card stack">
      <label className="field"><span className="field-label">{t("sheets.reflection.before")}</span>
        <GuardedInput strict="crisis" className="input" autoComplete="off" maxLength={160} value={before} placeholder={t("sheets.reflection.before_placeholder")} onChange={(e) => setBefore(e.target.value)} />
      </label>
      <div className="field"><span className="field-label">{t("sheets.reflection.adjust")}</span>
        <SelectOther label={t("sheets.reflection.adjust")} options={plainOpts(ideas)} value={adjust} onChange={setAdjust} maxLength={160} placeholder={t("sheets.reflection.adjust_placeholder")} clearLabel={t("sheets.reflection.adjust_none")}
          otherPlaceholder={t("sheets.reflection.adjust_own")} />
      </div>
      {adjust.trim() && <Switch checked={keep} onChange={setKeep} label={t("sheets.reflection.keep")} hint={t("sheets.reflection.keep_hint")} />}
      <Button onClick={save} disabled={concern !== null}>{t("sheets.reflection.save")}</Button>
      <Button variant="text" onClick={onDone}>{t("ui.common.skip")}</Button>
    </div>
  );
}
