import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { reminderLine } from "./copy";
import { actions } from "./store";
import type { Tone } from "./types";

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
