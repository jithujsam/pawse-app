import { daysFrom, mondayOf, shiftDays } from "./progress";

export const pad = (n: number) => String(n).padStart(2, "0");
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => iso(new Date());
export const parse = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
// Day arithmetic lives in progress.ts (UTC day numbers, so daylight saving can't shift a day). parse() is for display.
export const addDays = shiftDays;
export const daysBetween = daysFrom;
export const range = (from: string, to: string) => {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
};
/** Monday of the week containing s. */
export const weekStart = mondayOf;
export const fmtDay = (s: string) => parse(s).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
export const fmtMonth = (s: string) => parse(s).toLocaleDateString(undefined, { month: "long", year: "numeric" });

/** Whether the phone's region uses a 12-hour clock. */
export const uses12h = () => { const c = new Intl.DateTimeFormat(undefined, { hour: "numeric" }).resolvedOptions().hourCycle; return c === "h11" || c === "h12"; };
/** "20:05" -> "8:05 PM" or "20:05". Times are stored as 24-hour HH:MM and shown on the phone's own clock. */
export function fmtTime(hhmm: string | null | undefined): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  if (!uses12h()) return `${pad(h)}:${pad(m)}`;
  return `${h % 12 || 12}${m ? `:${pad(m)}` : ""} ${h < 12 ? "AM" : "PM"}`;
}
/** 22 -> "10 PM" or "22:00" */
export const fmtHour = (h: number) => (uses12h() ? `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}` : `${pad(h)}:00`);
