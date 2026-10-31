import { defineSection } from "../core";

// @copy-section nav.tabs
export const navTabs = defineSection("nav.tabs", { screen: "Tab bar", title: "Tabs", source: "src/App.tsx" }, {
  pets: "Home",
  calendar: "Journey",
  insights: "Insights",
  me: "Me",
  main: "Main",
  quick: "Log or check in",
});
// @copy-section-end nav.tabs

// @copy-section nav.loading
export const navLoading = defineSection("nav.loading", { screen: "Loading and errors", title: "Loading and error screens", source: "src/App.tsx, src/ui/ErrorBoundary.tsx" }, {
  loading: "Loading",
  boot: "Loading {app}",
  error_title: "Something went wrong",
  error_body: "Your pets and your logs are safe on this phone. Reloading usually fixes it.",
  reload: "Reload",
});
// @copy-section-end nav.loading

// @copy-section ui.common
export const uiCommon = defineSection("ui.common", { screen: "Shared controls", title: "Common words", source: "src/ui/*.tsx" }, {
  back: "Back",
  cancel: "Cancel",
  done: "Done",
  edit: "Edit",
  save: "Save",
  add: "Add",
  skip: "Skip",
  not_now: "Not now",
  continue: "Continue",
  undo: "Undo",
  delete_key: "Delete",
  drag_to_close: "Drag down or tap to close",
  hour: "Hour",
  minute: "Minute",
  am_pm: "AM or PM",
});
// @copy-section-end ui.common

// @copy-section ui.select
export const uiSelect = defineSection("ui.select", { screen: "Shared controls", title: "Dropdowns", source: "src/ui/Controls.tsx" }, {
  choose: "Choose…",
  something_else: "Something else…",
  type_your_own: "Type your own",
  add_one: "Add one…",
  add_another: "Add another…",
  remove: "Remove {item}",
  add_suffix: "{label}: add",
  typed_suffix: "{label}: {hint}",
  showing: "Showing",
  paused_tag: "Paused",
});
// @copy-section-end ui.select

// @copy-section ui.settings
export const uiSettings = defineSection("ui.settings", { screen: "Shared controls", title: "Photos and pin pad", source: "src/screens/LogSheet.tsx, src/ui/PinPad.tsx" }, {
  digits: "{count} of {length} digits",
});
// @copy-section-end ui.settings

// @copy-section pet.look
export const petLook = defineSection("pet.look", { screen: "Home", title: "How a pet is described to a screen reader", source: "src/pet-label.ts, src/Companion.tsx, src/Pet3D.tsx" }, {
  label: "{species}, {stage}, {mood}",
  interactive: "Your pet. Tap the head to pet, the belly to tickle, or stroke it.",
  mood_idle: "relaxed",
  mood_waiting: "waiting",
  mood_happy: "happy",
  mood_hurt: "hurt",
  mood_sick: "unwell",
  mood_dying: "very frail",
  mood_sad: "sad",
});
// @copy-section-end pet.look

// @copy-section help.tutorial
export const helpTutorial = defineSection("help.tutorial", { screen: "How Pawse works", title: "The walkthrough", source: "src/ui/Tutorial.tsx, src/screens/Me.tsx" }, {
  label: "How {app} works",
  count: "{n} of {total}",
  skip: "Skip",
  back: "Back",
  next: "Next",
  done: "Start",
  p1_title: "Your pet mirrors your habit",
  p1_body: "Its wellness is the one number to watch. Goal-met days raise it; slips lower it.",
  p2_title: "Check in every day",
  p2_body: "Tap + to mark today: goal met, a slip, or an urge you handled. A day you skip counts neither way.",
  p3_title: "21 days to recover",
  p3_body: "A rescued pet heals with 21 goal-met days in a row. A slip starts the 21 over, but your best run is always kept. Tap Missions to see what it's healing from.",
  p4_title: "Then stay consistent",
  p4_body: "21 more days earn rewards. From then on a slip doesn't restart anything: it gives your pet an issue that a few goal-met days in a row clear.",
  p5_title: "When an urge hits",
  p5_body: "Tap + and choose the urge option: a moment to pause, ways through it, and your own reasons, until it passes.",
  p6_title: "Everything else",
  p6_body: "Journey is your calendar, Insights shows your patterns, and Me holds your plan, reminders and settings. This guide is always in Me → How {app} works.",
});
// @copy-section-end help.tutorial
