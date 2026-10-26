import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { HabitClass } from "@detox/engine";
import { LiveCompanion, PetPortrait } from "../Companion";
import { DISCLAIMER, hatchLine, TONES, tonePreview } from "../copy";
import { concernIn } from "../guard";
import { t } from "../text";
import { haptic } from "../haptics";
import { remindersSupported, requestReminders } from "../notify";
import { toast } from "../ui/Toast";
import { fade, rise, spring, stagger } from "../motion";
import { AMOUNT_CHOICES, HABIT_CHOICES, inferClass, measureForLabel, NO_AMOUNT } from "../questions";
import { actions, emptyPlan } from "../store";
import { HelpSection, planConcern, WhySection } from "./Plan";
import { SITUATIONS } from "../recovery";
import { PetStep } from "./Pets";
import { TimePicker } from "../ui/TimePicker";
import { fmtTime } from "../dates";
import { COATS, NAMES } from "../pets";
import { Burst, Button, GuardedInput, Icon, MultiSelect, plainOpts, Select, SelectOther, Switch } from "../ui/Controls";
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
  baseline: Baseline | null; triggers: string[]; tone: Tone; reminder: string; coat: string; personality: Personality;
  plan: RecoveryPlan;
}
const initial: Draft = {
  step: 1, species: "dog", companionName: "", userName: "", what: "", cls: "custom", amountLabel: "",
  baseline: null, triggers: [], tone: "honest", reminder: "20:00", coat: "", personality: "playful",
  plan: emptyPlan(),
};
const loadDraft = (): Draft => { try { const d = { ...initial, ...JSON.parse(sessionStorage.getItem(DRAFT) ?? "{}") }; return { ...d, plan: { ...emptyPlan(), ...(d.plan ?? {}) }, step: Math.min(LAST - 1, Math.max(1, d.step)) }; } catch { return initial; } };
const LAST = 10;

export function Onboarding() {
  const [d, setD] = useState<Draft>(loadDraft);
  const [adult, setAdult] = useState(false);
  const [ownTime, setOwnTime] = useState(() => !REMINDERS.some((r) => r.time === loadDraft().reminder));
  const up = (p: Partial<Draft>) => setD((s) => ({ ...s, ...p }));
  useEffect(() => { try { sessionStorage.setItem(DRAFT, JSON.stringify(d)); } catch { /* ignore */ } }, [d]);
  useEffect(() => { document.documentElement.dataset.pet = d.species; }, [d.species]);

  const go = (n: number) => { haptic.select(); up({ step: n }); };
  const name = d.companionName.trim() || NAMES[d.species][0];
  // Every typed field is checked as it is typed; Continue waits until none of them needs the safety note.
  const nameConcern = concernIn(d.companionName) ?? concernIn(d.userName);
  const whatConcern = concernIn(d.what);
  const amountConcern = concernIn(d.amountLabel);
  const setPlan = (p: Partial<RecoveryPlan>) => setD((s) => ({ ...s, plan: { ...s.plan, ...p } }));
  const planBlocked = planConcern(d.plan) !== null;

  const pickWhat = (text: string) => up({ what: text, cls: inferClass(text) });
  const finish = () => {
    try { sessionStorage.removeItem(DRAFT); } catch { /* ignore */ }
    actions.finishOnboarding({ species: d.species, coat: d.coat || COATS[d.species][0].id, personality: d.personality, companionName: name, userName: d.userName, intake: { what: d.what, measure: measureForLabel(d.amountLabel), amountLabel: d.amountLabel, triggers: [], cls: d.cls }, tone: d.tone, reminder: d.reminder, baseline: d.baseline, plan: planBlocked ? null : d.plan });
  };

  const showChrome = d.step > 0 && d.step < LAST;
  const canGoBack = d.step > 1 && d.step < LAST;
  return (
    <div className="screen onboard">
      <div className="ob-top" data-hidden={!showChrome}>
        <button className="icon-btn" aria-label={t("ui.common.back")} onClick={() => go(d.step - 1)} disabled={!canGoBack}>{Icon.back}</button>
        <div className="progress" aria-hidden><motion.i animate={{ width: `${(d.step / (LAST - 1)) * 100}%` }} transition={spring.calm} /></div>
        <span className="small muted">{t("onboarding.chrome.progress", { step: Math.min(d.step, LAST - 1), total: LAST - 1 })}</span>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={d.step} className="step" variants={fade} initial="enter" animate="center" exit="exit">
          <motion.div className="step-inner" variants={stagger} initial="hidden" animate="show">

            {d.step === 1 && (<>
              <motion.h1 variants={rise}>{t("onboarding.pet.title")}</motion.h1>
              <motion.p className="muted" variants={rise}>{t("onboarding.pet.intro")}</motion.p>
              <motion.div variants={rise}><PetStep pet={{ species: d.species, coat: d.coat, personality: d.personality, name: d.companionName }}
                onChange={(p) => up({ ...(p.species ? { species: p.species } : {}), ...(p.coat !== undefined ? { coat: p.coat } : {}), ...(p.personality ? { personality: p.personality } : {}), ...(p.name !== undefined ? { companionName: p.name } : {}) })} /></motion.div>
              <motion.label className="field" variants={rise}><span className="field-label">{t("onboarding.pet.call_you", { name: d.companionName.trim() || "they" })}</span>
                <GuardedInput className="input" autoComplete="given-name" value={d.userName} placeholder={t("onboarding.pet.call_you_placeholder")} maxLength={30} onChange={(e) => up({ userName: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") go(2); }} />
              </motion.label>
              <motion.div variants={rise}><Button disabled={nameConcern !== null} onClick={() => go(2)}>{t("ui.common.continue")}</Button></motion.div>
            </>)}

            {d.step === 2 && (<>
              <motion.h1 variants={rise}>{t("onboarding.change.title")}</motion.h1>
              <motion.p className="muted" variants={rise}>{t("onboarding.change.intro")}</motion.p>
              <motion.div className="field" variants={rise}><span className="field-label">{t("onboarding.change.field")}</span>
                <SelectOther label={t("onboarding.change.aria")} options={plainOpts(HABIT_CHOICES)} value={d.what} onChange={pickWhat} placeholder={t("onboarding.change.placeholder")} otherPlaceholder={t("onboarding.change.own")} />
              </motion.div>
              <motion.div variants={rise}><Button disabled={!d.what.trim() || whatConcern !== null} onClick={() => go(3)}>{t("ui.common.continue")}</Button></motion.div>
            </>)}

            {d.step === 3 && (<>
              <motion.h1 variants={rise}>{t("onboarding.count.title")}</motion.h1>
              <motion.p className="muted" variants={rise}>{t("onboarding.count.intro")}</motion.p>
              <motion.div className="field" variants={rise}><span className="field-label">{t("onboarding.count.field")}</span>
                <SelectOther label={t("onboarding.count.aria")} value={d.amountLabel} onChange={(v) => up({ amountLabel: v === NO_AMOUNT ? "" : v })} maxLength={40}
                  options={[...plainOpts(AMOUNT_CHOICES.map((a) => a.label)), { value: NO_AMOUNT, label: t("onboarding.count.none") }]}
                  placeholder={t("onboarding.count.none")} otherPlaceholder={t("onboarding.count.own")} />
              </motion.div>
              <motion.div className="field" variants={rise}><span className="field-label">{t("onboarding.count.often_field")}</span>
                <Select label={t("onboarding.count.often_aria")} value={d.baseline ?? undefined} placeholder={t("onboarding.count.choose")} options={BASELINES} onChange={(b) => up({ baseline: b === "unsure" ? null : b })} />
              </motion.div>
              <motion.p className="muted small" variants={rise}>{t("onboarding.count.note")}</motion.p>
              <motion.div variants={rise}><Button disabled={amountConcern !== null} onClick={() => go(4)}>{t("ui.common.continue")}</Button></motion.div>
            </>)}

            {d.step === 4 && (<>
              <motion.h1 variants={rise}>{t("onboarding.triggers.title")}</motion.h1>
              <motion.p className="muted" variants={rise}>{t("onboarding.triggers.intro")}</motion.p>
              <motion.div className="field" variants={rise}><span className="field-label">{t("onboarding.triggers.field")}</span>
                <MultiSelect label={t("onboarding.triggers.field")} options={plainOpts(SITUATIONS)} value={d.triggers} onChange={(triggers) => up({ triggers })} max={8} placeholder={t("onboarding.triggers.placeholder")} />
              </motion.div>
              <motion.div variants={rise}><Button onClick={() => { setPlan({ situations: [...new Set([...d.plan.situations, ...d.triggers.map((x) => x.trim()).filter(Boolean)])].slice(0, 12) }); up({ triggers: [] }); go(5); }}>{d.triggers.some((x) => x.trim()) ? t("ui.common.continue") : t("ui.common.skip_for_now")}</Button></motion.div>
            </>)}

            {d.step === 5 && (<>
              <motion.h1 variants={rise}>{t("onboarding.why.title")}</motion.h1>
              <motion.p className="muted" variants={rise}>{t("onboarding.why.intro")}</motion.p>
              <motion.div className="stack" variants={rise}><WhySection plan={d.plan} set={setPlan} situations={false} /></motion.div>
              <motion.div className="stack tight" variants={rise}>
                <Button disabled={planBlocked} onClick={() => go(6)}>{t("ui.common.continue")}</Button>
                <Button variant="text" onClick={() => go(7)}>{t("ui.common.skip_for_now")}</Button>
              </motion.div>
            </>)}

            {d.step === 6 && (<>
              <motion.h1 variants={rise}>{t("onboarding.help.title")}</motion.h1>
              <motion.p className="muted" variants={rise}>{t("onboarding.help.intro")}</motion.p>
              <motion.div className="stack" variants={rise}><HelpSection plan={d.plan} set={setPlan} cls={d.cls} /></motion.div>
              <motion.div className="stack tight" variants={rise}>
                <Button disabled={planBlocked} onClick={() => go(7)}>{t("ui.common.continue")}</Button>
                <Button variant="text" onClick={() => go(7)}>{t("ui.common.skip_for_now")}</Button>
              </motion.div>
            </>)}

            {d.step === 7 && (<>
              <motion.h1 variants={rise}>{t("onboarding.voice.title", { name })}</motion.h1>
              <motion.div className="preview" variants={rise}>
                <PetPortrait species={d.species} coat={d.coat} stage="young" mood={d.tone === "brutal" ? "idle" : "happy"} age={14} size={110} />
                <AnimatePresence mode="wait">
                  <motion.p key={d.tone} className="speech" initial={{ opacity: 0, scale: 0.92, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} transition={spring.bouncy}>
                    {tonePreview(d.tone, name)}
                  </motion.p>
                </AnimatePresence>
              </motion.div>
              <motion.div className="field" variants={rise}>
                <span className="field-label">{t("onboarding.voice.field")}</span>
                <Select label={t("onboarding.voice.field")} value={d.tone} options={TONES.map((t) => ({ value: t.id, label: t.label }))} onChange={(tone) => up({ tone })} />
              </motion.div>
              <motion.p className="muted small" variants={rise}>{t("onboarding.voice.note")}</motion.p>
              <motion.div variants={rise}><Button onClick={() => go(8)}>{t("ui.common.continue")}</Button></motion.div>
            </>)}

            {d.step === 8 && (<>
              <motion.div className="bell" variants={rise} animate={{ rotate: [0, -14, 12, -8, 6, 0] }} transition={{ duration: 1, delay: 0.4 }}>{Icon.bell}</motion.div>
              <motion.h1 variants={rise}>{t("onboarding.reminders.title")}</motion.h1>
              <motion.p className="muted" variants={rise}>{t("onboarding.reminders.intro", { name })}</motion.p>
              <motion.div className="field" variants={rise}><span className="field-label">{t("onboarding.reminders.field")}</span>
                <Select label={t("onboarding.reminders.aria")} value={ownTime ? CUSTOM_TIME : d.reminder}
                  options={[...REMINDERS.map((r) => ({ value: r.time, label: t("onboarding.reminders.option", { label: r.label(), time: fmtTime(r.time) }) })), { value: CUSTOM_TIME, label: t("onboarding.reminders.other") }]}
                  onChange={(t) => { if (t === CUSTOM_TIME) setOwnTime(true); else { setOwnTime(false); up({ reminder: t }); } }} />
                {ownTime && <TimePicker label={t("onboarding.reminders.aria")} value={d.reminder} onChange={(v) => up({ reminder: v })} />}
              </motion.div>
              <motion.div className="stack tight" variants={rise}>
                <Button onClick={async () => {
                  const on = await requestReminders(d.reminder, d.tone, name);
                  if (!on) toast(remindersSupported ? t("notifications.permission.blocked") : t("notifications.permission.web"), { kind: "bad" });
                  go(9);
                }}>{t("onboarding.reminders.turn_on")}</Button>
                <Button variant="text" onClick={() => go(9)}>{t("ui.common.not_now")}</Button>
              </motion.div>
            </>)}

            {d.step === 9 && (<>
              <motion.h1 variants={rise}>{t("onboarding.final.title")}</motion.h1>
              <motion.div className="card stack" variants={rise}>
                <p>{DISCLAIMER}</p>
                <p className="muted small">{t("safety.disclaimer.illustrative")}</p>
              </motion.div>
              <motion.div variants={rise}><Switch checked={adult} onChange={setAdult} label={t("onboarding.final.adult")} hint={t("onboarding.final.adult_hint")} /></motion.div>
              <motion.div variants={rise}><Button disabled={!adult} onClick={() => go(10)}>{t("onboarding.final.meet", { name })}</Button></motion.div>
            </>)}

            {d.step === 10 && <Hatch species={d.species} coat={d.coat} name={name} tone={d.tone} onDone={finish} />}
          </motion.div>
        </motion.div>
      </AnimatePresence>
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

function Hatch({ species, coat, name, tone, onDone }: { species: Species; coat?: string; name: string; tone: Tone; onDone: () => void }) {
  const [phase, setPhase] = useState<"egg" | "crack" | "born">("egg");
  useEffect(() => {
    const a = setTimeout(() => { setPhase("crack"); haptic.tap(); }, 1300);
    const b = setTimeout(() => { setPhase("born"); haptic.success(); }, 2300);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);
  return (
    <div className="hatch">
      <div className="hatch-stage">
        <div className="breathe-ring" />
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
              <LiveCompanion species={species} coat={coat} stage="baby" mood="happy" gesture="hop" age={0} size={220} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {phase === "born" && (
          <motion.div className="stack center-text" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring.soft, delay: 0.4 }}>
            <h1>{t("onboarding.hatch.born", { name })}</h1>
            <p className="muted">{hatchLine(tone, name)}</p>
            <Button onClick={onDone}>{t("onboarding.hatch.go")}</Button>
          </motion.div>
        )}
      </AnimatePresence>
      {phase !== "born" && <p className="muted center-text">{t("onboarding.hatch.waiting")}</p>}
    </div>
  );
}
