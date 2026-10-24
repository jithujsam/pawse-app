import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { reminderLine } from "./copy";
import { actions } from "./store";
import { careNote } from "./voice";
import type { Personality, Tone } from "./types";

const DAILY_ID = 1001;
const native = Capacitor.isNativePlatform();

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

/** Asks permission once, then schedules. Returns whether reminders are on. */
export async function requestReminders(time: string, tone: Tone, name: string): Promise<boolean> {
  try {
    let granted = false;
    if (native) {
      const p = await LocalNotifications.requestPermissions();
      granted = p.display === "granted";
      if (granted) await scheduleDaily(time, tone, name);
    } else if ("Notification" in window) {
      granted = (await Notification.requestPermission()) === "granted";
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
