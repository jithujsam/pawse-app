import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { conditions, healthReport, history, stats, type Condition, type Level } from "../health";
import { fmtDay } from "../dates";
import { quietBanner } from "../copy";
import { rise, spring, stagger } from "../motion";
import { useActiveView, useData } from "../store";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import { Sheet } from "../ui/Sheet";
import { t } from "../text";

const COND_TONE_LABEL: Record<Condition["tone"], string> = { mild: t("sheets.health.cond_mild"), moderate: t("sheets.health.cond_moderate"), serious: t("sheets.health.cond_serious") };

export type HealthTab = "health" | "history" | "conditions";
const TABS: { id: HealthTab; label: string }[] = [
  { id: "health", label: t("sheets.health.tab_health") }, { id: "history", label: t("sheets.health.tab_history") }, { id: "conditions", label: t("sheets.health.tab_conditions") },
];
export const LEVEL_COLOR: Record<Level, string> = { thriving: "var(--positive)", healthy: "var(--positive)", okay: "var(--warning)", unwell: "var(--negative)", critical: "var(--negative)" };

/** A heart that fills to the pet's health. */
export function Heart({ value, level, size = 22 }: { value: number; level: Level; size?: number }) {
  const id = `h${level}${size}`;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden className="heart">
      <defs><clipPath id={id}><rect x="0" y={24 - (24 * value) / 100} width="24" height="24" /></clipPath></defs>
      <path d="M12 21s-7.5-4.6-9.3-9.6C1.4 7.6 4 4 7.5 4c2 0 3.5 1.1 4.5 2.6C13 5.1 14.5 4 16.5 4 20 4 22.6 7.6 21.3 11.4 19.5 16.4 12 21 12 21z" fill="var(--raised)" stroke={LEVEL_COLOR[level]} strokeWidth="1.6" />
      <path d="M12 21s-7.5-4.6-9.3-9.6C1.4 7.6 4 4 7.5 4c2 0 3.5 1.1 4.5 2.6C13 5.1 14.5 4 16.5 4 20 4 22.6 7.6 21.3 11.4 19.5 16.4 12 21 12 21z" fill={LEVEL_COLOR[level]} clipPath={`url(#${id})`} />
    </svg>
  );
}

export function HealthSheet({ open, tab, onClose }: { open: boolean; tab: HealthTab; onClose: () => void }) {
  return <Sheet open={open} onClose={onClose} label={t("sheets.health.label")}>{open && <Body initial={tab} />}</Sheet>;
}

function Body({ initial }: { initial: HealthTab }) {
  const data = useData();
  const view = useActiveView()!;
  const [tab, setTab] = useState<HealthTab>(initial);
  useEffect(() => setTab(initial), [initial]);
  const r = healthReport(data, view, data.settings.tone);
  const conds = conditions(data, view);
  const st = stats(data, view);
  const name = view.companion.name;

  return (
    <div className="stack health">
      <div className="segmented health-tabs" role="tablist" aria-label={t("sheets.health.tabs_aria")}>
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className="seg" onClick={() => setTab(t.id)}>
            {tab === t.id && <motion.span layoutId="health-pill" className="seg-pill" transition={spring.snappy} />}
            <span className="seg-label">{t.label}</span>
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab} className="stack" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }} transition={spring.soft}>
          {tab === "health" && (<>
            <div className="health-hero" data-level={r.level}>
              <motion.div initial={{ scale: 0.6 }} animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 1.2, repeat: r.level === "critical" ? Infinity : 0 }}><Heart value={r.heart} level={r.level} size={72} /></motion.div>
              <div><b className="health-num"><AnimatedNumber value={r.heart} from={0} /><small>/100</small></b><h2>{r.title}</h2></div>
            </div>
            <p>{r.body}</p>
            <div className="stats">
              <div className="stat item"><span className="muted small">{t("sheets.health.check_ins")}</span><b className="v">{st.checkInRate}<small>%</small></b></div>
            </div>
            {conds.length > 0
              ? <button className="link-card item" onClick={() => setTab("conditions")}><span className="row"><b>{conds.length === 1 ? t("sheets.health.things_one", { name }) : t("sheets.health.things_other", { n: conds.length, name })}</b><span className="muted small">{t("sheets.health.see_why")}</span></span></button>
              : <p className="muted small">{t("sheets.health.nothing", { name })}</p>}
            {r.silent >= 2 && <p className="banner">{quietBanner(data.settings.tone, name)}</p>}
          </>)}

          {tab === "history" && <History />}

          {tab === "conditions" && (conds.length === 0
            ? <div className="stack center-text"><Heart value={100} level="thriving" size={56} /><h2>{t("sheets.health.all_clear")}</h2><p className="muted">{t("sheets.health.all_clear_body", { name })}</p></div>
            : <motion.div className="list" variants={stagger} initial="hidden" animate="show">
                {conds.map((c) => (
                  <motion.div key={c.id} className="item cond" data-tone={c.tone} variants={rise}>
                    <div className="row"><b>{c.name}</b><span className="cond-tag">{COND_TONE_LABEL[c.tone]}</span></div>
                    <span className="small">{c.what}</span>
                    <span className="small muted"><b>{t("sheets.health.why")}</b> {c.why}</span>
                    <span className="small cond-fix"><b>{t("sheets.health.recovery")}</b> {c.fix}</span>
                  </motion.div>
                ))}
                <p className="muted small">{t("safety.disclaimer.conditions")}</p>
              </motion.div>)}

        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function History() {
  const data = useData();
  const view = useActiveView()!;
  const items = history(data, view).slice(0, 80);
  return (
    <div className="stack">
      <span className="muted small">{t("sheets.health.history_intro", { name: view.companion.name })}</span>
      <ol className="timeline">
        {items.map((it, i) => (
          <li key={i} data-kind={it.kind}>
            <i aria-hidden />
            <div><span>{it.text}</span>{it.day && <span className="muted small">{fmtDay(it.day)}</span>}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}
