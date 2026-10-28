import { defineSection } from "../core";

// @copy-section pets.grid
export const petsGrid = defineSection("pets.grid", { screen: "Home", title: "Pets grid", source: "src/screens/Pets.tsx" }, {
  title: "Home",
  intro: "Each pet looks after one recovery track.",
  empty_title: "No recovery tracks yet",
  empty_body: "Pick one behaviour you'd like to understand or change, and a pet will keep you company while you work on it.",
  add: "Add a recovery track",
  add_hint: "A new pet for another habit",
  tracks: "Recovery tracks",
  not_checked_in: "Not recorded",
  paused: "Paused",
  paused_with: "Paused · {day}",
  card: "{pet}, {track}. {line}. Open this track.",
  more: "More for {track}",
});
// @copy-section-end pets.grid

// @copy-section pets.menu
export const petsMenu = defineSection("pets.menu", { screen: "Home", title: "Pet menu", source: "src/screens/Pets.tsx" }, {
  label: "{name} options",
  label_none: "Pet options",
  this_pet: "this pet",
  your_pet: "Your pet",
  open: "Open {name}",
  pause: "Pause tracking",
  resume: "Resume tracking",
  paused_suffix: " · Paused",
  delete: "Delete {name}",
  confirm_title: "Delete {name}?",
  confirm_body: "This removes {name} and every record, check-in and note for {track}. You can undo for a few seconds.",
  confirm_yes: "Yes, delete {name}",
  keep: "Keep {name}",
  deleted: "{name} is deleted",
});
// @copy-section-end pets.menu

// @copy-section pets.picker
export const petsPicker = defineSection("pets.picker", { screen: "Home", title: "Pet picker", source: "src/screens/Pets.tsx" }, {
  group: "Pet",
  name: "Name",
  name_aria: "Pet name",
  name_placeholder: "Pick a name, like {name}",
  name_other: "Another name…",
  name_own: "Type a name",
  coat: "Coat",
  breed: "Breed",
  personality: "Personality",
});
// @copy-section-end pets.picker

// @copy-section pets.add
export const petsAdd = defineSection("pets.add", { screen: "Home", title: "Add a recovery track", source: "src/screens/Pets.tsx" }, {
  label: "Add a recovery track",
  step1: "Choose a pet",
  step2: "What is it for?",
  step_of: "Step {step} of 2",
  add: "Add {name}",
  added: "{name} is here for {what}",
  note: "Each track has its own pet, plan, check-ins and history. Your voice and reminders stay shared.",
});
// @copy-section-end pets.add
