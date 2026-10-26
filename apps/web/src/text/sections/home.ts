import { defineSection, tones } from "../core";

// @copy-section home.header
export const homeHeader = defineSection("home.header", { screen: "Pet screen", title: "Header and update banner", source: "src/screens/Home.tsx" }, {
  all_pets: "All pets",
  streak_day: "day",
  streak_days: "days",
  update_title: "Update available",
  update_version: "Version {version}",
  update_version_notes: "Version {version} · {notes}",
  update_cta: "Update",
  update_downloading: "Downloading…",
});
// @copy-section-end home.header

// @copy-section home.hero
export const homeHero = defineSection("home.hero", { screen: "Pet screen", title: "Pet, vitals and age", source: "src/screens/Home.tsx" }, {
  hero_aria: "{name}, age {age}",
  vitals_aria: "{name}'s health",
  health_aria: "Health: {title}, {heart} of 100",
  vital_health: "Health",
  vital_history: "History",
  vital_conditions: "Conditions",
  age: "Age",
  life_left: "Life left",
  age_aria: "Visible age",
});
// @copy-section-end home.hero

// @copy-section home.paused
export const homePaused = defineSection("home.paused", { screen: "Pet screen", title: "Paused card", source: "src/screens/Home.tsx" }, {
  aria: "Paused",
  resume: "Resume",
});
// @copy-section-end home.paused

// @copy-section home.week
export const homeWeek = defineSection("home.week", { screen: "Pet screen", title: "Weekly summary", source: "src/screens/Home.tsx" }, {
  title: "Weekly summary",
  count_one: "{n} goal-met day",
  count_other: "{n} goal-met days",
  strip_aria: "This week",
  day_aria: "{date}: {status}",
});
// @copy-section-end home.week

// @copy-section home.today
export const homeToday = defineSection("home.today", { screen: "Pet screen", title: "Today's check-in messages", source: "src/screens/Home.tsx" }, {
  slip_blocks_goal: "You already logged a slip today, so today can't be marked as goal met.",
});
// @copy-section-end home.today

// @copy-section home.milestone
export const homeMilestone = defineSection("home.milestone", { screen: "Pet screen", title: "Milestone dialog", source: "src/screens/Home.tsx" }, {
  aria: "Milestone",
  keep_going: "Keep going",
  unlock: "{item}. Put it on in Me → Your pet.",
  unlock_prefix: "New:",
});
// @copy-section-end home.milestone

// @copy-section home.coach
export const homeCoach = defineSection("home.coach", { screen: "Pet screen", title: "First-run tips", source: "src/ui/Coach.tsx" }, {
  s1_title: "This is {name}",
  s1_body: "Tap to say hello. How they look is how things are going.",
  s2_title: "Check in once a day",
  s2_body: "Slip or goal met, it takes ten seconds. Honest logs are the whole point.",
  s3_title: "Patterns live here",
  s3_body: "Your Journey and Insights fill in as you log.",
  of: "{step} of {total}",
  skip: "Skip",
  next: "Next",
  got_it: "Got it",
});
// @copy-section-end home.coach

// @copy-section calendar.note
export const calendarNote = defineSection("calendar.note", { screen: "Journey", title: "What a day says about itself", source: "src/screens/Calendar.tsx" }, {
  met: tones("Goal met. Lovely.", "Goal met.", "Goal met. Counts."),
  rest: tones("Not tracked. That's okay.", "Not tracked.", "Skipped."),
  paused_unknown: tones("Paused. That's fine.", "Paused.", "Paused."),
  paused_open: tones("Paused since {from}. That's fine.", "Paused since {from}.", "Paused since {from}."),
  paused_range: tones("Paused {from} to {to}. That's fine.", "Paused {from} to {to}.", "Paused {from} to {to}."),
  urge_managed: tones("Urge managed. Well done.", "Urge managed.", "Urge managed, no slip."),
  nothing: tones("Nothing yet.", "Nothing recorded.", "Nothing logged."),
  not_born: "{name} wasn't born yet.",
  urge_noted: "Urge noted. No slip.",
});
// @copy-section-end calendar.note

// @copy-section calendar.age
export const calendarAge = defineSection("calendar.age", { screen: "Journey", title: "Age this month", source: "src/screens/Calendar.tsx" }, {
  aria: "Age this month",
  label: "{name}'s age this month",
  one_point: "The curve starts drawing from {name}'s second day.",
  none: "No age history for this month yet.",
  chart: "Visible age over the month",
});
// @copy-section-end calendar.age

// @copy-section calendar.month
export const calendarMonth = defineSection("calendar.month", { screen: "Journey", title: "Month grid", source: "src/screens/Calendar.tsx" }, {
  previous: "Previous month",
  next: "Next month",
  weekdays: "M T W T F S S",
  day_aria: "{date}: {status}",
  day_edit_aria: "{date}: {status}. Tap to edit",
  note: "Tap a highlighted date to add or change a day.",
});
// @copy-section-end calendar.month

// @copy-section calendar.day
export const calendarDay = defineSection("calendar.day", { screen: "Journey", title: "Day detail", source: "src/screens/Calendar.tsx" }, {
  aria: "Details for {date}",
  urges_managed: "{managed} of {total} {urges} managed",
  urges_using: ", using {strategies}",
  urge_one: "urge",
  urge_other: "urges",
  delete_aria: "Delete this slip",
  deleted: "Slip deleted",
  before: "Before: {text}",
  next_time: "Next time: {text}",
  photo_alt: "Photo attached to this slip",
  mark_met: "Goal met",
  marked_met: "Goal met",
  remove_met: "Undo goal met",
  removed_met: "Goal met removed",
  not_tracking: "Skip day",
  track_after_all: "Track day",
  log_slip: "Log slip",
  log_another: "Log another",
  minutes: "{n} min",
});
// @copy-section-end calendar.day

// @copy-section calendar.stats
export const calendarStats = defineSection("calendar.stats", { screen: "Journey", title: "Calendar totals", source: "src/screens/Journey.tsx" }, {
  title: "Journey",
  so_far: "So far",
  together: "Days together",
  goal_met_days: "Goal-met days",
  healed: "Life healed",
  months_short: "mo",
  best: "Best streak",
  day: "day",
  days: "days",
});
// @copy-section-end calendar.stats

// @copy-section calendar.milestones
export const calendarMilestones = defineSection("calendar.milestones", { screen: "Journey", title: "Milestones", source: "src/screens/Journey.tsx" }, {
  title: "Milestones",
  to_go_one: "{n} day to go",
  to_go_other: "{n} days to go",
  progress: "{care} of {next} days of care: days with your goal met or an urge managed. They add up and never reset.",
  done: "Every milestone reached. {name} is proud of you.",
  badge: "{n} days",
  badge_reached: "{n} days, reached",
});
// @copy-section-end calendar.milestones
