import { defineSection } from "../core";

// @copy-section welcome.story
export const welcomeStory = defineSection("welcome.story", { screen: "Welcome", title: "Story slides", source: "src/screens/Onboarding.tsx (Story), src/screens/Welcome.tsx" }, {
  s1_title: "Meet a friend who's rooting for you",
  s1_body: "A little pet lives here. Good days keep them healthy and happy, and they notice every one.",
  s2_title: "Every slip has a way back",
  s2_body: "You'll see what a slip cost, and exactly how many good days win it back. Nothing is hopeless.",
  s3_title: "Private, kind, yours",
  s3_body: "Your progress is private to you. No lectures, no judgement, just a pet that's glad you're here.",
  next: "Next",
  get_started: "Get started",
  skip: "Skip",
});
// @copy-section-end welcome.story

// @copy-section welcome.account
export const welcomeAccount = defineSection("welcome.account", { screen: "Welcome", title: "Create your account", source: "src/screens/Welcome.tsx" }, {
  title: "Create your account",
  body: "Your pet and your progress are saved to your account, so they're safe if you lose or change your phone. They're private to your account.",
  legal: "This is a self-awareness tool, not medical advice. You'll confirm you're 18 or older before you start.",
});
// @copy-section-end welcome.account

// @copy-section welcome.restoring
export const welcomeRestoring = defineSection("welcome.restoring", { screen: "Welcome", title: "Restoring", source: "src/screens/Welcome.tsx" }, {
  title: "One moment",
  body: "Checking your account for an existing pet…",
});
// @copy-section-end welcome.restoring
