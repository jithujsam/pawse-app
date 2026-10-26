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
  call_you: "What should {name} call you? (optional)",
  call_you_placeholder: "Your first name",
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
  title: "Anything you'd like to count?",
  intro: "If there's a number you want to note each time, name it yourself. Leave it empty to just record that it happened.",
  field: "Count each time (optional)",
  aria: "What to count each time",
  none: "Nothing, just note that it happened",
  own: "Name it, e.g. cups or episodes",
  often_field: "And how often, right now?",
  often_aria: "How often right now",
  choose: "Choose one",
  note: "No judgement. It helps your Insights show how far you've come.",
});
// @copy-section-end onboarding.count

// @copy-section onboarding.triggers
export const onboardingTriggers = defineSection("onboarding.triggers", { screen: "Onboarding", title: "Step 4: what sets it off", source: "src/screens/Onboarding.tsx" }, {
  title: "What tends to set it off?",
  intro: "Pick any that fit, or add your own. {app} offers these back when an urge hits. All optional.",
  field: "Situations",
  placeholder: "Pick the ones that fit",
});
// @copy-section-end onboarding.triggers

// @copy-section onboarding.why
export const onboardingWhy = defineSection("onboarding.why", { screen: "Onboarding", title: "Step 5: why it matters", source: "src/screens/Onboarding.tsx" }, {
  title: "Why it matters",
  intro: "Your goal and your reasons, in your words. {app} shows them back to you when things get hard. All optional.",
});
// @copy-section-end onboarding.why

// @copy-section onboarding.help
export const onboardingHelp = defineSection("onboarding.help", { screen: "Onboarding", title: "Step 6: a first step", source: "src/screens/Onboarding.tsx" }, {
  title: "A first step, and what helps",
  intro: "Something small and realistic is enough. You can change all of this later from your pet's screen or in Me → Your plan.",
});
// @copy-section-end onboarding.help

// @copy-section onboarding.voice
export const onboardingVoice = defineSection("onboarding.voice", { screen: "Onboarding", title: "Step 7: voice", source: "src/screens/Onboarding.tsx" }, {
  title: "How should {name} talk to you?",
  field: "Voice",
  note: "Every voice is respectful. It describes what happened, never who you are. Change it any time.",
});
// @copy-section-end onboarding.voice

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
  meet: "Meet {name}",
});
// @copy-section-end onboarding.final

// @copy-section onboarding.hatch
export const onboardingHatch = defineSection("onboarding.hatch", { screen: "Onboarding", title: "Step 10: hatching", source: "src/screens/Onboarding.tsx" }, {
  waiting: "Something is happening…",
  born: "Say hi to {name}",
  go: "Let's go",
});
// @copy-section-end onboarding.hatch
