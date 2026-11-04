import { defineSection, tones } from "../core";

// Membership copy (PRD §25, docs/MONETISATION.md). Prices, plan contents and data statements are factual and stay
// tone-neutral on purpose; only what the app says to the person about their trial or membership ending has three
// Voices. None of it ties the pet's welfare to paying: the pet is never said to suffer, wait, or miss the person.

// @copy-section membership.paywall
export const membershipPaywall = defineSection("membership.paywall", { screen: "Membership", title: "Paywall: access has ended", source: "src/screens/Paywall.tsx" }, {
  aria: "Membership",
  title: "{app} — Your commitment to change.",
  intro_trial: tones(
    "You've had seven days of full access. If {app} has been useful, an annual membership keeps it going, and everything picks up where you left it.",
    "Your seven days of full access have ended. To keep using {app}, choose an annual membership.",
    "The seven-day trial is over. An annual membership keeps the app open.",
  ),
  intro_plan: tones(
    "Your annual membership has come to an end. Renew whenever you're ready, and everything picks up where you left it.",
    "Your annual membership has ended. Renew it to keep using {app}.",
    "Your membership has expired. Renew to keep going.",
  ),
  refunded: "This membership was refunded, so access has ended.",
  revoked: "Access to this membership was withdrawn. If you think that's a mistake, write to {email}.",
  unconfirmed: "This phone hasn't been able to confirm your membership for more than 7 days. Connect to the internet and check again.",
  need: "Continued access needs an annual membership.",
  plans_aria: "Membership plans",
  basic_name: "Basic",
  basic_price: "$1 a year",
  basic_body: "The full app without AI: recovery tracking, missions, history, insights, journal and personalisation. No new AI requests.",
  ai_name: "AI",
  ai_price: "$3 a year",
  ai_body: "Everything in Basic, plus every AI feature: written explanations of slips, your pet's own lines in its personality, and AI features added later.",
  annual: "Both are paid once a year. Neither is a lifetime purchase.",
  choose: "Choose {plan}",
  no_checkout: "Membership can't be bought in this version of the app yet. Nothing has been charged.",
  payment_info: "Payment information",
  checkout_failed: "Couldn't open the checkout. Nothing has been charged. Please try again in a moment.",
  check: "Check my membership again",
  checking: "Checking…",
  still_closed: "No active membership found yet.",
  reopened: "Membership confirmed. Welcome back.",
  data_title: "Your data stays yours",
  data_body: "Everything you've logged is kept, on this phone and in your account. Nothing is deleted or changed while access is paused. You can export it or delete your account at any time.",
  export: "Export my data",
  account_title: "Account",
});
// @copy-section-end membership.paywall

// @copy-section membership.unverifiable
export const membershipUnverifiable = defineSection("membership.unverifiable", { screen: "Membership", title: "Membership can't be checked", source: "src/screens/Paywall.tsx" }, {
  title: "Can't check your membership",
  body: "This phone hasn't confirmed your membership yet and can't reach the server right now. Connect to the internet and try again. Everything on this phone is kept.",
  retry: "Try again",
});
// @copy-section-end membership.unverifiable

// @copy-section membership.status
export const membershipStatus = defineSection("membership.status", { screen: "Me", title: "Membership status", source: "src/screens/Paywall.tsx" }, {
  title: "Membership",
  trial_today: "Free trial: ends today",
  trial_one: "Free trial: 1 day left",
  trial_other: "Free trial: {n} days left",
  trial_ends: "Ends {date}",
  trial_note: "The trial includes every pet, every breed and look, AI features and one recovery track.",
  verify: "Confirm your email address to use AI features during the trial.",
  basic: "Basic membership until {date}",
  ai: "AI membership until {date}",
  basic_note: "AI features aren't part of Basic. Everything else works as usual.",
  offline: "Last confirmed {date}. It checks again when you're online.",
  row_trial_today: "Trial · ends today",
  row_trial_one: "Trial · 1 day left",
  row_trial_other: "Trial · {n} days left",
  row_basic: "Basic",
  row_ai: "AI",
  ending_soon: "Your free trial ends {date}. Me → Membership shows the plans.",
});
// @copy-section-end membership.status

// @copy-section membership.limits
export const membershipLimits = defineSection("membership.limits", { screen: "Home", title: "Track allowance", source: "src/screens/Pets.tsx" }, {
  track_trial: "The trial includes one recovery track. A membership allows up to 50.",
  track_none: "Adding a recovery track needs an active membership.",
});
// @copy-section-end membership.limits
