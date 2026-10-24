import { useState } from "react";
import type { HabitClass } from "@detox/engine";
import { CompanionArt } from "../Companion";
import { DISCLAIMER, TONES } from "../copy";
import { TEMPLATES } from "../templates";
import { actions } from "../store";
import type { Species, Tone } from "../types";

const SPECIES: { id: Species; label: string }[] = [{ id: "dog", label: "Dog" }, { id: "cat", label: "Cat" }, { id: "rabbit", label: "Rabbit" }];

export function Onboarding() {
  const [step, setStep] = useState(0);
  const [adult, setAdult] = useState(false);
  const [species, setSpecies] = useState<Species>("dog");
  const [companionName, setCompanionName] = useState("");
  const [cls, setCls] = useState<HabitClass>("food_spending");
  const [habitName, setHabitName] = useState("");
  const [tone, setTone] = useState<Tone>("honest");
  const [reminder, setReminder] = useState("20:00");
  const steps = 5;
  const next = () => setStep((s) => s + 1);

  const finish = () => actions.finishOnboarding({ species, companionName, habitName, cls, tone, reminder });

  return (
    <div className="screen onboard">
      <div className="row"><div className="dots" aria-hidden>{Array.from({ length: steps }, (_, i) => <i key={i} className={i <= step ? "on" : ""} />)}</div><span className="small muted">{step + 1} of {steps}</span></div>

      {step === 0 && (<>
        <h1>Meet your companion</h1>
        <p className="muted">Every slip you log ages them. Every clean day helps them heal. It makes the cost of a habit hard to ignore.</p>
        <div className="card" style={{ display: "grid", justifyItems: "center" }}><CompanionArt species={species} stage="baby" mood="happy" age={2} size={220} /></div>
        <div className="chips" role="group" aria-label="Species">
          {SPECIES.map((s) => <button key={s.id} className="chip" aria-pressed={species === s.id} onClick={() => setSpecies(s.id)}>{s.label}</button>)}
        </div>
        <label className="field">Name them<input className="input" value={companionName} placeholder="Biscuit" maxLength={20} onChange={(e) => setCompanionName(e.target.value)} /></label>
        <button className="btn" onClick={next}>Continue</button>
      </>)}

      {step === 1 && (<>
        <h1>What are you tracking?</h1>
        <p className="muted">One habit per companion. You can edit the questions later.</p>
        <div className="stack">
          {TEMPLATES.map((t) => <button key={t.cls} className="choice" aria-pressed={cls === t.cls} onClick={() => setCls(t.cls)}><b>{t.label}</b><div className="small muted">{t.fields.filter((f) => f.type !== "photo").length} questions</div></button>)}
        </div>
        <label className="field">Give it your own name (optional)<input className="input" value={habitName} placeholder={TEMPLATES.find((t) => t.cls === cls)!.label} maxLength={30} onChange={(e) => setHabitName(e.target.value)} /></label>
        {cls === "food_spending" && <p className="small muted">This tracks spending and extra eating only. It never tracks calories, weight or eating less.</p>}
        <button className="btn" onClick={next}>Continue</button>
      </>)}

      {step === 2 && (<>
        <h1>How should it talk to you?</h1>
        <p className="muted">All tones are respectful. They only describe what happened and what it cost. Change it any time.</p>
        <div className="stack">
          {TONES.map((t) => <button key={t.id} className="choice" aria-pressed={tone === t.id} onClick={() => setTone(t.id)}><b>{t.label}</b><div className="small muted">“{t.sample}”</div></button>)}
        </div>
        <button className="btn" onClick={next}>Continue</button>
      </>)}

      {step === 3 && (<>
        <h1>Daily check-in</h1>
        <p className="muted">Pick a time for a reminder. Reminders on this phone are coming in a later version; your choice is saved.</p>
        <label className="field">Reminder time<input className="input" type="time" value={reminder} onChange={(e) => setReminder(e.target.value)} /></label>
        <button className="btn" onClick={next}>Continue</button>
      </>)}

      {step === 4 && (<>
        <h1>Before you start</h1>
        <p>{DISCLAIMER}</p>
        <p className="muted small">Age and body effects are illustrative estimates. They are not a health prediction.</p>
        <label className="row" style={{ justifyContent: "flex-start", minHeight: 48 }}>
          <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} style={{ width: 22, height: 22 }} />
          <span>I am 18 or older and I understand this is not medical advice.</span>
        </label>
        <button className="btn" disabled={!adult} onClick={finish}>Start</button>
      </>)}

      {step > 0 && <button className="btn text" onClick={() => setStep(step - 1)}>Back</button>}
    </div>
  );
}
