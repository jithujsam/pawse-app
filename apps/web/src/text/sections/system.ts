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
  skip_for_now: "Skip for now",
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
