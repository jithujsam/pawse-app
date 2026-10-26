import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { reminderLine } from "./copy";
import { actions } from "./store";
import { careNote } from "./voice";
import { t, tt } from "./text";
import type { Personality, Tone } from "./types";

const native = Capacitor.isNativePlatform();
/** Reminders are scheduled only by the phone app; the web build can't fire them on time. */
export const remindersSupported = native;

/**
 * Everything Pawse sends is planned here, in one place, as one-shot notifications for the next two weeks:
 * at most MAX_PER_DAY on any local calendar day. Each re-plan cancels the previous plan first and runs one at a
 * time, so retries and rescheduling can never stack extra notifications. When more than two want the same day,
 * the most useful win: the check-in reminder (or, after quiet days, the neutral quiet-day note that replaces
 * it), then a note about something that happened today, then the risky-hour heads-up, then the good-morning.
 */
export const MAX_PER_DAY = 2;
const HORIZON_DAYS = 14;
const FIRST_ID = 3000;
const MANAGED_IDS = Array.from({ length: 100 }, (_, i) => FIRST_ID + i);
/** Ids older versions used for repeating schedules (daily, care, risky hour, lapse). Cancelled so they can't add to the count. */
const LEGACY_IDS = [1001, 2001, 2002, 2003, 2004, 2010, 2011, 2012, 2013];

export type NoteKind = "daily" | "lapse" | "thanks" | "risk" | "morning";
const PRIORITY: Record<NoteKind, number> = { daily: 0, lapse: 0, thanks: 1, risk: 2, morning: 3 };

export interface PlanInput {
  now: Date;
  /** Reminders switched on (and allowed). Off means nothing at all is planned. */
  enabled: boolean;
  /** Daily check-in time, HH:MM. */
  reminder: string;
  tone: Tone;
  name: string;
  personality?: Personality;
  /** Today already has a slip or a clean mark: no reminder today. */
  checkedToday: boolean;
  /** Last day with a check-in (YYYY-MM-DD), for the quiet-day notes. */
  lastCheckIn: string | null;
  /** The usual slip hour, when the risky-hour heads-up is on and a pattern exists. */
  riskHour: number | null;
  /** Notes in the companion's voice after a good day or a slip. */
  careNotes: boolean;
  /** The last good-day or slip event, which care notes respond to. */
  care: { kind: "clean" | "slip"; at: number } | null;
}
export interface Planned { id: number; kind: NoteKind; at: Date; title: string; body: string; extra: { open: string } }

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const atTime = (base: Date, dayOffset: number, hour: number, minute: number) => { const d = new Date(base); d.setDate(d.getDate() + dayOffset); d.setHours(hour, minute, 0, 0); return d; };

/** If check-ins stop: two neutral notes, never implying the pet suffers from silence. A quiet day is missing data. */
function lapseNotes(tone: Tone, n: string): [number, string, string][] {
  return [
    [2, t("notifications.quiet.two_title"), tt("notifications.quiet.two_body", tone)],
    [7, t("notifications.quiet.week_title", { name: n }), tt("notifications.quiet.week_body", tone)],
  ];
}

/** The plan itself: pure, so the two-a-day rule is tested directly. */
export function planNotifications(p: PlanInput): Planned[] {
  if (!p.enabled) return [];
  const now = p.now.getTime();
  const out: Omit<Planned, "id">[] = [];
  const add = (kind: NoteKind, at: Date, text: { title: string; body: string }, open = "home") => { if (at.getTime() > now) out.push({ kind, at, ...text, extra: { open } }); };

  const lapseDays = new Set<string>();
  if (p.lastCheckIn) {
    const [y, m, d] = p.lastCheckIn.split("-").map(Number);
    for (const [days, title, body] of lapseNotes(p.tone, p.name)) {
      const at = new Date(y, m - 1, d + days, 19, 30);
      if (at.getTime() > now) { lapseDays.add(dayKey(at)); add("lapse", at, { title, body }); }
    }
  }
  const [rh, rm] = p.reminder.split(":").map(Number);
  for (let i = 0; i < HORIZON_DAYS; i++) {
    if (Number.isFinite(rh) && Number.isFinite(rm) && !(i === 0 && p.checkedToday)) {
      const at = atTime(p.now, i, rh, rm);
      if (!lapseDays.has(dayKey(at))) add("daily", at, reminderLine(p.tone, p.name), "checkin"); // the quiet-day note is that day's reminder
    }
    if (p.riskHour !== null) {
      const minutes = (p.riskHour * 60 + 24 * 60 - 30) % (24 * 60);
      add("risk", atTime(p.now, i, Math.floor(minutes / 60), minutes % 60), careNote("risk", p.personality, p.tone, p.name));
    }
  }
  if (p.careNotes && p.care) {
    const ev = new Date(p.care.at);
    if (p.care.kind === "clean") {
      const tonight = atTime(ev, 0, 21, 15);
      add("thanks", tonight.getTime() > ev.getTime() ? tonight : new Date(ev.getTime() + 15 * 60_000), careNote("thanks", p.personality, p.tone, p.name));
      add("morning", atTime(ev, 1, 8, 20), careNote("morning", p.personality, p.tone, p.name));
    }
    // After a slip nothing is scheduled: a note from the pet hours later would be a guilt nudge, not help.
    // Recording the slip still clears any thank-you planned for that day.
  }

  const byDay = new Map<string, Omit<Planned, "id">[]>();
  for (const n of out) { const k = dayKey(n.at); byDay.set(k, [...(byDay.get(k) ?? []), n]); }
  const kept = [...byDay.values()].flatMap((list) => list.sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind] || a.at.getTime() - b.at.getTime()).slice(0, MAX_PER_DAY));
  return kept.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, MANAGED_IDS.length).map((n, i) => ({ ...n, id: FIRST_ID + i }));
}

// ---------- applying the plan on the phone ----------

const CARE_KEY = "companion/notify-care";
const readCare = (): PlanInput["care"] => { try { return JSON.parse(localStorage.getItem(CARE_KEY) ?? "null"); } catch { return null; } };
let inputs: Omit<PlanInput, "now" | "care"> = { enabled: false, reminder: "20:00", tone: "honest", name: "", checkedToday: false, lastCheckIn: null, riskHour: null, careNotes: false };
let queue: Promise<void> = Promise.resolve();

async function apply(): Promise<void> {
  await LocalNotifications.cancel({ notifications: [...LEGACY_IDS, ...MANAGED_IDS].map((id) => ({ id })) }).catch(() => undefined);
  if (!inputs.enabled) return;
  const perm = await LocalNotifications.checkPermissions().catch(() => ({ display: "denied" }));
  if (perm.display !== "granted") return;
  const plan = planNotifications({ ...inputs, care: readCare(), now: new Date() });
  if (plan.length) {
    await LocalNotifications.schedule({
      notifications: plan.map((n) => ({ id: n.id, title: n.title, body: n.body, schedule: { at: n.at, allowWhileIdle: true }, extra: n.extra })),
    }).catch(() => undefined);
  }
}

/** Updates what the plan knows and re-plans. Calls run strictly one after another; each replaces the last plan. */
export function updateNotifications(patch: Partial<typeof inputs>): Promise<void> {
  inputs = { ...inputs, ...patch };
  if (!native) return Promise.resolve();
  queue = queue.then(apply, apply);
  return queue;
}

/** Sets (or replaces) the daily check-in reminder. On the web, nothing is scheduled. */
export async function scheduleDaily(time: string, tone: Tone, name: string): Promise<boolean> {
  if (!native) return false;
  await updateNotifications({ enabled: true, reminder: time, tone, name });
  return true;
}

export async function cancelDaily() {
  await updateNotifications({ enabled: false });
}

/**
 * Asks permission once, then schedules. Returns whether reminders are on. Only the phone app can schedule
 * them, so on the web this stays off rather than claiming a reminder that would never arrive.
 */
export async function requestReminders(time: string, tone: Tone, name: string): Promise<boolean> {
  try {
    let granted = false;
    if (native) {
      const p = await LocalNotifications.requestPermissions();
      granted = p.display === "granted";
      if (granted) await scheduleDaily(time, tone, name);
    }
    actions.setSettings({ remindersOn: granted, reminder: time });
    return granted;
  } catch {
    return false;
  }
}

/** Tapping the reminder brings the person straight to today's check-in. */
export function onReminderTap(fn: () => void): () => void {
  if (!native) return () => undefined;
  const h = LocalNotifications.addListener("localNotificationActionPerformed", () => fn());
  return () => { void h.then((x) => x.remove()); };
}

/** Records a good day or a slip so the care notes can answer it, then re-plans. */
export async function scheduleCare(kind: "clean" | "slip", o: { tone: Tone; personality?: Personality; name: string; enabled: boolean }) {
  try { localStorage.setItem(CARE_KEY, JSON.stringify({ kind, at: Date.now() })); } catch { /* ignore */ }
  await updateNotifications({ tone: o.tone, personality: o.personality, name: o.name, careNotes: o.enabled });
}
