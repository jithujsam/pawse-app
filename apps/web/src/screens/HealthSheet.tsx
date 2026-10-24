import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { conditions, healthReport, history, stats, type Level } from "../health";
import { fmtDay } from "../dates";
import { quietBanner } from "../copy";
import { rise, spring, stagger } from "../motion";
import { useActiveView, useData } from "../store";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import { Sheet } from "../ui/Sheet";

export type HealthTab = "health" | "history" | "conditions" | "stats";
const TABS: { id: HealthTab; label: string }[] = [
  { id: "health", label: "Health" }, { id: "history", label: "History" }, { id: "conditions", label: "Conditions" }, { id: "stats", label: "You & pet" },
];
export const LEVEL_COLOR: Record<Level, string> = { thriving: "var(--positive)", healthy: "var(--positive)", okay: "#d9a531", unwell: "var(--negative)", critical: "var(--negative)" };

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
  return <Sheet open={open} onClose={onClose} label="Health">{open && <Body initial={tab} />}</Sheet>;
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
      <div className="segmented health-tabs" role="tablist" aria-label="Health sections">
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
              <div className="stat item"><span className="muted small">Life expectancy</span><b className="v">{st.lifeExpectancy}</b></div>
              <div className="stat item"><span className="muted small">Check-ins</span><b className="v">{st.checkInRate}<small>%</small></b></div>
            </div>
            {conds.length > 0
              ? <button className="link-card item" onClick={() => setTab("conditions")}><span className="row"><b>{conds.length} {conds.length === 1 ? "thing" : "things"} affecting {name}</b><span className="muted small">See why →</span></span></button>
              : <p className="muted small">Nothing is troubling {name} right now. That's your doing.</p>}
            {r.silent >= 2 && <p className="banner">{quietBanner(data.settings.tone, name)}</p>}
          </>)}

          {tab === "history" && <History />}

          {tab === "conditions" && (conds.length === 0
            ? <div className="stack center-text"><Heart value={100} level="thriving" size={56} /><h2>All clear</h2><p className="muted">{name} has nothing to recover from. Keep it that way.</p></div>
            : <motion.div className="list" variants={stagger} initial="hidden" animate="show">
                {conds.map((c) => (
                  <motion.div key={c.id} className="item cond" data-tone={c.tone} variants={rise}>
                    <div className="row"><b>{c.name}</b><span className="cond-tag">{c.tone}</span></div>
                    <span className="small">{c.what}</span>
                    <span className="small muted"><b>Why:</b> {c.why}</span>
                    <span className="small cond-fix"><b>Recovery:</b> {c.fix}</span>
                  </motion.div>
                ))}
                <p className="muted small">Pet conditions are illustrative. They reflect your logs, not anyone's real health.</p>
              </motion.div>)}

          {tab === "stats" && (
            <div className="stats stats-3">
              {([["Days together", st.together], ["Clean days", st.cleanDays], ["Best streak", st.best], ["Slips logged", st.slips], ["Life lost", `${st.lost} mo`], ["Life healed", `${st.healed} mo`],
                ["Urges ridden out", st.urges], ["Reflections", st.reflections], ["Check-in rate", `${st.checkInRate}%`]] as [string, string | number][]).map(([k, v]) => (
                <div className="stat item" key={k}><span className="muted small">{k}</span><b className="v sm">{v}</b></div>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function History() {
  const data = useData();
  const view = useActiveView()!;
  const items = history(data, view).slice(0, 80);
  const W = 320, H = 64, s = view.states;
  const top = Math.max(5, ...s.map((x) => x.visibleAge)) * 1.25;
  const pts = s.map((x, i) => `${(i / Math.max(1, s.length - 1)) * W},${H - (x.visibleAge / top) * (H - 6) - 3}`).join(" ");
  return (
    <div className="stack">
      {s.length > 1 && (
        <div className="stack tight">
          <span className="muted small">Age over {view.companion.name}'s life, now {Math.round(view.age)} (lower is healthier)</span>
          <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Age over time"><polyline points={pts} fill="none" stroke="var(--chart)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" /></svg>
        </div>
      )}
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
