import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { aiForSlip } from "../ai";
import { CRISIS_MESSAGE, EFFECT_LABEL } from "../copy";
import { frictionIdeas, lapseHeadline, progressKept } from "../recovery";
import { hasCrisisLanguage } from "../crisis";
import { addDays, fmtDay, fmtTime, today } from "../dates";
import { TimePicker } from "../ui/TimePicker";
import { haptic } from "../haptics";
import { rise, spring, stagger } from "../motion";
import { actions, slipRequest, useData, type Deduction } from "../store";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import { Button, Chip, Icon, Segmented, Switch } from "../ui/Controls";
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

function Scale({ value, labels, label, onChange }: { value: number; labels: [string, string]; label: string; onChange: (n: number) => void }) {
  return (
    <div className="scale">
      <div className="scale-dots" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <motion.button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} of 5`} className="scale-dot" data-on={n <= value}
            whileTap={{ scale: 0.85 }} transition={spring.snappy} onClick={() => { haptic.select(); onChange(value === n ? 0 : n); }}>
            {value === n && <motion.span layoutId={`scale-${label}`} className="scale-pill" transition={spring.snappy} />}
            <span>{n}</span>
          </motion.button>
        ))}
      </div>
      <div className="scale-ends muted small"><span>{labels[0]}</span><span>{labels[1]}</span></div>
    </div>
  );
}

/** `day` presets the slip's date, e.g. from the calendar, so a slip can be logged honestly for any past day. */
interface Props { open: boolean; habit: Habit; name: string; age: number; onClose: () => void; onSaved: (d: Deduction) => void; day?: string }

export function LogSheet(props: Props) {
  return (
    <Sheet open={props.open} onClose={props.onClose} label="Log a slip">
      {props.open && <LogBody {...props} />}
    </Sheet>
  );
}

function LogBody({ habit, name, age, onClose, onSaved, day: presetDay }: Props) {
  const data = useData();
  const [values, setValues] = useState<Entry["values"]>({});
  const [day, setDay] = useState(presetDay ?? today());
  const older = presetDay && presetDay < addDays(today(), -1) ? presetDay : null;
  const [time, setTime] = useState("");
  const [crisis, setCrisis] = useState(false);
  const [result, setResult] = useState<Deduction | null>(null);
  const [ageBefore] = useState(age);
  // What the person had built before this slip, so the result can say plainly that it still stands.
  const [keptMet] = useState(() => { const slips = new Set(data.entries.filter((e) => e.habitId === habit.id).map((e) => e.day)); return data.cleanDays.filter((c) => c.habitId === habit.id && !slips.has(c.day)).length; });
  const [keptUrges] = useState(() => data.urges.filter((u) => u.habitId === habit.id && u.outcome === "rode_it_out").length);
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
  const unitLabel = habit.unit === "money" ? data.settings.currency : habit.unit === "minutes" ? "min" : "";

  function save() {
    if (missing.length) { haptic.warn(); setShake((s) => s + 1); return; }
    const texts = habit.fields.filter((f) => f.type === "text").map((f) => String(values[f.id] ?? ""));
    if (texts.some(hasCrisisLanguage)) { setCrisis(true); return; }
    const d = actions.logSlip(habit.id, values, day, time || null);
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
      <motion.h2 variants={rise}>Pause for a moment</motion.h2>
      <motion.p variants={rise}>{CRISIS_MESSAGE}</motion.p>
      <motion.div variants={rise}><Button variant="secondary" onClick={onClose}>Close</Button></motion.div>
    </motion.div>
  );

  if (result) {
    const felt = Math.max(0, result.entry.months - result.absorbed);
    const ageAfter = Math.min(100, ageBefore + (felt / 1200) * 100);
    const shrugged = result.absorbed > 0 && felt < 0.05;
    return (
      <motion.div className="stack" variants={stagger} initial="hidden" animate="show">
        <motion.h2 variants={rise}>{lapseHeadline(data.settings.tone, name)}</motion.h2>
        <motion.p className="muted small" variants={rise}>Logged · {day === today() ? "today" : day === addDays(today(), -1) ? "yesterday" : fmtDay(day)}{time ? ` at ${fmtTime(time)}` : ""}</motion.p>
        <motion.div className="deduction" variants={rise}>
          <span>{shrugged ? `${name} shrugged it off` : "That cost " + name}</span>
          <b className={shrugged ? "" : "neg"}>−<AnimatedNumber value={felt} from={0} decimals={1} /> months</b>
          <div className="delta-bar" aria-hidden>
            <i className="before" style={{ width: `${ageBefore}%` }} />
            <motion.i className="added" initial={{ width: 0 }} animate={{ width: `${Math.max(0.6, ageAfter - ageBefore)}%` }} transition={{ ...spring.calm, delay: 0.35 }} style={{ left: `${ageBefore}%` }} />
          </div>
          {result.absorbed > 0 && <span className="small">{shrugged
            ? `${result.streakBefore} good days made ${name} strong. This one was absorbed, but the cushion is thinner now.`
            : `${name}'s strength from good days took ${Math.round(result.absorbed * 10) / 10} months of it.`}</span>}
          {result.binge && data.settings.petLife === "classic" && <span className="small"><b>Binge day.</b> Part of today is now a permanent scar: {name}'s life expectancy went down.</span>}
          {!shrugged && result.effectLine && <span>{result.effectLine}</span>}
          <span className="muted small">{result.nthToday > 1 ? `Slip ${result.nthToday} today. ` : ""}{result.weekSlips} this week.</span>
        </motion.div>
        <AnimatePresence mode="wait">
          <motion.p key={result.line} className="bubble" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring.soft}>
            {result.line}{result.entry.source === "ai" && <span className="ai-tag" title="Written by AI, checked against the rules">{Icon.spark}</span>}
          </motion.p>
        </AnimatePresence>
        {polishing && <div className="shimmer-line" aria-live="polite"><span className="sr-only">Finding the right words</span></div>}
        <motion.p className="muted small" variants={rise}>{progressKept(data.settings.tone, keptMet, keptUrges)}</motion.p>
        <motion.div variants={rise}><LapseReflection entryId={result.entry.id} habit={habit} onDone={onClose} /></motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div className="stack" variants={stagger} initial="hidden" animate="show">
      <motion.div className="row" variants={rise}><h2>Log a slip</h2><Button variant="text" onClick={onClose}>Cancel</Button></motion.div>
      <motion.div className="chips" role="group" aria-label="Day" variants={rise}>
        <Chip pressed={day === today()} onClick={() => setDay(today())}>Today</Chip>
        <Chip pressed={day === addDays(today(), -1)} onClick={() => setDay(addDays(today(), -1))}>Yesterday</Chip>
        {older && <Chip pressed={day === older} onClick={() => setDay(older)}>{fmtDay(older)}</Chip>}
        <Chip pressed={!!time} onClick={() => { const n = new Date(); setTime(time ? "" : `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes() - (n.getMinutes() % 5)).padStart(2, "0")}`); }}>{time ? fmtTime(time) : "Add time"}</Chip>
      </motion.div>
      {time && <motion.div variants={rise}><TimePicker label="Time of the slip" value={time} onChange={setTime} /></motion.div>}
      {habit.fields.map((f) => (
        <motion.div className="field" key={f.id} variants={rise}
          animate={missing.some((m) => m.id === f.id) && shake ? { x: [0, -8, 8, -5, 5, 0] } : undefined} transition={{ duration: 0.4 }}>
          <span className="field-label">{f.label}{f.required && <span className="req" aria-label="required"> ·</span>}</span>
          {f.type === "text" && <input className="input" autoComplete="off" maxLength={120} value={String(values[f.id] ?? "")} onChange={(e) => set(f.id, e.target.value)} aria-label={f.label} />}
          {(f.type === "number" || f.type === "money") && (<>
            <div className="amount-wrap">
              {f.type === "money" && <span className="prefix">{data.settings.currency}</span>}
              <input className="input amount" inputMode="decimal" type="number" min="0" placeholder="0" aria-label={f.label}
                value={String(values[f.id] ?? "")} onChange={(e) => set(f.id, e.target.value)} />
              {f.type === "number" && habit.unit === "minutes" && <span className="suffix">min</span>}
            </div>
            {f.amount && recent.length > 0 && (
              <div className="chips quick">{recent.map((a) => <Chip key={a} pressed={String(values[f.id]) === String(a)} onClick={() => set(f.id, String(a))}>{unitLabel && habit.unit === "money" ? `${unitLabel} ${a}` : `${a}${unitLabel ? ` ${unitLabel}` : ""}`}</Chip>)}</div>
            )}
          </>)}
          {f.type === "choice" && (
            <div className="chips" role="radiogroup" aria-label={f.label}>
              {(f.options ?? []).map((o) => <Chip key={o.id} pressed={values[f.id] === o.id} onClick={() => set(f.id, values[f.id] === o.id ? "" : o.id)}>{o.label}</Chip>)}
            </div>
          )}
          {f.type === "multi" && (
            <div className="chips" role="group" aria-label={f.label}>
              {(f.options ?? []).map((o) => {
                const picked = String(values[f.id] ?? "").split(",").filter(Boolean);
                const on = picked.includes(o.id);
                return <Chip key={o.id} pressed={on} onClick={() => set(f.id, (on ? picked.filter((x) => x !== o.id) : [...picked, o.id]).join(","))}>{o.label}</Chip>;
              })}
            </div>
          )}
          {f.type === "scale" && <Scale value={Number(values[f.id] ?? 0)} labels={f.scaleLabels ?? ["Low", "High"]} label={f.label} onChange={(n) => set(f.id, n ? String(n) : "")} />}
          {f.type === "yesno" && <Segmented label={f.label} value={values[f.id] as boolean | undefined} onChange={(v) => set(f.id, v)} options={[{ value: true, label: "Yes" }, { value: false, label: "No" }]} />}
          {f.type === "photo" && (
            <label className="photo-tile">
              {typeof values[f.id] === "string" && values[f.id]
                ? <motion.img src={String(values[f.id])} alt="Photo attached to this slip" width={640} height={480} initial={{ opacity: 0, scale: 1.05 }} animate={{ opacity: 1, scale: 1 }} />
                : <span className="muted">{Icon.camera} Add a photo · stays on this phone</span>}
              <input type="file" accept="image/*" className="sr-only" onChange={async (e) => { const file = e.target.files?.[0]; if (file) set(f.id, await shrink(file)); }} />
            </label>
          )}
        </motion.div>
      ))}
      <motion.div variants={rise}><Button onClick={save} className={missing.length ? "soft-disabled" : ""}>Save slip</Button></motion.div>
    </motion.div>
  );
}

/**
 * Optional, after a slip: what came before it and one small adjustment. Skipping is always fine, and nothing
 * here changes the companion. The adjustment can go into the plan as an if-then.
 */
function LapseReflection({ entryId, habit, onDone }: { entryId: string; habit: Habit; onDone: () => void }) {
  const data = useData();
  const plan = data.settings.plan;
  const [open, setOpen] = useState(false);
  const [before, setBefore] = useState("");
  const [adjust, setAdjust] = useState("");
  const [keep, setKeep] = useState(true);
  const crisis = hasCrisisLanguage(before) || hasCrisisLanguage(adjust);
  const ideas = [...(plan?.ifThen ?? []).slice(0, 1), ...frictionIdeas(habit.cls, habit.name).slice(0, 2), "Check in tomorrow evening, whatever happens"];
  function save() {
    if (crisis) return;
    if (before.trim() || adjust.trim()) actions.reflectOnLapse(entryId, { before, adjust });
    if (keep && adjust.trim()) actions.addIfThen(adjust);
    haptic.success();
    onDone();
  }
  if (!open) return (
    <div className="stack tight">
      {plan?.firstStep && <p className="small">Back to your plan: <b>{plan.firstStep}</b></p>}
      <Button onClick={onDone}>Back to my day</Button>
      <Button variant="secondary" onClick={() => setOpen(true)}>Reflect for a moment (optional)</Button>
    </div>
  );
  return (
    <div className="card stack">
      <label className="field"><span className="field-label">What was happening just before?</span>
        <input className="input" autoComplete="off" maxLength={160} value={before} placeholder="e.g. long day, tired, phone in bed" onChange={(e) => setBefore(e.target.value)} />
      </label>
      <div className="field"><span className="field-label">One small thing to try next time</span>
        <div className="chips" role="radiogroup" aria-label="Ideas">{ideas.map((x) => <Chip key={x} pressed={adjust === x} onClick={() => setAdjust(adjust === x ? "" : x)}>{x}</Chip>)}</div>
        <input className="input" autoComplete="off" maxLength={160} value={adjust} placeholder="Or your own, e.g. If I'm home alone after 10, I'll make tea" onChange={(e) => setAdjust(e.target.value)} aria-label="Your own adjustment" />
      </div>
      {adjust.trim() && <Switch checked={keep} onChange={setKeep} label="Add it to my plan" hint="It will show up in Me → Your plan and when an urge hits." />}
      {crisis && <div className="banner danger" role="alert">{CRISIS_MESSAGE}</div>}
      <Button onClick={save} disabled={crisis}>Save and go back</Button>
      <Button variant="text" onClick={onDone}>Skip</Button>
    </div>
  );
}
