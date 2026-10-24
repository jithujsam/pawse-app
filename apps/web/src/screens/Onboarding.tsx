import { useState } from "react";
import type { HabitClass } from "@detox/engine";
import { CompanionArt } from "../Companion";
import { DISCLAIMER, TONES } from "../copy";
import { hasCrisisLanguage } from "../crisis";
import { CRISIS_MESSAGE } from "../copy";
import { inferClass, inferMeasure, isRestrictionRelated, SUGGESTIONS, TRIGGERS } from "../questions";
import { actions } from "../store";
import { Account } from "./Account";
import { configured } from "../supabase";
import type { Measure, Species, Tint, Tone } from "../types";

const SPECIES: { id: Species; label: string }[] = [{ id: "dog", label: "Dog" }, { id: "cat", label: "Cat" }, { id: "rabbit", label: "Rabbit" }];
const TINTS: { id: Tint; label: string; color: string }[] = [
  { id: "ocean", label: "Ocean", color: "#7fb1e6" }, { id: "meadow", label: "Meadow", color: "#86d1a4" },
  { id: "blossom", label: "Blossom", color: "#f0a0c0" }, { id: "sunrise", label: "Sunrise", color: "#f1cb6c" },
];
const MEASURES: { id: Measure; label: string; hint: string }[] = [
  { id: "money", label: "Money spent", hint: "How much each time" },
  { id: "count", label: "How many", hint: "A count each time" },
  { id: "minutes", label: "Time spent", hint: "Minutes each time" },
  { id: "none", label: "Just that it happened", hint: "No numbers" },
];

export function Onboarding() {
  const [step, setStep] = useState(0);
  const [species, setSpecies] = useState<Species>("dog");
  const [companionName, setCompanionName] = useState("");
  const [what, setWhat] = useState("");
  const [cls, setCls] = useState<HabitClass>("custom");
  const [measure, setMeasure] = useState<Measure>("none");
  const [measureTouched, setMeasureTouched] = useState(false);
  const [triggers, setTriggers] = useState<string[]>([]);
  const [tone, setTone] = useState<Tone>("honest");
  const [tint, setTint] = useState<Tint>("ocean");
  const [reminder, setReminder] = useState("20:00");
  const [adult, setAdult] = useState(false);
  const steps = 6;
  const crisis = hasCrisisLanguage(what);
  const restriction = isRestrictionRelated(what);

  const pickWhat = (text: string, c?: HabitClass, m?: Measure) => {
    setWhat(text);
    const k = c ?? inferClass(text);
    setCls(k);
    if (!measureTouched) setMeasure(m ?? inferMeasure(k));
  };
  const apply = (t: Tint) => { setTint(t); document.documentElement.dataset.tint = t; };
  const finish = () => actions.finishOnboarding({ species, companionName, intake: { what, measure, triggers, cls }, tone, reminder, tint });
  const go = (n: number) => setStep(n);

  return (
    <div className="screen onboard">
      <div className="row">
        <div className="dots" aria-hidden>{Array.from({ length: steps }, (_, i) => <i key={i} className={i <= step ? "on" : ""} />)}</div>
        <span className="small muted">{step + 1} of {steps}</span>
      </div>

      <div className="step" key={step}>
        {step === 0 && (<>
          <h1>Meet your companion</h1>
          <p className="muted">A small friend who reflects how things are going. Every slip you log tires them. Every good day helps them heal.</p>
          <div className="card" style={{ display: "grid", justifyItems: "center", position: "relative", overflow: "hidden" }}>
            <div className="breathe-ring" />
            <CompanionArt species={species} stage="baby" mood="happy" age={2} size={230} />
          </div>
          <div className="chips" role="group" aria-label="Species">
            {SPECIES.map((s) => <button key={s.id} className="chip" aria-pressed={species === s.id} onClick={() => setSpecies(s.id)}>{s.label}</button>)}
          </div>
          <label className="field">What will you call them?<input className="input" value={companionName} placeholder="Biscuit" maxLength={20} onChange={(e) => setCompanionName(e.target.value)} /></label>
          <button className="btn" onClick={() => go(1)}>Continue</button>
        </>)}

        {step === 1 && (<>
          <h1>What would you like to let go of?</h1>
          <p className="muted">Say it in your own words, or pick one. This stays between you and {companionName.trim() || "your companion"}.</p>
          <div className="chips">
            {SUGGESTIONS.map((s) => <button key={s.label} className="chip" aria-pressed={what === s.label} onClick={() => pickWhat(s.label, s.cls, s.measure)}>{s.label}</button>)}
          </div>
          <label className="field">In your own words<input className="input" value={what} maxLength={60} placeholder="For example: late-night snacking orders" onChange={(e) => pickWhat(e.target.value)} /></label>
          {crisis && <div className="banner danger" role="alert">{CRISIS_MESSAGE}</div>}
          {restriction && <div className="banner" role="note">This app can't track eating less, calories or weight, and it won't. If food and eating feel hard right now, a doctor or counselor can really help. You can pick something else to watch, like money spent on orders.</div>}
          <button className="btn" disabled={!what.trim() || crisis || restriction} onClick={() => go(2)}>Continue</button>
        </>)}

        {step === 2 && (<>
          <h1>What do you want to keep an eye on?</h1>
          <p className="muted">We'll use this for the quick check-in after a slip.</p>
          <div className="stack">
            {MEASURES.map((m) => <button key={m.id} className="choice" aria-pressed={measure === m.id} onClick={() => { setMeasure(m.id); setMeasureTouched(true); }}><b>{m.label}</b><div className="small muted">{m.hint}</div></button>)}
          </div>
          <button className="btn" onClick={() => go(3)}>Continue</button>
        </>)}

        {step === 3 && (<>
          <h1>What tends to set it off?</h1>
          <p className="muted">Pick any that fit. We'll ask about them briefly, so patterns show up in your report.</p>
          <div className="chips" role="group" aria-label="Triggers">
            {TRIGGERS.map((t) => <button key={t.id} className="chip" aria-pressed={triggers.includes(t.id)} onClick={() => setTriggers((s) => s.includes(t.id) ? s.filter((x) => x !== t.id) : [...s, t.id])}>{t.chip}</button>)}
          </div>
          <button className="btn" onClick={() => go(4)}>{triggers.length ? "Continue" : "Skip for now"}</button>
        </>)}

        {step === 4 && (<>
          <h1>Make it feel right</h1>
          <div className="stack">
            <h2>Colours</h2>
            <div className="tintrow" role="group" aria-label="Colour">
              {TINTS.map((t) => <button key={t.id} className="swatch" aria-label={t.label} aria-pressed={tint === t.id} style={{ background: t.color }} onClick={() => apply(t.id)} />)}
            </div>
          </div>
          <div className="stack">
            <h2>How should it talk to you?</h2>
            {TONES.map((t) => <button key={t.id} className="choice" aria-pressed={tone === t.id} onClick={() => setTone(t.id)}><b>{t.label}</b><div className="small muted">“{t.sample}”</div></button>)}
          </div>
          <label className="field">Daily check-in reminder<input className="input" type="time" value={reminder} onChange={(e) => setReminder(e.target.value)} /></label>
          <button className="btn" onClick={() => go(5)}>Continue</button>
        </>)}

        {step === 5 && (<>
          <h1>Keep it safe</h1>
          <p>{DISCLAIMER}</p>
          <p className="muted small">Age and body effects are illustrative estimates. They are not a health prediction.</p>
          {configured && (<div className="card stack">
            <h2>Save your progress</h2>
            <p className="muted small">An account backs up your companion and switches on the written insights. You can skip this and add it later.</p>
            <Account compact onSignedIn={() => undefined} />
          </div>)}
          <label className="row" style={{ justifyContent: "flex-start", minHeight: 48 }}>
            <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} style={{ width: 22, height: 22 }} />
            <span>I am 18 or older and I understand this is not medical advice.</span>
          </label>
          <button className="btn" disabled={!adult} onClick={finish}>Start</button>
        </>)}
      </div>

      {step > 0 && <button className="btn text" onClick={() => go(step - 1)}>Back</button>}
    </div>
  );
}
