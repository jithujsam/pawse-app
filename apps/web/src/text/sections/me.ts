import { defineSection } from "../core";

// @copy-section me.profile
export const meProfile = defineSection("me.profile", { screen: "Me", title: "Profile and settings list", source: "src/screens/Me.tsx" }, {
  title: "Me",
  tracking: "Tracking: {track}",
  summary: "{species} · {personality} · {stage} · day {day}",
  g_plan: "Plan and voice",
  g_tracking: "Tracking",
  g_privacy: "Privacy",
  g_app: "App",
  g_dev: "Developer",
  row_plan: "Your plan",
  row_voice: "Voice",
  row_questions: "Check-in questions",
  row_reminders: "Reminders",
  row_account: "Account and backup",
  row_lock: "App lock",
  row_data: "Your data",
  row_appearance: "Appearance",
  row_feel: "Feel and region",
  row_about: "About and help",
  row_updates: "Updates",
  update_badge: "Update available",
  row_sim: "Test the simulation",
  page_pet: "Your pet",
  goal_stop: "Stop",
  goal_reduce: "Cut down",
  goal_understand: "Understand",
  goal_none: "Not set",
  on: "On",
  off: "Off",
  needs_attention: "Needs attention",
});
// @copy-section-end me.profile

// @copy-section me.pet
export const mePet = defineSection("me.pet", { screen: "Me → Your pet", title: "Your pet", source: "src/screens/Me.tsx" }, {
  days: "Days together",
  born: "Born",
  name: "Name",
  style_failed: "3D couldn't load on this phone, so a drawing is shown.",
  style_unsupported: "This phone can't draw 3D, so a drawing is shown.",
  species: "Species",
  coat: "Coat",
  breed: "Breed",
  personality: "Personality",
  wardrobe: "Wardrobe",
  days_of_care: "{n} days of care",
  day_of_care: "{n} day of care",
  accessory: "Accessory",
  none: "None",
  unlocks: "{label} (unlocks at {n} days of care)",
  care_note: "Days of care are days with your goal met or an urge managed. They add up and never reset, and every unlock stays yours.",
  health_title: "How {name}'s health works",
  health_body: "Slips you log age {name} a little. Days with your goal met heal them. Days you don't record change nothing.",
  classic_on: "Passing away is on: when the health bar turns fully red, a pet dies and you adopt a new one.",
  continuity: "{name} can get very frail but never dies, and every month can heal back with enough goal-met days.",
  classic_label: "Classic rules",
  classic_blocked: "Not available: under classic rules {name}'s history would already have ended. Some goal-met days first, then try again.",
  classic_hint: "Death when the bar is fully red. Off by default.",
  farewell: "Show the farewell scene",
  farewell_hint: "Turn off to see only the memorial text",
  hall: "Hall of Pets",
  hall_empty: "Nobody yet. {name} is still here.",
  hall_slips_one: "{n} slip",
  hall_slips_other: "{n} slips",
  hi: "Renamed to {name}",
  species_changed: "{name} is a {species} now. Same name, same history.",
});
// @copy-section-end me.pet

// @copy-section me.voice
export const meVoice = defineSection("me.voice", { screen: "Me → Voice", title: "Voice", source: "src/screens/Me.tsx" }, {
  intro: "How {name} talks to you, everywhere in the app and in reminders.",
  call_you: "What should {name} call you? (optional)",
  call_you_placeholder: "Your first name",
  field: "Voice",
  note: "Every voice is respectful. It describes what happened, never who you are.",
});
// @copy-section-end me.voice

// @copy-section me.reminders
export const meReminders = defineSection("me.reminders", { screen: "Me → Reminders", title: "Reminders", source: "src/screens/Me.tsx" }, {
  daily: "Daily check-in reminder",
  daily_on: "Every day at {time}",
  daily_off: "Off",
  time: "Time",
  time_aria: "Reminder time",
  note: "One quiet nudge a day, in {name}'s voice. {app} never sends more than two notifications a day.",
  risk: "Risky-hour heads-up",
  risk_hint: "Once your pattern is clear, a note half an hour before your usual slip time",
  care: "Notes from {name}",
  care_hint: "A thank-you on the evening of a good day, and a morning note after it",
});
// @copy-section-end me.reminders

// @copy-section me.questions
export const meQuestions = defineSection("me.questions", { screen: "Me → Check-in questions", title: "Check-in questions", source: "src/screens/Me.tsx" }, {
  intro: "Asked each time you log a slip. Short answers keep your Insights easy to read.",
  new_question: "Your question",
  question_aria: "Question",
  type_aria: "Type",
  remove_aria: "Remove question",
  answers: "Answers, separated by commas",
  add: "Add a question",
  recommended: "Use recommended",
  removed: "Question removed",
  switched: "Switched to the recommended questions",
  t_choice: "Pick one",
  t_multi: "Pick any",
  t_scale: "1 to 5",
  t_text: "Text",
  t_number: "Number",
  t_money: "Money",
  t_yesno: "Yes / no",
  t_photo: "Photo",
});
// @copy-section-end me.questions

// @copy-section me.data
export const meData = defineSection("me.data", { screen: "Me → Your data", title: "Your data", source: "src/screens/Me.tsx" }, {
  backup: "Backup file",
  backup_hint: "A copy of everything on this phone, as a file you keep.",
  export: "Export",
  restore: "Restore",
  exported: "Your data was saved as a file",
  too_big: "That file is too big to be a backup",
  restored: "Backup restored",
  not_backup: "That file isn't a {app} backup",
  start_over: "Start over",
  delete_all: "Delete all data on this phone",
  delete_body: "This removes all your pets, every log and your settings from this phone. It can't be undone.",
  delete_body_signed_in: "This removes all your pets, every log and your settings from this phone only. Your account keeps its copy, so it comes back here while you're signed in. To remove it everywhere, delete your account in Account and backup.",
  yes_delete: "Yes, delete",
});
// @copy-section-end me.data

// @copy-section me.appearance
export const meAppearance = defineSection("me.appearance", { screen: "Me → Appearance", title: "Appearance", source: "src/screens/Me.tsx" }, {
  theme: "Theme",
  theme_system: "System",
  theme_light: "Light",
  theme_dark: "Dark",
  theme_hint: "System follows your phone's light or dark setting.",
  colour: "Colour",
  accent: "Accent colour",
  accent_pet: "Match my pet",
  accent_coral: "Coral",
  accent_ocean: "Ocean",
  accent_forest: "Forest",
  accent_berry: "Berry",
  accent_plum: "Plum",
  accent_slate: "Slate",
  accent_hint: "\"Match my pet\" picks a colour that suits your pet.",
});
// @copy-section-end me.appearance

// @copy-section me.feel
export const meFeel = defineSection("me.feel", { screen: "Me → Feel and region", title: "Feel and region", source: "src/screens/Me.tsx" }, {
  haptics: "Haptics",
  haptics_hint: "Small vibrations when you tap",
  currency: "Currency symbol",
  currency_aria: "Currency",
  currency_other: "Another symbol…",
  currency_own: "e.g. AED or Rs",
  region: "Clock and region: {place} ({zone}), {clock} time",
  clock_12: "12-hour",
  clock_24: "24-hour",
  use_currency: "Use {currency}",
});
// @copy-section-end me.feel

// @copy-section me.about
export const meAbout = defineSection("me.about", { screen: "Me → About and help", title: "About and help", source: "src/screens/Me.tsx" }, {
  version: "Version",
  check: "Check for updates",
  checking: "Checking…",
  all: "All versions",
  ready: "Version {version} is ready",
  error: "Couldn't check for updates. Check your connection and try again",
  latest: "You have the latest version",
  safety: "Safety",
  tagline: "Pause the habit. Keep your pet happy.",
  what_title: "What {app} does",
  what_body: "{app} gives each habit you're changing a pet of its own. Check in each day and the pet stays bright. A slip costs it a little, a good day heals some back, and you can always see the way back. It's a self-awareness tool, not medical advice.",
  pets_caption: "Look after them and they grow up happy.",
  contact_title: "Get in touch",
  contact_body: "{app} is made by one person. Questions, bugs and ideas are all welcome.",
  contact_cta: "Email {email}",
});
// @copy-section-end me.about
