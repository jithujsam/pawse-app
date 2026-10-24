import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { fmtDay, today } from "../dates";
import { haptic } from "../haptics";
import { spring } from "../motion";
import { actions, useData } from "../store";
import { Button } from "../ui/Controls";
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

  function save() {
    actions.setJournal(t0, mood, body.trim());
    haptic.success();
    setOpen(false);
    toast("Saved. Thanks for checking in with yourself.", { kind: "good" });
  }

  return (
    <section className="card stack reflect" aria-label="Reflect">
      <div className="row"><h2>Reflect</h2>{existing && !open && <span className="muted small">Done today</span>}</div>
      <p className="muted small">How was today, honestly?</p>
      <div className="moods" role="radiogroup" aria-label="Today's mood">
        {MOODS.map((m) => (
          <motion.button key={m.n} role="radio" aria-checked={mood === m.n} aria-label={m.l} className="mood" data-on={mood === m.n}
            whileTap={{ scale: 0.85 }} animate={{ scale: mood === m.n ? 1.12 : 1 }} transition={spring.bouncy}
            onClick={() => { haptic.select(); setMood(m.n); setOpen(true); }}>
            <span aria-hidden>{m.e}</span><span className="small">{m.l}</span>
          </motion.button>
        ))}
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div className="stack tight" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={spring.soft}>
            <label className="field"><span className="field-label">{prompt}</span>
              <textarea className="input" value={body} maxLength={600} rows={3} placeholder="A sentence is plenty. Stays private." onChange={(e) => setBody(e.target.value)} />
            </label>
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
    </section>
  );
}
