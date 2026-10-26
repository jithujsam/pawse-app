import { defineSection } from "../core";

// @copy-section safety.helplines
export const safetyHelplines = defineSection("safety.helplines", { screen: "Safety", title: "Helplines", source: "src/copy.ts, src/screens/Plan.tsx, src/screens/Me.tsx" }, {
  short: "India: Tele-MANAS 14416. US: call or text 988. UK: Samaritans 116 123. Elsewhere, contact your local emergency number.",
  full: "Free helplines: India Tele-MANAS 14416 (mental health). US SAMHSA National Helpline 1-800-662-4357 (substance use), or call or text 988 in a crisis. UK Samaritans 116 123. Elsewhere, your local emergency number.",
  in_crisis: "If you are in crisis: {helplines}",
});
// @copy-section-end safety.helplines

// @copy-section safety.crisis
export const safetyCrisis = defineSection("safety.crisis", { screen: "Safety", title: "Crisis message", source: "src/copy.ts, src/ui/Controls.tsx, every free-text field" }, {
  message: "That sounds heavy, and it matters more than any log. If you might hurt yourself, please contact local emergency services or a crisis line now, or reach someone you trust. {helplines} Nothing was saved.",
  title: "Pause for a moment",
  close: "Close",
});
// @copy-section-end safety.crisis

// @copy-section safety.restriction
export const safetyRestriction = defineSection("safety.restriction", { screen: "Safety", title: "Food and weight note", source: "src/copy.ts, src/ui/Controls.tsx, every tracking field" }, {
  note: "This app can't track eating less, calories or weight, and it won't. If food and eating feel hard right now, a doctor or counsellor can really help. You can pick something else to watch, like money spent on orders.",
});
// @copy-section-end safety.restriction

// @copy-section safety.professional
export const safetyProfessional = defineSection("safety.professional", { screen: "Safety", title: "Talk to a professional", source: "src/copy.ts, src/screens/Me.tsx" }, {
  note: "If this habit is affecting your health, talk to a doctor or counsellor before changing it suddenly. Stopping alcohol abruptly can be dangerous.",
});
// @copy-section-end safety.professional

// @copy-section safety.disclaimer
export const safetyDisclaimer = defineSection("safety.disclaimer", { screen: "Safety", title: "Disclaimers", source: "src/copy.ts, src/screens/Onboarding.tsx, src/screens/Me.tsx, src/screens/HealthSheet.tsx" }, {
  body: "This app is a self-awareness tool. It is not medical advice, diagnosis or treatment. If your habit is affecting your health or safety, please talk to a doctor or a counsellor.",
  illustrative: "Age and body effects are illustrative estimates. They are not a health prediction.",
  conditions: "Pet conditions are illustrative. They reflect your logs, not anyone's real health.",
  forecast: "An estimate from the last two weeks. Age is illustrative, not a health prediction.",
});
// @copy-section-end safety.disclaimer

// @copy-section safety.support
export const safetySupport = defineSection("safety.support", { screen: "Plan", title: "More support", source: "src/screens/Plan.tsx" }, {
  title: "More support",
  tool: "{app} is a self-help tool, not treatment, and its AI is not a clinician. If this is affecting your health, work, money or relationships, a doctor, counsellor or support service can help, and asking is a strong move, not a failure.",
  alcohol: "If you drink heavily every day, don't stop suddenly without medical advice: withdrawal can be dangerous. A doctor can help you cut down safely.",
});
// @copy-section-end safety.support
