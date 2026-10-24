import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { reminderLine } from "./copy";
import { actions } from "./store";
import { careNote } from "./voice";
import type { Personality, Tone } from "./types";

const DAILY_ID = 1001;
const native = Capacitor.isNativePlatform();
/** Reminders are scheduled only by the phone app; the web build can't fire them on time. */
export const remindersSupported = native;

/** Schedules (or replaces) the one daily check-in reminder. On the web, reminders are not scheduled. */
export async function scheduleDaily(time: string, tone: Tone, name: string): Promise<boolean> {
  if (!native) return false;
  const [hour, minute] = time.split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return false;
  const { title, body } = reminderLine(tone, name);
  await LocalNotifications.cancel({ notifications: [{ id: DAILY_ID }] }).catch(() => undefined);
  await LocalNotifications.schedule({
    notifications: [{ id: DAILY_ID, title, body, schedule: { on: { hour, minute }, allowWhileIdle: true }, extra: { open: "checkin" } }],
  });
  return true;
}

export async function cancelDaily() {
  if (native) await LocalNotifications.cancel({ notifications: [{ id: DAILY_ID }] }).catch(() => undefined);
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

const STRIKE_ID = 2001, THANKS_ID = 2002, MORNING_ID = 2003;
const at = (dayOffset: number, hour: number, minute = 0) => { const d = new Date(); d.setDate(d.getDate() + dayOffset); d.setHours(hour, minute, 0, 0); return d; };

/**
 * Care notes in the companion's voice, at most two a day on top of the check-in reminder.
 * After a clean day: a thank-you tonight and a good-morning tomorrow. After a slip: one
 * "hasn't eaten" note a couple of hours later. Each new event replaces the last plan.
 */
export async function scheduleCare(kind: "clean" | "slip", o: { tone: Tone; personality?: Personality; name: string; enabled: boolean }) {
  if (!native) return;
  await LocalNotifications.cancel({ notifications: [{ id: STRIKE_ID }, { id: THANKS_ID }, { id: MORNING_ID }] }).catch(() => undefined);
  if (!o.enabled) return;
  const perm = await LocalNotifications.checkPermissions().catch(() => ({ display: "denied" }));
  if (perm.display !== "granted") return;
  const now = new Date();
  const list: { id: number; title: string; body: string; schedule: { at: Date; allowWhileIdle: boolean } }[] = [];
  if (kind === "clean") {
    const tonight = at(0, 21, 15);
    const thanksAt = tonight > now ? tonight : new Date(now.getTime() + 15 * 60_000);
    list.push({ id: THANKS_ID, ...careNote("thanks", o.personality, o.tone, o.name), schedule: { at: thanksAt, allowWhileIdle: true } });
    list.push({ id: MORNING_ID, ...careNote("morning", o.personality, o.tone, o.name), schedule: { at: at(1, 8, 20), allowWhileIdle: true } });
  } else {
    const later = new Date(now.getTime() + 2 * 3600_000);
    const strikeAt = later.getHours() >= 22 || later.getDate() !== now.getDate() ? at(1, 8, 30) : later;
    list.push({ id: STRIKE_ID, ...careNote("strike", o.personality, o.tone, o.name), schedule: { at: strikeAt, allowWhileIdle: true } });
  }
  await LocalNotifications.schedule({ notifications: list.map((n) => ({ ...n, extra: { open: "home" } })) }).catch(() => undefined);
}

const RISK_ID = 2004;
/** A daily heads-up half an hour before the person's usual slip hour. Null hour cancels it. */
export async function scheduleRisk(hour: number | null, o: { tone: Tone; personality?: Personality; name: string; enabled: boolean }) {
  if (!native) return;
  await LocalNotifications.cancel({ notifications: [{ id: RISK_ID }] }).catch(() => undefined);
  if (hour === null || !o.enabled) return;
  const perm = await LocalNotifications.checkPermissions().catch(() => ({ display: "denied" }));
  if (perm.display !== "granted") return;
  const at = (hour * 60 + 24 * 60 - 30) % (24 * 60);
  const { title, body } = careNote("risk", o.personality, o.tone, o.name);
  await LocalNotifications.schedule({
    notifications: [{ id: RISK_ID, title, body, schedule: { on: { hour: Math.floor(at / 60), minute: at % 60 }, allowWhileIdle: true }, extra: { open: "home" } }],
  }).catch(() => undefined);
}

const LAPSE_IDS = [2010, 2011, 2012, 2013];
/**
 * If check-ins stop, gentle reminders after 2, 4, 7 and 10 quiet days, rescheduled from the last
 * check-in every time the app opens or a day is logged. Honest about the cost, never morbid.
 */
export async function scheduleLapse(lastCheckIn: string, o: { tone: Tone; name: string; enabled: boolean }) {
  if (!native) return;
  await LocalNotifications.cancel({ notifications: LAPSE_IDS.map((id) => ({ id })) }).catch(() => undefined);
  if (!o.enabled) return;
  const perm = await LocalNotifications.checkPermissions().catch(() => ({ display: "denied" }));
  if (perm.display !== "granted") return;
  const n = o.name;
  const notes: [number, string, string][] = [
    [2, `${n} misses you`, o.tone === "brutal" ? "Two days without a check-in. How have they gone?" : "How have the last couple of days been? Ten seconds to check in."],
    [4, `${n} is getting lonely`, `Pets only heal on days you check in. ${o.tone === "gentle" ? "Whenever you're ready." : "A quick one today keeps it that way."}`],
    [7, `A week without news`, o.tone === "gentle" ? `${n} is still here. Whenever you're ready, one check-in picks things up again.` : `${n} is still here. One check-in and healing starts again; the quiet days don't count against you.`],
    [10, `${n} is still waiting`, o.tone === "gentle" ? `${n} is still here and still hoping. Come say hi.` : `Ten quiet days, no harm done. ${n} is ready when you are.`],
  ];
  const [y, m, d] = lastCheckIn.split("-").map(Number);
  const now = Date.now();
  const list = notes.map(([days, title, body], i) => ({ id: LAPSE_IDS[i], title, body, at: new Date(y, m - 1, d + days, 19, 30) }))
    .filter((x) => x.at.getTime() > now)
    .map(({ at, ...x }) => ({ ...x, schedule: { at, allowWhileIdle: true }, extra: { open: "home" } }));
  if (list.length) await LocalNotifications.schedule({ notifications: list }).catch(() => undefined);
}
