import { describe, expect, it, vi } from "vitest";

// On the web nothing can schedule a reminder, so turning reminders on must not claim they're on (audit B4).
vi.stubGlobal("window", { Notification: { requestPermission: async () => "granted" } });
vi.stubGlobal("Notification", { requestPermission: async () => "granted" });

const { requestReminders, remindersSupported } = await import("../src/notify");
const { getData } = await import("../src/store");

describe("reminders outside the phone app", () => {
  it("stay off even when the browser grants permission", async () => {
    expect(remindersSupported).toBe(false);
    expect(await requestReminders("21:00", "honest", "Biscuit")).toBe(false);
    expect(getData().settings.remindersOn).toBe(false);
    expect(getData().settings.reminder).toBe("21:00");
  });
});
