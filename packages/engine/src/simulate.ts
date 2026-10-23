import { baselineMonths, simulate, type DayInput } from "./index";

function addDays(start: Date, n: number): string {
  const d = new Date(start); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function pattern(days: number, slipsPerDay: (i: number) => number, severity: number): DayInput[] {
  const start = new Date("2026-01-01T00:00:00Z");
  return Array.from({ length: days }, (_, i) => {
    const n = slipsPerDay(i);
    return {
      day: addDays(start, i),
      damage: Array.from({ length: n }, (_, k) => baselineMonths(severity, k + 1)),
      clean: n === 0,
    };
  });
}

export const PATTERNS = {
  light: { desc: "2 slips/week, severity 1.0", build: (d: number) => pattern(d, (i) => (i % 7 === 2 || i % 7 === 5 ? 1 : 0), 1.0) },
  medium: { desc: "1 slip/day, severity 1.0", build: (d: number) => pattern(d, () => 1, 1.0) },
  heavy: { desc: "3 slips/day, severity 1.5", build: (d: number) => pattern(d, () => 3, 1.5) },
};

if (process.argv[1]?.endsWith("simulate.ts")) {
  for (const [name, p] of Object.entries(PATTERNS)) {
    const s = simulate(p.build(90));
    const row = [0, 6, 13, 27, 41, 55, 89].map((i) => `d${i + 1}:${s[i].visibleAge.toFixed(1)}`);
    console.log(`${name.padEnd(7)} ${p.desc.padEnd(30)} ${row.join("  ")}`);
  }
}
