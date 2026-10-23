import { projectDaysToAge } from "@detox/engine";
import { ACCENT } from "../Companion";
import { verdict } from "../copy";
import { addDays, fmtDay, parse, today, weekStart } from "../dates";
import { activeCompanion, useData, viewCompanion, weekStats } from "../store";

const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function Report() {
  const data = useData();
  const companion = activeCompanion(data)!;
  const view = viewCompanion(data, companion.id);
  const habit = view.habit!;
  const { tone, currency } = data.settings;
  const ws = weekStart(today());
  const cur = weekStats(data, habit.id, ws);
  const prev = weekStats(data, habit.id, addDays(ws, -7));
  const weeks = Array.from({ length: 8 }, (_, i) => weekStats(data, habit.id, addDays(ws, -7 * (7 - i))).slips);
  const maxW = Math.max(1, ...weeks);
  const all = data.entries.filter((e) => e.habitId === habit.id);
  const byDow = DOW.map((_, i) => all.filter((e) => parse(e.day).getDay() === i).length);
  const worst = byDow.indexOf(Math.max(...byDow));
  const biggest = all.reduce<typeof all[number] | null>((b, e) => (!b || e.months > b.months ? e : b), null);
  const places = new Map<string, number>();
  for (const e of all) for (const f of habit.fields) if (f.type === "text" && /where|app/i.test(f.label)) {
    const v = String(e.values[f.id] ?? "").trim().toLowerCase(); if (v) places.set(v, (places.get(v) ?? 0) + 1);
  }
  const topPlace = [...places.entries()].sort((a, b) => b[1] - a[1])[0];
  const frailIn = view.age >= 80 ? 0 : projectDaysToAge(view.states, 80);
  const money = habit.unit === "money";
  const fmt = (n: number) => Math.round(n * 10) / 10;

  const W = 320, H = 130, bw = 26, gap = (W - bw * 8) / 7;

  return (
    <main className="screen" style={{ ["--pet" as string]: ACCENT[companion.species] }}>
      <h1>Weekly report</h1>
      <section className="card stack">
        <h2>This week and last</h2>
        <p>{verdict(tone, cur.slips, prev.slips)}</p>
        <div className="stats">
          <div className="stat"><div className="muted small">Slips</div><div className="v">{cur.slips}</div><div className="muted small">last week {prev.slips}</div></div>
          <div className="stat"><div className="muted small">Life lost</div><div className="v">{fmt(cur.months)} mo</div><div className="muted small">last week {fmt(prev.months)}</div></div>
          {money && <div className="stat" style={{ gridColumn: "1 / -1" }}><div className="muted small">Spent</div><div className="v">{currency} {Math.round(cur.spend).toLocaleString()}</div><div className="muted small">last week {currency} {Math.round(prev.spend).toLocaleString()}</div></div>}
        </div>
      </section>

      <section className="card stack">
        <h2>Slips per week, last 8 weeks</h2>
        <svg className="chart" viewBox={`0 0 ${W} ${H + 20}`} role="img" aria-label={`Slips per week: ${weeks.join(", ")}`}>
          {[0, 0.5, 1].map((t) => <line key={t} x1="0" x2={W} y1={H - t * (H - 12)} y2={H - t * (H - 12)} stroke="var(--raised)" strokeDasharray="3 4" />)}
          {weeks.map((v, i) => {
            const h = (v / maxW) * (H - 12);
            return <g key={i}><rect x={i * (bw + gap)} y={H - h} width={bw} height={Math.max(h, 0)} rx="4" fill={i === 7 ? "var(--chart)" : "var(--control)"} />
              <text x={i * (bw + gap) + bw / 2} y={H + 14} textAnchor="middle">{i === 7 ? "now" : `-${7 - i}`}</text>
              {v > 0 && <text x={i * (bw + gap) + bw / 2} y={H - h - 4} textAnchor="middle">{v}</text>}</g>;
          })}
        </svg>
      </section>

      <section className="card stack">
        <h2>Patterns</h2>
        {all.length < 3 ? <p className="muted">Patterns show up after a few logged slips.</p> : (
          <div className="list">
            <div className="item"><span className="muted small">Worst weekday</span><b>{DOW[worst]}</b><span className="small">{byDow[worst]} of {all.length} slips</span></div>
            {topPlace && <div className="item"><span className="muted small">Most repeated</span><b style={{ textTransform: "capitalize" }}>{topPlace[0]}</b><span className="small">{topPlace[1]} times</span></div>}
            {biggest && <div className="item"><span className="muted small">Biggest single slip</span><b>{fmt(biggest.months)} months</b><span className="small">{fmtDay(biggest.day)}{biggest.amount !== null && money ? `, ${currency} ${biggest.amount}` : ""}</span></div>}
          </div>
        )}
      </section>

      <section className="card stack">
        <h2>If nothing changes</h2>
        <p>{view.age >= 80 ? `${companion.name} is already frail.` : frailIn === null ? `At the current pace ${companion.name} is not getting older.` : `At this pace, ${companion.name} reaches the frail stage in about ${Math.max(1, Math.round(frailIn / 7))} ${Math.round(frailIn / 7) <= 1 ? "week" : "weeks"}.`}</p>
        <p className="muted small">An estimate from the last two weeks. Age is illustrative, not a health prediction.</p>
      </section>
    </main>
  );
}
