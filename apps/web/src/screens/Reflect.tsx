import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { fmtDay, today } from "../dates";
import { haptic } from "../haptics";
import { spring } from "../motion";
import { actions, useData } from "../store";
import { CRISIS_MESSAGE } from "../copy";
import { hasCrisisLanguage } from "../crisis";
import { Button, Select } from "../ui/Controls";
import { toast } from "../ui/Toast";

/**
 * A one-minute reflection. Short expressive writing and naming feelings lower the pull of a craving,
 * and an if-then plan ("if I'm bored at 10pm, then I'll…") roughly doubles follow-through in studies
 * of implementation intentions. One entry per day; mood is required, words are optional.
 */
const MOODS = [{ n: 1, e: "😞", l: "Rough" }, { n: 2, e: "😕", l: "Low" }, { n: 3, e: "😐", l: "Okay" }, { n: 4, e: "🙂", l: "Good" }, { n: 5, e: "😄", l: "Great" }];
const PROMPTS = [
  "What made today easier or harder?",
  "When the urge comes next, what will you do instead? \"If ___, then I'll ___.\"",
  "One thing you're glad you did today.",
  "What were you feeling right before the last urge?",
  "What would you tell a friend in your place today?",
  "What's one small thing that would make tomorrow go well?",
];

export function Reflect() {
  const data = useData();
  const t0 = today();
  const existing = data.journal.find((j) => j.day === t0);
  const [mood, setMood] = useState(existing?.mood ?? 0);
  const [body, setBody] = useState(existing?.body ?? "");
  const [open, setOpen] = useState(false);
  const prompt = PROMPTS[new Date().getDate() % PROMPTS.length];
  const recent = [...data.journal].filter((j) => j.day !== t0).slice(-4).reverse();

  const [crisis, setCrisis] = useState(false);
  function save() {
    // Same care as the slip sheet: distress comes first, and nothing is saved.
    if (hasCrisisLanguage(body)) { setCrisis(true); return; }
    setCrisis(false);
    actions.setJournal(t0, mood, body.trim());
    haptic.success();
    setOpen(false);
    toast("Saved. Thanks for checking in with yourself.", { kind: "good" });
  }

  return (
    <div className="stack reflect">
      <div className="row"><p className="muted small">How was today, honestly?</p>{existing && !open && <span className="muted small">Done today</span>}</div>
      <Select label="Today's mood" value={mood || undefined} placeholder="Choose how you feel"
        options={MOODS.map((m) => ({ value: m.n, label: `${m.e}  ${m.l}` }))}
        onChange={(n) => { setMood(n); setOpen(true); }} />
      <AnimatePresence initial={false}>
        {open && (
          <motion.div className="stack tight" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={spring.soft}>
            <label className="field"><span className="field-label">{prompt}</span>
              <textarea className="input" value={body} maxLength={600} rows={3} placeholder="A sentence is plenty. Stays private." onChange={(e) => setBody(e.target.value)} />
            </label>
            {crisis && <p className="banner danger" role="alert">{CRISIS_MESSAGE}</p>}
            <Button disabled={!mood} onClick={save}>Save reflection</Button>
          </motion.div>
        )}
      </AnimatePresence>
      {recent.length > 0 && !open && (
        <div className="list">
          {recent.map((j) => (
            <div className="item" key={j.day}>
              <div className="row"><b>{fmtDay(j.day)}</b><span aria-label={MOODS[j.mood - 1]?.l}>{MOODS[j.mood - 1]?.e}</span></div>
              {j.body && <span className="small">{j.body}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
