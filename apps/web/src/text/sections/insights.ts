import { defineSection, tones } from "../core";

// @copy-section insights.header
export const insightsHeader = defineSection("insights.header", { screen: "Insights", title: "Heading", source: "src/screens/Report.tsx" }, {
  title: "Insights",
});
// @copy-section-end insights.header

// @copy-section insights.week
export const insightsWeek = defineSection("insights.week", { screen: "Insights", title: "This week and last", source: "src/screens/Report.tsx" }, {
  title: "This week",
  summary: "Weekly summary",
  count_one: "{n} goal-met day",
  count_other: "{n} goal-met days",
  strip_aria: "This week",
  day_aria: "{date}: {status}",
  slips: "Slips",
  life_lost: "Life lost",
  months_short: "mo",
  goal_met_days: "Goal-met days",
  spent: "Spent",
  days_checked_in: "Days checked in",
  no_change: "No change",
  arrows: "Arrows compare with last week.",
});
// @copy-section-end insights.week

// @copy-section insights.urges
export const insightsUrges = defineSection("insights.urges", { screen: "Insights", title: "Urges managed", source: "src/screens/Report.tsx" }, {
  managed: "Urges managed",
  of: "of {n}",
  all: "Every urge you've logged, you've managed.",
  some: "{managed} of {total} managed. The others are still useful: each one shows you more about when urges come.",
});
// @copy-section-end insights.urges

// @copy-section insights.money
export const insightsMoney = defineSection("insights.money", { screen: "Insights", title: "Money kept", source: "src/screens/Report.tsx" }, {
  aria: "Money",
  title: "Money",
  over_one: "vs your old pace, over {n} checked-in day",
  over_other: "vs your old pace, over {n} checked-in days",
  needs_slip: "Log a slip with an amount and this shows what you're keeping compared with before.",
  needs_pace: "This needs your starting pace, set during setup.",
  set_goal: "Set something to save for",
  saving_toward: "Saving toward",
  choose_what: "Choose what it's for",
  own_goal: "e.g. New headphones",
  costs: "It costs",
  save_goal: "Save goal",
  remove: "Remove",
  progress: "{saved} of {target}",
  enough: "You've kept enough. Treat yourself.",
  percent: "{pct}% there.",
});
// @copy-section-end insights.money

// @copy-section insights.when
export const insightsWhen = defineSection("insights.when", { screen: "Insights", title: "When it happens", source: "src/screens/Report.tsx" }, {
  title: "Hardest times",
  peak: "Peak around {time}",
  empty: "A map of your risky hours appears after a few slips.",
  heat_aria: "Slips by weekday and time of day.",
  heat_most: " Most often around {time}.",
  heads_up: "{name} will send a heads-up half an hour before {time}, if reminders and the risky-hour heads-up are on.",
  weekdays: "M T W T F S S",
});
// @copy-section-end insights.when

// @copy-section insights.since
export const insightsSince = defineSection("insights.since", { screen: "Insights", title: "Since you started", source: "src/screens/Report.tsx" }, {
  title: "Since you started",
  body: "You said it was {frequency}. On the days you checked in lately, it's about {n} a week.",
  then: "Then",
  now: "Now",
  several_daily: "several times a day",
  daily: "about once a day",
  few_weekly: "a few times a week",
  weekly: "once a week or less",
});
// @copy-section-end insights.since

// @copy-section insights.summary
export const insightsSummary = defineSection("insights.summary", { screen: "Insights", title: "Written summary", source: "src/screens/Report.tsx" }, {
  aria: "Written summary",
  title: "In words",
  ai_note: "Written by an AI service from your counts. See Me → Your data for exactly what is sent.",
});
// @copy-section-end insights.summary

// @copy-section insights.chart
export const insightsChart = defineSection("insights.chart", { screen: "Insights", title: "Slips per week", source: "src/screens/Report.tsx" }, {
  title: "Slips per week, last 8 weeks",
  aria: "Slips per week: {list}",
  now: "now",
});
// @copy-section-end insights.chart

// @copy-section insights.forecast
export const insightsForecast = defineSection("insights.forecast", { screen: "Insights", title: "If nothing changes", source: "src/screens/Report.tsx" }, {
  title: "Looking ahead",
  already: "{name} is already frail.",
  steady: "At the current pace {name} is not getting older.",
  pace_one: "At this pace, {name} reaches the frail stage in about 1 week.",
  pace_other: "At this pace, {name} reaches the frail stage in about {weeks} weeks.",
});
// @copy-section-end insights.forecast

// @copy-section insights.reflect
export const insightsReflect = defineSection("insights.reflect", { screen: "Insights", title: "How was today?", source: "src/screens/Reflect.tsx" }, {
  title: "How was today?",
  done: "Done today",
  mood_aria: "Today's mood",
  mood_placeholder: "Pick a mood",
  mood_1: "Rough",
  mood_2: "Low",
  mood_3: "Okay",
  mood_4: "Good",
  mood_5: "Great",
  placeholder: "One line, if you like. Stays private.",
  saved: "Saved. Thanks for checking in with yourself.",
  prompt_1: "What made today easier or harder?",
  prompt_2: "When the urge comes next, what will you do instead? \"If ___, then I'll ___.\"",
  prompt_3: "One thing you're glad you did today.",
  prompt_4: "What were you feeling right before the last urge?",
  prompt_5: "What would you tell a friend in your place today?",
  prompt_6: "What's one small thing that would make tomorrow go well?",
});
// @copy-section-end insights.reflect

// @copy-section insights.review
export const insightsReview = defineSection("insights.review", { screen: "Insights", title: "Weekly review", source: "src/screens/WeeklyReview.tsx" }, {
  check_in: "Check in with yourself",
  title: "Weekly review",
  which: "Which week",
  last_week: "Last week",
  this_week: "This week",
  when_last: "last week",
  when_this: "this week",
  when_next: "next week",
  from: "From {date}",
  days_aria: "Days",
  urges: "{managed} of {total} {urges} managed.",
  urge_one: "urge",
  urge_other: "urges",
  used: "What you used",
  hard: "What came up most",
  times_one: "once",
  times_other: "{n} times",
  focus_was: "Your focus for {when} was:",
  focus_for: "Focus for {when}",
  focus_aria: "Ideas for {when}",
  own: "Something else",
  own_placeholder: "Your own change",
  saved: "Saved for the week ahead",
});
// @copy-section-end insights.review

// @copy-section insights.goal_line
export const insightsGoalLine = defineSection("insights.goal_line", { screen: "Insights", title: "Weekly review headline", source: "src/recovery.ts" }, {
  nothing_open: tones("Nothing recorded yet this week. There's still time to check in, whenever you're ready.", "Nothing recorded yet this week. There's still time to check in.", "Nothing recorded yet this week. Check in today."),
  nothing_past: tones("Nothing was recorded that week, so there's nothing to go on. That's fine. Each week starts fresh.", "Nothing was recorded that week, so there's nothing to go on. That's fine. Each week starts fresh.", "Nothing was recorded that week, so there's nothing to review. This week starts fresh."),
  stop: tones("{met} of {recorded} without a slip. That counts.", "{met} of {recorded} without a slip.", "{met} of {recorded} without a slip."),
  understand: tones("{days} recorded and {urges} noticed. Every record adds to the picture.", "{days} recorded and {urges} noticed. Every record adds to the picture.", "{days} recorded and {urges} noticed. That's real data."),
  down: tones("{slips}, down from {prev} the week before. That's something to be proud of.", "{slips}, down from {prev} the week before.", "{slips}, down from {prev} the week before."),
  same: tones("{slips}, the same as the week before.", "{slips}, the same as the week before.", "{slips}, the same as the week before."),
  up: tones("{slips}, up from {prev} the week before. One week doesn't undo the ones before it.", "{slips}, up from {prev} the week before. One week doesn't undo the ones before it.", "{slips}, up from {prev} the week before. Look at what changed, then adjust."),
});
// @copy-section-end insights.goal_line

// @copy-section insights.patterns
export const insightsPatterns = defineSection("insights.patterns", { screen: "Insights", title: "What your records show", source: "src/screens/WeeklyReview.tsx" }, {
  aria: "What your records show",
  title: "Patterns",
  not_enough_one: "Not enough yet to see a pattern. 1 more slip or urge logged and {app} will show what it notices. Until then, it won't guess.",
  not_enough_other: "Not enough yet to see a pattern. {n} more slips or urges logged and {app} will show what it notices. Until then, it won't guess.",
  nothing: "Nothing stands out yet. That's a real answer too: no single feeling, time or place dominates your records.",
  pattern: "Pattern",
  hint: "Early hint",
  caveat: "These describe what was going on around slips and urges you recorded, not what caused them. Small numbers can mislead.",
  tried: "Strategies you've tried at least twice",
  tried_row: "{managed} of {total} managed",
});
// @copy-section-end insights.patterns
