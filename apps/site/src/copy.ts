/**
 * Every word on the page lives here. Edit freely; index.html only places these strings.
 *  - {{priceInr}}, {{spotsTotal}}, {{spotsLeft}}, {{refundWindow}} come from site.config.ts.
 *  - Keep sentences short. Use "I", not "we". A slip is information, not a verdict.
 *  - A feature with img: "" shows a plain labelled placeholder box instead of a screenshot.
 */
export const copy = {
  meta: {
    title: "Pawse: change a habit, heal a dog",
    description: "Pawse is an Android app that gives you a pet for every habit you want to change. Check in each day and your dog heals.",
    share: "Pawse is an Android app that gives you a pet for every habit you want to change.",
  },
  brand: "Pawse",
  nav: { cta: "Become a Founding Member", waitlist: "Join the Google Play waitlist" },

  hero: {
    title: "Change a habit. Heal a dog.",
    sub: "Pawse is an Android app that gives you a pet for every habit you want to change.",
    primary: "Become a Founding Member",
    waitlist: "Join the Google Play waitlist",
    dogAlt: "Miso, a 3D Shiba Inu dog, looking at you.",
    alt: "The Pawse home screen. A dog named Miso is waiting for today's check-in.",
  },

  features: {
    title: "What Pawse does",
    helps: "How it helps:",
    placeholder: "Screenshot not ready yet",
    items: [
      {
        title: "A pet for each habit", tag: "",
        does: "You pick a habit and adopt a dog that reacts to your days.",
        helps: "You look after something, so you keep showing up.",
        img: "/screens/light-pets.webp", alt: "The Pawse home list: one dog for each habit, with its health shown.",
      },
      {
        title: "One-tap check-in", tag: "",
        does: "Tap goal met, I slipped or I had an urge.",
        helps: "It takes seconds, so you do not skip it.",
        img: "/screens/light-checkin.webp", alt: "The Pawse check-in sheet with three buttons: goal met, I slipped and had an urge.",
      },
      {
        title: "Urge support", tag: "Always free",
        does: "Short steps for the moment a craving hits.",
        helps: "You get through it without giving in.",
        img: "/screens/light-urge.webp", alt: "The Pawse urge screen: rate how strong it is, then follow one small step.",
      },
      {
        title: "After a slip", tag: "Always free",
        does: "A calm screen with no lecture and one small step.",
        helps: "One slip does not turn into quitting.",
        img: "/screens/light-slip.webp", alt: "The Pawse screen after a slip, with a single button: Keep going.",
      },
      {
        title: "Goal progress", tag: "Plus, planned",
        does: "Compares your goal with your daily check-ins.",
        helps: "You see how close you are, not only how many days you have counted.",
        img: "", alt: "Screenshot of goal progress is not ready yet. This is a planned Plus feature.",
      },
      {
        title: "Calendar and weekly review", tag: "",
        does: "Shows your days, lets you fix the last few and compares this week with last.",
        helps: "You spot your patterns.",
        img: "/screens/light-journey-month.webp", alt: "The Pawse calendar for a month, with goal-met days, slips and urges marked.",
      },
    ],
  },

  pricing: {
    title: "Pricing",
    freeTitle: "Free",
    free: [
      "One habit and one pet",
      "Daily check-ins and slip log",
      "Calendar",
      "Urge support, always free",
      "After-slip screen, always free",
    ],
    plusTitle: "Plus",
    plusNote: "Planned. Not available yet.",
    plus: [
      "Goal progress",
      "Several habits and pets",
      "Extra breeds and coats",
      "More AI-written notes",
      "Deeper reports",
    ],
    founderTitle: "Founding Member",
    price: "₹{{priceInr}}",
    priceNote: "one time",
    facts: [
      "Lifetime Plus",
      "The current beta",
      "First {{spotsTotal}} spots",
      "Full refund until {{refundWindow}}",
    ],
    dogAlt: "Juniper, a 3D fox, ears up and curious.",
    spotsFirst: "First {{spotsTotal}} spots",
    spotsLeft: "{{spotsLeft}} of {{spotsTotal}} spots left",
    spotsClosed: "All {{spotsTotal}} spots are taken",
    honest: "This buys future Plus access. It does not buy features that exist today.",
    button: "Become a Founding Member",
    waitlistLead: "Leave your email and I will tell you when Pawse is on Google Play.",
    waitlistButton: "Join the Google Play waitlist",
  },

  pay: {
    title: "Pay ₹{{priceInr}} by UPI",
    close: "Close",
    step1: "Scan the QR code, or pay to this UPI ID.",
    qrAlt: "UPI QR code for Pawse",
    upiLabel: "UPI ID",
    copy: "Copy",
    copied: "Copied",
    copyFail: "Select and copy",
    step2: "Then tell me you have paid, so I can match it.",
    name: "Your name",
    email: "Your email",
    ref: "Payment reference",
    refHint: "The UPI transaction ID",
    submit: "I have paid",
    error: "That did not send. Please try again.",
    privacy: "I use your email only to confirm your payment and to write to you about your membership. I do not sell it.",
    done: "Thank you. I will confirm your payment and add Plus to your account within 24 hours.",
  },

  waitlist: {
    title: "Join the Google Play waitlist",
    lead: "I will email you once, when Pawse is on Google Play. That is all I use your email for.",
    email: "Your email",
    submit: "Join the waitlist",
    error: "That did not send. Please try again.",
    done: "Thank you. I will email you once, when Pawse is on Google Play.",
    close: "Close",
  },

  faq: {
    title: "Questions",
    items: [
      { id: "what", q: "What is Pawse?", a: "Pawse is an Android app for changing a habit you choose. You get a dog for each habit. You check in each day, and your dog heals as you keep going. Pawse is a self-awareness tool, not medical treatment." },
      { id: "free", q: "Is it free?", a: "Yes. Pawse is free today, and urge support and the after-slip screen will always be free. Plus is planned for the Google Play launch. Founding Members get Plus for life for ₹{{priceInr}}, paid once." },
      { id: "privacy", q: "Is my data private?", a: "Your records are saved to your own account, and photos stay on your phone. When you log a slip, I send the pet's name, the habit, the amount, your answers and any note you type to an AI model, so it can write you a short note. I ask the AI service not to keep that text, but I cannot check what it does on its side. There are no ads. I do not sell your data. You can export or delete everything at any time." },
      { id: "play", q: "When is it on Google Play?", a: "A Google Play listing is planned. I do not have a date yet. Join the waitlist and I will email you once, when it is live." },
    ],
  },

  footer: {
    privacy: "Privacy",
    credit: "3D dog by <a href=\"https://quaternius.com/packs/ultimateanimatedanimals.html\">Quaternius</a>, CC0",
  },
};
export type Copy = typeof copy;
