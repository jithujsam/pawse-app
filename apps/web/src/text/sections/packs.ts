import { defineSection, tones } from "../core";

/**
 * Talking-pet packs: what a rescued pet says about its past, after a goal-met day and after a slip, matched to the
 * habit being tracked. Lines speak in the pet's voice about the pet's own past owner. Guardrails: no typed text is
 * ever put into a line; habits that aren't one of the five named types (custom, anything sensitive) always get the
 * generic pack; no body, weight or food-restriction words; never shaming. Chosen by packLine() in src/mission-text.ts.
 */
// @copy-section packs.lines
export const packsLines = defineSection("packs.lines", { screen: "Pet screen", title: "Talking-pet packs, by habit", source: "src/mission-text.ts, src/screens/Home.tsx" }, {
  food_story: tones(
    "My last owner lived on takeaways and was always too tired to walk me. I love the days you look after yourself.",
    "My last owner ordered junk every night and never had the energy for walks. I don't want that for you.",
    "My last owner lived on junk food and never walked me. I'd rather that wasn't you.",
  ),
  food_thanks: tones(
    "No junk today. You looked after both of us.",
    "A day without junk. That's how it starts.",
    "No junk today. Good. Again tomorrow.",
  ),
  food_slip: tones(
    "Junk again today. I'm still here. We'll try again tomorrow.",
    "Junk today. I remember where that led in my last home. Let's get back on track.",
    "Junk today. That's what hurt my last home. Back on it tomorrow.",
  ),
  smoking_story: tones(
    "My last owner smoked all the time. The smoke made me cough. I want you to be well with me.",
    "My last owner smoked all day and I coughed all night. I don't want that for you.",
    "My last owner smoked and I breathed it. Not again.",
  ),
  smoking_thanks: tones(
    "No smoking today. The air feels softer. Thank you.",
    "A smoke-free day. My lungs and yours both noticed.",
    "No smoking today. That's the right call.",
  ),
  smoking_slip: tones(
    "You smoked today. It's okay. I'm right here, and tomorrow is new.",
    "You smoked today. I remember that smell. Let's not make it a habit again.",
    "You smoked today. I know that smell too well. Tomorrow, don't.",
  ),
  alcohol_story: tones(
    "My last owner drank most nights and forgot about me. I like it when you're here with me.",
    "My last owner drank a lot and often forgot to feed me or come home. I'm glad you're different.",
    "My last owner drank and forgot I existed. You don't have to be like that.",
  ),
  alcohol_thanks: tones(
    "No drinking today. You were here with me the whole time.",
    "A day without drinking. I noticed, and I'm glad.",
    "No drinking today. Keep it that way.",
  ),
  alcohol_slip: tones(
    "You drank today. I'm not going anywhere. We'll start again.",
    "You drank today. That's how it started in my last home. Let's turn it around.",
    "You drank today. I've seen where that goes. Tomorrow, stop.",
  ),
  scroll_story: tones(
    "My last owner was always on their phone. I waited by the door for walks that never came. I like it when you look up.",
    "My last owner scrolled all night. I'd wait by the door for a walk that never came.",
    "My last owner stared at a phone while I waited by the door. Every day.",
  ),
  scroll_thanks: tones(
    "Less scrolling today. More time for us. Thank you.",
    "You put the phone down today. I got more of you.",
    "Less scrolling today. Good.",
  ),
  scroll_slip: tones(
    "A lot of scrolling today. I'm still here when you look up.",
    "A lot of scrolling today. I'll be waiting by the door again.",
    "Scrolled again. I'm at the door. Tomorrow, come find me.",
  ),
  shop_story: tones(
    "My last owner kept buying things, and the boxes piled up where my bed used to be. I like the space here.",
    "My last owner bought things all the time. The boxes took over my bed.",
    "My last owner's boxes buried my bed. Let's not do that.",
  ),
  shop_thanks: tones(
    "No impulse buys today. Room for both of us.",
    "Nothing bought on impulse today. That's a win.",
    "No impulse buys. Good.",
  ),
  shop_slip: tones(
    "You bought something on impulse today. It's okay. Tomorrow is new.",
    "An impulse buy today. Let's not let the boxes pile up again.",
    "Impulse buy today. Boxes again. Tomorrow, don't.",
  ),
  any_story: tones(
    "I didn't have a good home before. You're giving me one, one day at a time.",
    "My last home wasn't kind to me. Every good day with you helps me trust again.",
    "My last home went badly. This one is up to both of us.",
  ),
  any_thanks: tones(
    "A good day. I felt it too. Thank you.",
    "A good day. That's one more for both of us.",
    "Good day. Do it again tomorrow.",
  ),
  any_slip: tones(
    "A hard day. I'm still here. We'll start again together.",
    "A slip today. I'm not going anywhere. Back on track tomorrow.",
    "A slip today. Tomorrow, get back on it.",
  ),
});
// @copy-section-end packs.lines
