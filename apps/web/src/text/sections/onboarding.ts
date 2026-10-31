import { defineSection } from "../core";

// @copy-section onboarding.chrome
export const onboardingChrome = defineSection("onboarding.chrome", { screen: "Onboarding", title: "Back button and progress", source: "src/screens/Onboarding.tsx" }, {
  progress: "{step}/{total}",
});
// @copy-section-end onboarding.chrome

// @copy-section onboarding.pet
export const onboardingPet = defineSection("onboarding.pet", { screen: "Onboarding", title: "Step 1: choose your pet", source: "src/screens/Onboarding.tsx" }, {
  title: "Choose your pet",
  intro: "Pick who they are and give them a name. They'll live on your Home tab and change with you.",
});
// @copy-section-end onboarding.pet

// @copy-section onboarding.change
export const onboardingChange = defineSection("onboarding.change", { screen: "Onboarding", title: "Step 2: what to change", source: "src/screens/Onboarding.tsx, src/screens/Pets.tsx" }, {
  title: "What would you like to change?",
  intro: "Say it in your own words. It's kept private to your account.",
  field: "Pick the closest, or write your own",
  aria: "What you'd like to change",
  placeholder: "Choose one",
  own: "In your own words",
});
// @copy-section-end onboarding.change

// @copy-section onboarding.count
export const onboardingCount = defineSection("onboarding.count", { screen: "Onboarding", title: "Step 3: what to count", source: "src/screens/Onboarding.tsx, src/screens/Pets.tsx" }, {
  field: "Count each time (optional)",
  aria: "What to count each time",
  none: "Nothing, just note that it happened",
  own: "Name it, e.g. cups or episodes",
});
// @copy-section-end onboarding.count

// @copy-section onboarding.reminders
export const onboardingReminders = defineSection("onboarding.reminders", { screen: "Onboarding", title: "Step 8: a daily nudge", source: "src/screens/Onboarding.tsx" }, {
  title: "A daily nudge",
  intro: "One quiet reminder a day to check in, in {name}'s voice. You can turn any reminder off later.",
  field: "When suits you?",
  aria: "Reminder time",
  morning: "Morning",
  midday: "Midday",
  evening: "Evening",
  late: "Late",
  option: "{label} · {time}",
  other: "Another time…",
  turn_on: "Turn on reminders",
});
// @copy-section-end onboarding.reminders

// @copy-section onboarding.final
export const onboardingFinal = defineSection("onboarding.final", { screen: "Onboarding", title: "Step 9: one last thing", source: "src/screens/Onboarding.tsx" }, {
  title: "One last thing",
  adult: "I'm 18 or older",
  adult_hint: "And I understand this is not medical advice.",
});
// @copy-section-end onboarding.final

// @copy-section onboarding.hatch
export const onboardingHatch = defineSection("onboarding.hatch", { screen: "Onboarding", title: "Step 10: hatching", source: "src/screens/Onboarding.tsx" }, {
  waiting: "Something is happening…",
  born: "Say hi to {name}",
  go: "Let's go",
});
// @copy-section-end onboarding.hatch
