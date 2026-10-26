import { defineSection } from "../core";

// @copy-section privacy.flows
export const privacyFlows = defineSection("privacy.flows", { screen: "Me → Your data", title: "Where your data goes", source: "src/screens/Me.tsx" }, {
  title: "Where your data goes",
  phone: "Photos stay on this phone. They are never uploaded; they only leave it in a backup file you export yourself.",
  account: "When you're signed in, your pets, slips, goal-met days, urges, notes, reflections and settings are saved to your account with our database provider, so they survive a lost or changed phone. They are private to your account: there are no public profiles, no ads and no analytics.",
  ai: "When you're signed in, {app} asks an AI service to word short explanations. For a slip it sends the pet's name, the kind of habit, the amount, the answers you picked and any short note you typed. For the weekly summary it sends the pet's name, last week's and this week's counts, your hardest day, the pet's age and your currency. It never sends photos, reflections, your plan or your email.",
  ai_how: "The text goes through our server to the AI service, which is asked not to keep it. We can't check what that service does on its side. We save only its reply, so the same slip isn't sent twice. There is no separate switch for AI wording yet; signing out stops it.",
  updates: "Checking for updates reads a public file and sends none of your records.",
  control: "You can export everything or delete it from this page at any time.",
});
// @copy-section-end privacy.flows

// @copy-section privacy.summary
export const privacySummary = defineSection("privacy.summary", { screen: "App lock", title: "Privacy line", source: "src/screens/Security.tsx" }, {
  line: "Photos stay on this phone and are never uploaded. Everything else is saved privately to your account. There are no ads or trackers.",
});
// @copy-section-end privacy.summary
