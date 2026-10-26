import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { fmtDay, today } from "../dates";
import { haptic } from "../haptics";
import { spring } from "../motion";
import { actions, useData } from "../store";
import { Button, ConcernNote, Select } from "../ui/Controls";
import { concernIn } from "../guard";
import { t } from "../text";
import { toast } from "../ui/Toast";

/**
 * A one-minute reflection. Short expressive writing and naming feelings lower the pull of a craving,
 * and an if-then plan ("if I'm bored at 10pm, then I'll…") roughly doubles follow-through in studies
 * of implementation intentions. One entry per day; mood is required, words are optional.
 */
const MOODS = [{ n: 1, e: "😞", l: t("insights.reflect.mood_1") }, { n: 2, e: "😕", l: t("insights.reflect.mood_2") }, { n: 3, e: "😐", l: t("insights.reflect.mood_3") }, { n: 4, e: "🙂", l: t("insights.reflect.mood_4") }, { n: 5, e: "😄", l: t("insights.reflect.mood_5") }];
const PROMPTS = [
  t("insights.reflect.prompt_1"), t("insights.reflect.prompt_2"), t("insights.reflect.prompt_3"),
  t("insights.reflect.prompt_4"), t("insights.reflect.prompt_5"), t("insights.reflect.prompt_6"),
];

export function Reflect() {
  const data = useData();
  const t0 = today();
  const existing = data.journal.find((j) => j.day === t0);
  const [mood, setMood] = useState(existing?.mood ?? 0);
  const [body, setBody] = useState(existing?.body ?? "");
  const [open, setOpen] = useState(false);
  const prompt = PROMPTS[new Date().getDate() % PROMPTS.length];
  const recent = [...data.journal].filter((j) => j.day !== t0).slice(-1).reverse();

  // Same care as the slip sheet: distress comes first, and nothing is saved.
  const concern = concernIn(body, "crisis");
  function save() {
    if (concern) return;
    actions.setJournal(t0, mood, body.trim());
    haptic.success();
    setOpen(false);
    toast(t("insights.reflect.saved"), { kind: "good" });
  }

  return (
    <div className="stack tight reflect">
      <div className="row"><b>{t("insights.reflect.title")}</b>{existing && !open && <span className="muted small">{t("insights.reflect.done")}</span>}</div>
      <Select label={t("insights.reflect.mood_aria")} value={mood || undefined} placeholder={t("insights.reflect.mood_placeholder")}
        options={MOODS.map((m) => ({ value: m.n, label: `${m.e}  ${m.l}` }))}
        onChange={(n) => { setMood(n); setOpen(true); }} />
      <AnimatePresence initial={false}>
        {open && (
          <motion.div className="stack tight" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={spring.soft}>
            <input className="input" autoComplete="off" value={body} maxLength={600} aria-label={prompt} placeholder={t("insights.reflect.placeholder")} onChange={(e) => setBody(e.target.value)} />
            <ConcernNote concern={concern} />
            <Button disabled={!mood || concern !== null} onClick={save}>{t("ui.common.save")}</Button>
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
