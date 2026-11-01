import { defineSection, tones } from "../core";

// @copy-section goal.setup
export const goalSetup = defineSection("goal.setup", { screen: "Your goal", title: "Setting a goal", source: "src/screens/Plan.tsx (GoalSetup), src/screens/Onboarding.tsx" }, {
  title: "Your goal",
  intro: tones(
    "Tell us what a good outcome looks like for you. Your days will be measured against it, so you can see how close you are.",
    "Say what you're aiming for. Insights will measure your days against it.",
    "Set the target. Your days get measured against it.",
  ),
  kind_aria: "What are you aiming for?",
  quit: "Quit completely",
  quit_hint: "No slips at all. Every day without it counts.",
  cut: "Cut down",
  cut_hint: "Keep it to a number you choose.",
  learn: "Understand it first",
  learn_hint: "Notice when and why. No target yet.",
  limit_label: "At most, each week",
  limit_aria: "Most times in a week",
  times_one: "{n} time a week",
  times_other: "{n} times a week",
  less: "Fewer",
  more: "More",
  identity_label: "Who do you want to be?",
  identity_hint: "In your own words. It stays with your goal.",
  identity_aria: "Who you want to be",
  identity_placeholder: "Someone who reads every night",
  start_label: "Where are you starting from?",
  start_hint: "About how often it happens today. It's the starting line your progress is measured from.",
  start_aria: "How often it happens now",
  start_choose: "Choose what fits",
  start_many_daily: "Several times a day",
  start_daily: "About once a day",
  start_few_weekly: "A few times a week",
  start_weekly: "Once a week or less",
  summary_quit: "Quit completely",
  summary_limit: "At most {n} a week",
  summary_learn: "Understanding it first",
  summary_none: "Not set",
});
// @copy-section-end goal.setup

// @copy-section goal.onboarding
export const goalOnboarding = defineSection("goal.onboarding", { screen: "Welcome", title: "Goal step", source: "src/screens/Onboarding.tsx" }, {
  title: tones("What would feel like a win?", "What are you aiming for?", "What's the target?"),
  intro: tones(
    "There's no wrong answer, and you can change it later. Your pet will cheer for whichever you pick.",
    "Pick what you want. You can change it later. Insights will show how your days compare.",
    "Pick the target. You can change it later. Your numbers will be held against it.",
  ),
});
// @copy-section-end goal.onboarding

// @copy-section goal.card
export const goalCard = defineSection("goal.card", { screen: "Insights", title: "Goal progress", source: "src/screens/Report.tsx, src/goal.ts" }, {
  title: "Your goal",
  becoming: "Becoming: {text}",
  this_week: "This week",
  last_week: "Last week",
  target: "Target",
  times_one: "{n} time",
  times_other: "{n} times",
  status_building: tones(
    "A few more check-ins and this will show how close you are.",
    "Not enough check-ins yet to measure this week.",
    "Not enough data yet. Check in.",
  ),
  status_on_quit: tones(
    "No slips this week. You're right where you wanted to be.",
    "No slips this week. On target.",
    "Zero slips. On target. Keep it there.",
  ),
  status_on_limit: tones(
    "You're within your limit this week. Nicely done.",
    "Within your limit this week.",
    "Within the limit. Hold it.",
  ),
  status_closing: tones(
    "Closer than last week. That counts.",
    "Closer to your goal than last week.",
    "Closer than last week. Not there yet.",
  ),
  status_away: tones(
    "A harder week. It's only a week, and you can come back to it.",
    "Further from your goal than last week.",
    "Further from the goal this week. Reset.",
  ),
  status_learn: tones(
    "You're learning your patterns. No target yet, and that's fine.",
    "Observing, with no target set. Set one when you're ready.",
    "No target set. Pick one when you're ready.",
  ),
  since_down: "{pct}% fewer than when you started",
  since_up: "{pct}% more than when you started",
  since_same: "About the same as when you started",
  since_label: "Since you started",
  weeks_aria: "Slips in each of the last 8 weeks, with your target",
  set_goal: "Set a goal",
  edit_goal: "Edit goal",
});
// @copy-section-end goal.card

// @copy-section goal.helps
export const goalHelps = defineSection("goal.helps", { screen: "Insights", title: "What helps you", source: "src/screens/Report.tsx, src/goal.ts" }, {
  title: "What helps you",
  intro: tones(
    "The things you did instead of acting on an urge, and how they went.",
    "What you did instead of acting on an urge, and how often it worked.",
    "What you swapped in, and how often it held.",
  ),
  row: "{what}",
  eased: "{managed} of {total} eased",
  strong: "Avg strength {n} of 5",
  empty: tones(
    "When an urge eases, tell us what you did instead. Over time you'll see what helps you most.",
    "When an urge eases, say what you did instead. Insights will show what works for you.",
    "When an urge eases, log what you did instead. The data shows what works.",
  ),
  photos_aria: "Photos of what you did instead",
  photo_alt: "What you did instead",
});
// @copy-section-end goal.helps
