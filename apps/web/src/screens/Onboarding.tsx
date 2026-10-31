import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { AdoptionMode, HabitClass } from "@detox/engine";
import { LiveCompanion } from "../Companion";
import { DISCLAIMER, hatchLine } from "../copy";
import { concernIn } from "../guard";
import { t } from "../text";
import { haptic } from "../haptics";
import { remindersSupported, requestReminders } from "../notify";
import { toast } from "../ui/Toast";
import { rise, spring } from "../motion";
import { HABIT_CHOICES, inferClass, measureForLabel } from "../questions";
import { actions, emptyPlan } from "../store";
import { PetStep } from "./Pets";
import { planConcern } from "./Plan";
import { sceneFor } from "../scene";
import { PetScene } from "../ui/PetScene";
import { TimePicker } from "../ui/TimePicker";
import { fmtTime } from "../dates";
import { NAMES, coatsFor } from "../pets";
import { Burst, Button, Icon, plainOpts, Select, SelectOther, Switch } from "../ui/Controls";
import type { Baseline, Personality, RecoveryPlan, Species, Tone } from "../types";

export const BASELINES: { value: Baseline | "unsure"; label: string }[] = [
  { value: "many_daily", label: "Several times a day" }, { value: "daily", label: "About once a day" },
  { value: "few_weekly", label: "A few times a week" }, { value: "weekly", label: "Once a week or less" },
  { value: "unsure", label: "I'm not sure" },
];

const REMINDERS = [{ time: "09:00", label: () => t("onboarding.reminders.morning") }, { time: "13:00", label: () => t("onboarding.reminders.midday") }, { time: "20:00", label: () => t("onboarding.reminders.evening") }, { time: "22:00", label: () => t("onboarding.reminders.late") }];
const CUSTOM_TIME = "custom";
const STORY = [
  { title: t("welcome.story.s1_title"), body: t("welcome.story.s1_body") },
  { title: t("welcome.story.s2_title"), body: t("welcome.story.s2_body") },
  { title: t("welcome.story.s3_title"), body: t("welcome.story.s3_body") },
];

const DRAFT = "companion/onboarding-draft";
interface Draft {
  step: number; species: Species; companionName: string; userName: string; what: string; cls: HabitClass; amountLabel: string;
  baseline: Baseline | null; triggers: string[]; tone: Tone; reminder: string; coat: string; breed: string; personality: Personality; adoption: AdoptionMode;
  plan: RecoveryPlan;
}
const initial: Draft = {
  step: 1, species: "dog", companionName: NAMES.dog[0], userName: "", what: "", cls: "custom", amountLabel: "",
  baseline: null, triggers: [], tone: "honest", reminder: "20:00", coat: "", breed: "", personality: "playful", adoption: "raise",
  plan: emptyPlan(),
};
const loadDraft = (): Draft => { try { const d = { ...initial, ...JSON.parse(sessionStorage.getItem(DRAFT) ?? "{}") }; return { ...d, plan: { ...emptyPlan(), ...(d.plan ?? {}) }, step: Math.min(STEPS, Math.max(1, d.step)) }; } catch { return initial; } };
const STEPS = 3; // the hatch is step 4
const HATCH = STEPS + 1;

export function Onboarding() {
  const [d, setD] = useState<Draft>(loadDraft);
  const [adult, setAdult] = useState(false);
  const [ownTime, setOwnTime] = useState(() => !REMINDERS.some((r) => r.time === loadDraft().reminder));
  const up = (p: Partial<Draft>) => setD((s) => ({ ...s, ...p }));
  useEffect(() => { try { sessionStorage.setItem(DRAFT, JSON.stringify(d)); } catch { /* ignore */ } }, [d]);

  const go = (n: number) => { haptic.select(); up({ step: n }); };
  const name = d.companionName.trim() || NAMES[d.species][0];
  // Every typed field is checked as it is typed; Continue waits until none of them needs the safety note.
  const nameConcern = concernIn(d.companionName) ?? concernIn(d.userName);
  const whatConcern = concernIn(d.what);
  const planBlocked = planConcern(d.plan) !== null;

  const pickWhat = (text: string) => up({ what: text, cls: inferClass(text) });
  const finish = () => {
    try { sessionStorage.removeItem(DRAFT); } catch { /* ignore */ }
    actions.finishOnboarding({ species: d.species, coat: d.coat || coatsFor(d.species, d.breed)[0].id, breed: d.breed || undefined, personality: d.personality, companionName: name, userName: d.userName, intake: { what: d.what, measure: measureForLabel(d.amountLabel), amountLabel: d.amountLabel, triggers: [], cls: d.cls }, tone: d.tone, reminder: d.reminder, baseline: d.baseline, plan: planBlocked ? null : d.plan, adoption: d.adoption });
  };

  const showChrome = d.step < HATCH;
  const canGoBack = d.step > 1 && d.step < HATCH;
  const rescue = d.adoption === "rescue";
  return (
    <div className={`screen onboard${d.step === HATCH ? " onboard-hatch" : ""}`}>
      <div className="ob-top" data-hidden={!showChrome}>
        <button className="icon-btn" aria-label={t("ui.common.back")} onClick={() => go(d.step - 1)} disabled={!canGoBack}>{Icon.back}</button>
        <div className="progress" aria-hidden><i style={{ width: `${(d.step / STEPS) * 100}%` }} /></div>
        <span className="small muted">{t("onboarding.chrome.progress", { step: Math.min(d.step, STEPS), total: STEPS })}</span>
      </div>

      <div key={d.step} className="step">
        <div className="step-inner">

          {d.step === 1 && (<>
            <h1 className="t-display">{t("onboarding.pet.title")}</h1>
            <p className="muted">{t("onboarding.pet.intro")}</p>
            <PetStep compact pet={{ species: d.species, coat: d.coat, breed: d.breed, personality: d.personality, name: d.companionName, adoption: d.adoption }}
              onChange={(p) => {
                // A new species brings its own first name, unless the person typed their own.
                const swapped = p.species && p.species !== d.species && (!d.companionName.trim() || NAMES[d.species].includes(d.companionName));
                up({ ...(p.species ? { species: p.species } : {}), ...(p.coat !== undefined ? { coat: p.coat } : {}), ...(p.breed !== undefined ? { breed: p.breed } : {}),
                  ...(p.name !== undefined && !swapped ? { companionName: p.name } : {}), ...(swapped ? { companionName: NAMES[p.species!][0] } : {}) });
              }} />
            <Button disabled={nameConcern !== null || !d.companionName.trim()} onClick={() => go(2)}>{t("ui.common.continue")}</Button>
          </>)}

          {d.step === 2 && (<>
            <h1 className="t-display">{t("onboarding.change.title")}</h1>
            <p className="muted">{t("onboarding.change.intro")}</p>
            <div className="field"><span className="field-label">{t("onboarding.change.field")}</span>
              <SelectOther label={t("onboarding.change.aria")} options={plainOpts(HABIT_CHOICES)} value={d.what} onChange={pickWhat} placeholder={t("onboarding.change.placeholder")} otherPlaceholder={t("onboarding.change.own")} />
            </div>
            <Button disabled={!d.what.trim() || whatConcern !== null} onClick={() => go(3)}>{t("ui.common.continue")}</Button>
          </>)}

          {d.step === 3 && (<>
            <h1 className="t-display">{t("onboarding.reminders.title")}</h1>
            <p className="muted">{t("onboarding.reminders.intro", { name })}</p>
            <div className="field"><span className="field-label">{t("onboarding.reminders.field")}</span>
              <Select label={t("onboarding.reminders.aria")} value={ownTime ? CUSTOM_TIME : d.reminder}
                options={[...REMINDERS.map((r) => ({ value: r.time, label: t("onboarding.reminders.option", { label: r.label(), time: fmtTime(r.time) }) })), { value: CUSTOM_TIME, label: t("onboarding.reminders.other") }]}
                onChange={(t) => { if (t === CUSTOM_TIME) setOwnTime(true); else { setOwnTime(false); up({ reminder: t }); } }} />
              {ownTime && <TimePicker label={t("onboarding.reminders.aria")} value={d.reminder} onChange={(v) => up({ reminder: v })} />}
            </div>
            <h2>{t("onboarding.final.title")}</h2>
            <div className="card stack">
              <p>{DISCLAIMER}</p>
              <p className="muted small">{t("safety.disclaimer.illustrative")}</p>
            </div>
            <Switch checked={adult} onChange={setAdult} label={t("onboarding.final.adult")} hint={t("onboarding.final.adult_hint")} />
            <div className="stack tight">
              <Button disabled={!adult} onClick={async () => {
                const on = await requestReminders(d.reminder, d.tone, name);
                if (!on) toast(remindersSupported ? t("notifications.permission.blocked") : t("notifications.permission.web"), { kind: "bad" });
                go(HATCH);
              }}>{t("onboarding.reminders.turn_on")}</Button>
              <Button variant="text" disabled={!adult} onClick={() => go(HATCH)}>{t("ui.common.not_now")}</Button>
            </div>
          </>)}

          {d.step === HATCH && <Hatch species={d.species} coat={d.coat} breed={d.breed} name={name} tone={d.tone} rescue={rescue} onDone={finish} />}
        </div>
      </div>
    </div>
  );
}

export function Story({ species, onStart }: { species: Species; onStart: () => void }) {
  const [i, setI] = useState(0);
  const card = STORY[i];
  const next = () => (i < STORY.length - 1 ? (haptic.select(), setI(i + 1)) : onStart());
  return (
    <div className="story">
      <motion.div className="story-art" variants={rise}>
        <div className="breathe-ring" />
        <motion.div drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.3}
          onDragEnd={(_, info) => { if (info.offset.x < -60) next(); else if (info.offset.x > 60 && i > 0) setI(i - 1); }}>
          <LiveCompanion species={species} stage={i === 1 ? "middle" : "baby"} mood={i === 1 ? "sick" : "happy"} age={i === 1 ? 55 : 3} size={220} />
        </motion.div>
      </motion.div>
      <AnimatePresence mode="wait">
        <motion.div key={i} className="story-text" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={spring.soft}>
          <h1>{card.title}</h1>
          <p className="muted">{card.body}</p>
        </motion.div>
      </AnimatePresence>
      <div className="pager" aria-hidden>{STORY.map((_, k) => <motion.i key={k} animate={{ width: k === i ? 22 : 8, opacity: k === i ? 1 : 0.35 }} transition={spring.snappy} />)}</div>
      <Button onClick={next}>{i < STORY.length - 1 ? t("welcome.story.next") : t("welcome.story.get_started")}</Button>
      {i < STORY.length - 1 && <Button variant="text" onClick={onStart}>{t("welcome.story.skip")}</Button>}
    </div>
  );
}

function Hatch({ species, coat, breed, name, tone, rescue, onDone }: { species: Species; coat?: string; breed?: string; name: string; tone: Tone; rescue: boolean; onDone: () => void }) {
  const [phase, setPhase] = useState<"egg" | "crack" | "born">("egg");
  useEffect(() => {
    const a = setTimeout(() => { setPhase("crack"); haptic.tap(); }, 1300);
    const b = setTimeout(() => { setPhase("born"); haptic.success(); }, 2300);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);
  // A new pet hatches into fair weather; a rescue arrives in a storm.
  const scene = sceneFor({ wellness: rescue ? 20 : 85, rescue, slipToday: false, milestoneToday: false, hour: new Date().getHours() });
  return (
    <div className="hatch">
      <div className="hatch-scene">
        <PetScene scene={scene}>
          <AnimatePresence mode="wait">
            {phase !== "born" ? (
              <motion.svg key="egg" viewBox="0 0 120 150" width="150" className="egg"
                animate={{ rotate: phase === "crack" ? [0, -10, 10, -8, 8, 0] : [0, -4, 4, 0] }}
                transition={{ duration: phase === "crack" ? 0.6 : 1.2, repeat: phase === "crack" ? 1 : Infinity }}
                exit={{ scale: 1.3, opacity: 0, transition: { duration: 0.25 } }}>
                <ellipse cx="60" cy="80" rx="46" ry="60" className="egg-shell" />
                <ellipse cx="44" cy="60" rx="8" ry="12" fill="#fff" opacity=".5" />
                {phase === "crack" && <motion.path d="M20 78 L36 70 L48 84 L62 70 L76 84 L88 72 L100 80" className="egg-crack" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4 }} />}
              </motion.svg>
            ) : (
              <motion.div key="pet" initial={{ scale: 0.3, y: 40, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} transition={spring.bouncy}>
                <Burst burst={1} kind="spark" count={12} />
                <LiveCompanion species={species} coat={coat} breed={breed} stage="baby" mood="happy" gesture="hop" age={0} size={220} light={scene.light} />
              </motion.div>
            )}
          </AnimatePresence>
        </PetScene>
      </div>
      <AnimatePresence>
        {phase === "born" && (
          <motion.div className="stack center-text" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring.soft, delay: 0.4 }}>
            <h1 className="t-display">{t("onboarding.hatch.born", { name })}</h1>
            <p className="muted">{hatchLine(tone, name)}</p>
            <Button onClick={onDone}>{t("onboarding.hatch.go")}</Button>
          </motion.div>
        )}
      </AnimatePresence>
      {phase !== "born" && <p className="muted center-text">{t("onboarding.hatch.waiting")}</p>}
    </div>
  );
}
