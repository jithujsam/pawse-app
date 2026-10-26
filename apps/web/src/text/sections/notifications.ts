import { defineSection, tones } from "../core";

// @copy-section notifications.permission
export const notificationsPermission = defineSection("notifications.permission", { screen: "Reminders", title: "When reminders can't be turned on", source: "src/screens/Me.tsx, src/screens/Onboarding.tsx" }, {
  blocked: "Notifications are blocked. You can allow them in your phone's settings.",
  web: "Reminders work in the Android app. The web version can't send them on time.",
});
// @copy-section-end notifications.permission

// @copy-section notifications.daily
export const notificationsDaily = defineSection("notifications.daily", { screen: "Notifications", title: "Daily check-in reminder", source: "src/copy.ts, src/notify.ts" }, {
  title: tones("{name} is thinking of you", "Check in with {name}", "{name} is waiting"),
  body: tones("Whenever you're ready, a quick check-in.", "Slip or goal met? It takes ten seconds.", "How did today go? Ten seconds."),
});
// @copy-section-end notifications.daily

// @copy-section notifications.quiet
export const notificationsQuiet = defineSection("notifications.quiet", { screen: "Notifications", title: "After days without a check-in", source: "src/notify.ts" }, {
  two_title: "A quick check-in?",
  two_body: tones("Whenever you're ready. How have the last couple of days gone?", "How have the last couple of days gone? It takes ten seconds.", "Two days unrecorded. How did they go?"),
  week_title: "{name} is here when you're ready",
  week_body: tones("Days you don't record don't count against you. Pick up whenever it suits you.", "Days you don't record don't count against you. Pick up whenever it suits you.", "Unrecorded days don't count against you. Pick it up today."),
});
// @copy-section-end notifications.quiet
