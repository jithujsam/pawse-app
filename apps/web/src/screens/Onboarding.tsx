import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { HabitClass } from "@detox/engine";
import { CompanionArt, LiveCompanion } from "../Companion";
import { CRISIS_MESSAGE, DISCLAIMER, hatchLine, TONES, tonePreview, RESTRICTION_NOTE } from "../copy";
import { hasCrisisLanguage } from "../crisis";
import { haptic } from "../haptics";
import { requestReminders } from "../notify";
import { rise, slide, spring, stagger } from "../motion";
import { AMOUNT_CHOICES, HABIT_CHOICES, inferClass, isRestrictionRelated, measureForLabel, NO_AMOUNT } from "../questions";
import { actions, emptyPlan, useData } from "../store";
import { HelpSection, planHasCrisis, WhySection } from "./Plan";
import { SITUATIONS } from "../recovery";
import { PetStep } from "./Pets";
import { TimePicker } from "../ui/TimePicker";
import { fmtTime } from "../dates";
import { COATS, NAMES } from "../pets";
import { has3D } from "../pet3d-support";
import { Burst, Button, Icon, MultiSelect, plainOpts, Select, SelectOther, Switch } from "../ui/Controls";
import type { Baseline, Measure, Personality, RecoveryPlan, Species, Tone } from "../types";

const BASELINES: { value: Baseline | "unsure"; label: string }[] = [
  { value: "many_daily", label: "Several times a day" }, { value: "daily", label: "About once a day" },
  { value: "few_weekly", label: "A few times a week" }, { value: "weekly", label: "Once a week or less" },
  { value: "unsure", label: "I'm not sure" },
];

const REMINDERS = [{ t: "09:00", label: "Morning" }, { t: "13:00", label: "Midday" }, { t: "20:00", label: "Evening" }, { t: "22:00", label: "Late" }];
const CUSTOM_TIME = "custom";
const STORY = [
  { title: "Meet a friend who's rooting for you", body: "A little pet lives here. Good days keep them healthy and happy, and they notice every one." },
  { title: "Every slip has a way back", body: "You'll see what a slip cost, and exactly how many good days win it back. Nothing is hopeless." },
  { title: "Private, kind, yours", body: "Your progress is yours alone. No lectures, no judgement, just a pet that's glad you're here." },
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
  const { settings } = useData();
  const dir = useRef(1);
  const [adult, setAdult] = useState(false);
  const [ownTime, setOwnTime] = useState(() => !REMINDERS.some((r) => r.t === loadDraft().reminder));
  const up = (p: Partial<Draft>) => setD((s) => ({ ...s, ...p }));
  useEffect(() => { try { sessionStorage.setItem(DRAFT, JSON.stringify(d)); } catch { /* ignore */ } }, [d]);
  useEffect(() => { document.documentElement.dataset.pet = d.species; }, [d.species]);

  const go = (n: number) => { dir.current = n > d.step ? 1 : -1; haptic.select(); up({ step: n }); };
  const name = d.companionName.trim() || NAMES[d.species][0];
  const crisis = hasCrisisLanguage(d.what);
  const restriction = isRestrictionRelated(d.what);
  const setPlan = (p: Partial<RecoveryPlan>) => setD((s) => ({ ...s, plan: { ...s.plan, ...p } }));
  const planCrisis = planHasCrisis(d.plan);

  const pickWhat = (text: string) => up({ what: text, cls: inferClass(text) });
  const finish = () => {
    try { sessionStorage.removeItem(DRAFT); } catch { /* ignore */ }
    actions.finishOnboarding({ species: d.species, coat: d.coat || COATS[d.species][0].id, personality: d.personality, companionName: name, userName: d.userName, intake: { what: d.what, measure: measureForLabel(d.amountLabel), amountLabel: d.amountLabel, triggers: [], cls: d.cls }, tone: d.tone, reminder: d.reminder, baseline: d.baseline, plan: planHasCrisis(d.plan) ? null : d.plan });
  };

  const showChrome = d.step > 0 && d.step < LAST;
  const canGoBack = d.step > 1 && d.step < LAST;
  return (
    <div className="screen onboard">
      <div className="ob-top" data-hidden={!showChrome}>
        <button className="icon-btn" aria-label="Back" onClick={() => go(d.step - 1)} disabled={!canGoBack}>{Icon.back}</button>
        <div className="progress" aria-hidden><motion.i animate={{ width: `${(d.step / (LAST - 1)) * 100}%` }} transition={spring.calm} /></div>
        <span className="small muted">{Math.min(d.step, LAST - 1)}/{LAST - 1}</span>
      </div>

      <AnimatePresence mode="wait" custom={dir.current} initial={false}>
        <motion.div key={d.step} className="step" custom={dir.current} variants={slide} initial="enter" animate="center" exit="exit">
          <motion.div className="step-inner" variants={stagger} initial="hidden" animate="show">

            {d.step === 1 && (<>
              <motion.h1 variants={rise}>Choose your companion</motion.h1>
              <motion.p className="muted" variants={rise}>Pick who they are and give them a name. They'll live on your home screen and change with you.</motion.p>
              <motion.div variants={rise}><PetStep pet={{ species: d.species, coat: d.coat, personality: d.personality, name: d.companionName }}
                onChange={(p) => up({ ...(p.species ? { species: p.species } : {}), ...(p.coat !== undefined ? { coat: p.coat } : {}), ...(p.personality ? { personality: p.personality } : {}), ...(p.name !== undefined ? { companionName: p.name } : {}) })} /></motion.div>
              {has3D(d.species) && <motion.div className="field" variants={rise}>
                <span className="field-label">Style</span>
                <Select label="Pet style" value={settings.pet3d} onChange={(v) => actions.setSettings({ pet3d: v })} options={[{ value: false, label: "Drawn" }, { value: true, label: "3D" }]} />
              </motion.div>}
              <motion.label className="field" variants={rise}><span className="field-label">What should {d.companionName.trim() || "they"} call you? <span className="muted">Optional</span></span>
                <input className="input" autoComplete="given-name" value={d.userName} placeholder="Your first name" maxLength={30} onChange={(e) => up({ userName: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") go(2); }} />
              </motion.label>
              <motion.div variants={rise}><Button disabled={hasCrisisLanguage(d.companionName)} onClick={() => go(2)}>Continue</Button></motion.div>
            </>)}

            {d.step === 2 && (<>
              <motion.h1 variants={rise}>What would you like to change?</motion.h1>
              <motion.p className="muted" variants={rise}>Say it in your own words. This stays between you and {name}.</motion.p>
              <motion.div className="field" variants={rise}><span className="field-label">Pick the closest, or write your own</span>
                <SelectOther label="What you'd like to change" options={plainOpts(HABIT_CHOICES)} value={d.what} onChange={pickWhat} placeholder="Choose one" otherPlaceholder="In your own words" />
              </motion.div>
              <AnimatePresence>
                {crisis && <motion.div className="banner danger" role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>{CRISIS_MESSAGE}</motion.div>}
                {restriction && <motion.div className="banner" role="note" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>{RESTRICTION_NOTE}</motion.div>}
              </AnimatePresence>
              <motion.div variants={rise}><Button disabled={!d.what.trim() || crisis || restriction} onClick={() => go(3)}>Continue</Button></motion.div>
            </>)}

            {d.step === 3 && (<>
              <motion.h1 variants={rise}>Anything you'd like to count?</motion.h1>
              <motion.p className="muted" variants={rise}>If there's a number you want to note each time, name it yourself. Leave it empty to just record that it happened.</motion.p>
              <motion.div className="field" variants={rise}><span className="field-label">Count each time (optional)</span>
                <SelectOther label="What to count each time" value={d.amountLabel} onChange={(v) => up({ amountLabel: v === NO_AMOUNT ? "" : v })} maxLength={40}
                  options={[...plainOpts(AMOUNT_CHOICES.map((a) => a.label)), { value: NO_AMOUNT, label: "Nothing, just note that it happened" }]}
                  placeholder="Nothing, just note that it happened" otherPlaceholder="Name it, e.g. cups or episodes" />
              </motion.div>
              <motion.div className="field" variants={rise}><span className="field-label">And how often, right now?</span>
                <Select label="How often right now" value={d.baseline ?? undefined} placeholder="Choose one" options={BASELINES} onChange={(b) => up({ baseline: b === "unsure" ? null : b })} />
              </motion.div>
              <motion.p className="muted small" variants={rise}>No judgement. It helps your report show how far you've come.</motion.p>
              <motion.div variants={rise}><Button onClick={() => go(4)}>Continue</Button></motion.div>
            </>)}

            {d.step === 4 && (<>
              <motion.h1 variants={rise}>What tends to set it off?</motion.h1>
              <motion.p className="muted" variants={rise}>Pick any that fit, or add your own. Pawse offers these back when an urge hits. All optional.</motion.p>
              <motion.div className="field" variants={rise}><span className="field-label">Situations</span>
                <MultiSelect label="Situations" options={plainOpts(SITUATIONS)} value={d.triggers} onChange={(triggers) => up({ triggers })} max={8} placeholder="Pick the ones that fit" />
              </motion.div>
              <motion.div variants={rise}><Button onClick={() => { setPlan({ situations: [...new Set([...d.plan.situations, ...d.triggers.map((x) => x.trim()).filter(Boolean)])].slice(0, 12) }); up({ triggers: [] }); go(5); }}>{d.triggers.some((x) => x.trim()) ? "Continue" : "Skip for now"}</Button></motion.div>
            </>)}

            {d.step === 5 && (<>
              <motion.h1 variants={rise}>Why it matters</motion.h1>
              <motion.p className="muted" variants={rise}>Your goal and your reasons, in your words. Pawse shows them back to you when things get hard. All optional.</motion.p>
              <motion.div className="stack" variants={rise}><WhySection plan={d.plan} set={setPlan} situations={false} /></motion.div>
              {planCrisis && <div className="banner danger" role="alert">{CRISIS_MESSAGE}</div>}
              <motion.div className="stack tight" variants={rise}>
                <Button disabled={planCrisis} onClick={() => go(6)}>Continue</Button>
                <Button variant="text" onClick={() => go(7)}>Skip the plan for now</Button>
              </motion.div>
            </>)}

            {d.step === 6 && (<>
              <motion.h1 variants={rise}>A first step, and what helps</motion.h1>
              <motion.p className="muted" variants={rise}>Something small and realistic is enough. You can change all of this later from your pet's screen or in You → Your plan.</motion.p>
              <motion.div className="stack" variants={rise}><HelpSection plan={d.plan} set={setPlan} cls={d.cls} /></motion.div>
              {planCrisis && <div className="banner danger" role="alert">{CRISIS_MESSAGE}</div>}
              <motion.div className="stack tight" variants={rise}>
                <Button disabled={planCrisis} onClick={() => go(7)}>Continue</Button>
                <Button variant="text" onClick={() => go(7)}>Skip for now</Button>
              </motion.div>
            </>)}

            {d.step === 7 && (<>
              <motion.h1 variants={rise}>How should {name} talk to you?</motion.h1>
              <motion.div className="preview" variants={rise}>
                <CompanionArt species={d.species} coat={d.coat} stage="young" mood={d.tone === "brutal" ? "idle" : "happy"} age={14} size={110} />
                <AnimatePresence mode="wait">
                  <motion.p key={d.tone} className="speech" initial={{ opacity: 0, scale: 0.92, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} transition={spring.bouncy}>
                    {tonePreview(d.tone, name)}
                  </motion.p>
                </AnimatePresence>
              </motion.div>
              <motion.div className="field" variants={rise}>
                <span className="field-label">Voice</span>
                <Select label="Tone" value={d.tone} options={TONES.map((t) => ({ value: t.id, label: t.label }))} onChange={(tone) => up({ tone })} />
              </motion.div>
              <motion.p className="muted small" variants={rise}>Every tone is respectful. It describes what happened, never who you are. Change it any time.</motion.p>
              <motion.div variants={rise}><Button onClick={() => go(8)}>Continue</Button></motion.div>
            </>)}

            {d.step === 8 && (<>
              <motion.div className="bell" variants={rise} animate={{ rotate: [0, -14, 12, -8, 6, 0] }} transition={{ duration: 1, delay: 0.4 }}>{Icon.bell}</motion.div>
              <motion.h1 variants={rise}>A daily nudge</motion.h1>
              <motion.p className="muted" variants={rise}>One quiet reminder a day to check in, in {name}'s voice. You can turn any reminder off later.</motion.p>
              <motion.div className="field" variants={rise}><span className="field-label">When suits you?</span>
                <Select label="Reminder time" value={ownTime ? CUSTOM_TIME : d.reminder}
                  options={[...REMINDERS.map((r) => ({ value: r.t, label: `${r.label} · ${fmtTime(r.t)}` })), { value: CUSTOM_TIME, label: "Another time…" }]}
                  onChange={(t) => { if (t === CUSTOM_TIME) setOwnTime(true); else { setOwnTime(false); up({ reminder: t }); } }} />
                {ownTime && <TimePicker label="Reminder time" value={d.reminder} onChange={(v) => up({ reminder: v })} />}
              </motion.div>
              <motion.div className="stack tight" variants={rise}>
                <Button onClick={async () => { await requestReminders(d.reminder, d.tone, name); go(9); }}>Turn on reminders</Button>
                <Button variant="text" onClick={() => go(9)}>Not now</Button>
              </motion.div>
            </>)}

            {d.step === 9 && (<>
              <motion.h1 variants={rise}>One last thing</motion.h1>
              <motion.div className="card stack" variants={rise}>
                <p>{DISCLAIMER}</p>
                <p className="muted small">Age and body effects are illustrative estimates. They are not a health prediction.</p>
              </motion.div>
              <motion.div variants={rise}><Switch checked={adult} onChange={setAdult} label="I'm 18 or older" hint="And I understand this is not medical advice." /></motion.div>
              <motion.div variants={rise}><Button disabled={!adult} onClick={() => go(10)}>Meet {name}</Button></motion.div>
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
      <Button onClick={next}>{i < STORY.length - 1 ? "Next" : "Get started"}</Button>
      {i < STORY.length - 1 && <Button variant="text" onClick={onStart}>Skip</Button>}
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
            <h1>Say hi to {name}</h1>
            <p className="muted">{hatchLine(tone, name)}</p>
            <Button onClick={onDone}>Let's go</Button>
          </motion.div>
        )}
      </AnimatePresence>
      {phase !== "born" && <p className="muted center-text">Something is happening…</p>}
    </div>
  );
}
