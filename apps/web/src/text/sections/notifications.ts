import { defineSection, tones } from "../core";

// @copy-section notifications.permission
export const notificationsPermission = defineSection("notifications.permission", { screen: "Reminders", title: "When reminders can't be turned on", source: "src/screens/Me.tsx, src/screens/Onboarding.tsx" }, {
  blocked: "Notifications are blocked. You can allow them in your phone's settings.",
  web: "Reminders work in the Android app. The web version can't send them on time.",
});
// @copy-section-end notifications.permission

// @copy-section notifications.daily
export const notificationsDaily = defineSection("notifications.daily", { screen: "Notifications", title: "Daily check-in reminder", source: "src/copy.ts, src/notify.ts" }, {
  title: tones("🐾 {name} is thinking of you{who}", "✅ Check in with {name}{who}", "⏰ {name} is waiting{who}"),
  body: tones("Whenever you're ready, a quick check-in. 💛", "Slip or goal met? It takes ten seconds. ⏱️", "How did today go? Ten seconds. 💪"),
});
// @copy-section-end notifications.daily

// @copy-section notifications.quiet
export const notificationsQuiet = defineSection("notifications.quiet", { screen: "Notifications", title: "After days without a check-in", source: "src/notify.ts" }, {
  two_title: "💭 A quick check-in{who}?",
  week_title: "🐾 {name} is here when you're ready{who}",
});
// @copy-section-end notifications.quiet

// @copy-section notifications.catchup
export const notificationsCatchup = defineSection("notifications.catchup", { screen: "Notifications", title: "Days still open to fill in", source: "src/copy.ts, src/notify.ts" }, {
  title_one: tones("📝 {names} is missing you{who}", "📝 {names} needs an update{who}", "⏰ {names}: update due{who}"),
  title_many: tones("📝 {names} are missing you{who}", "📝 {names} need an update{who}", "⏰ {names}: update due{who}"),
  body: tones("Please fill in the {n} open {days} before they lock. 🐾", "{n} open {days}. Update before they lock. ⏳", "{n} open {days}. Fill in before they lock. ⏳"),
});
// @copy-section-end notifications.catchup
