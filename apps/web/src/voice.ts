import type { Personality, Tone } from "./types";

/**
 * What the companion says, in its own voice. Personality decides how it talks; tone decides how blunt
 * it is about slips. Every line exists for all four personalities in all three tones.
 *
 * The psychology, briefly: goal-met days get an immediate, warm, slightly unpredictable reward (variable
 * reinforcement); a slip costs something the person cares about, but always comes with a way back (the plan),
 * because shame after a slip makes people give up entirely (the abstinence violation effect).
 * The pet is hurt by the behaviour, never disgusted by, disappointed in or withholding from the person.
 * It never refuses food, never says its care has to be earned, and a hard day never makes the person less welcome.
 */
export type Event =
  | "petted" | "giggle" | "dizzy" | "stroke"
  | "cleanThanks" | "shrug" | "binge" | "slip" | "rodeOut" | "urgeStart";

type Lines = Record<Personality, Record<Tone, string[]>>;

const L: Record<Event, Lines> = {
  urgeStart: {
    playful: { gentle: ["I'm right here. Breathe with me!", "Let's wait it out together!"], honest: ["It'll pass. Breathe with me.", "Two minutes. You and me."], brutal: ["Breathe with me instead. It will pass."] },
    calm: { gentle: ["In, and out. I'm here.", "Slow breaths. It passes."], honest: ["Breathe. The wave peaks and falls.", "Stay with me for two minutes."], brutal: ["Sit with it. Don't act on it."] },
    sassy: { gentle: ["Ugh, cravings. Let's ignore it together.", "Breathe. Be dramatic later."], honest: ["Watch it fizzle. Breathe.", "It's loud, not in charge."], brutal: ["Breathe with me. It passes."] },
    wise: { gentle: ["Notice it. You don't have to obey it.", "An urge is a wave. Let it pass."], honest: ["Urges rise and fall. Ride this one.", "Breathe. Watch it change."], brutal: ["A craving is a request, not an order."] },
  },
  rodeOut: {
    playful: { gentle: ["You did it! I'm so proud!", "Wave surfed! High five!"], honest: ["It passed and you didn't! Amazing!", "That's how it's done!"], brutal: ["That's a win. Count it."] },
    calm: { gentle: ["Well done. That was strong.", "It passed. You stayed. Lovely."], honest: ["You waited it out. That's a skill.", "Quietly brilliant."], brutal: ["Good. That's the work."] },
    sassy: { gentle: ["Look at you, all disciplined.", "The craving lost. Obviously."], honest: ["Craving: zero. You: one.", "Told you it was all talk."], brutal: ["See? You don't have to obey it."] },
    wise: { gentle: ["Each wave you get through makes the next smaller.", "You were stronger than the moment."], honest: ["This is how habits change: one urge at a time.", "You chose. That matters."], brutal: ["You didn't give in. Remember this feeling."] },
  },
  petted: {
    playful: { gentle: ["Again! Again!", "That's my favourite spot!"], honest: ["Ooh, right there.", "More of that, please."], brutal: ["Okay, that's nice. Don't stop."] },
    calm: { gentle: ["Mm. That's lovely.", "I could sleep like this."], honest: ["That helps.", "Nice and slow. Good."], brutal: ["Fine. That's nice."] },
    sassy: { gentle: ["I suppose I'll allow it.", "Acceptable. Continue."], honest: ["You may continue.", "Mm, yes. That's the spot."], brutal: ["Fine, I like it. Keep going."] },
    wise: { gentle: ["A small kindness goes a long way.", "Thank you. I feel that."], honest: ["Care given is care returned.", "Steady hands. Good."], brutal: ["Kindness to me is easy. Be that kind to yourself."] },
  },
  giggle: {
    playful: { gentle: ["Hee! That tickles!", "Stop it! No, don't stop!"], honest: ["Ha! Tickle war!", "You found the ticklish bit."], brutal: ["Hah! Okay, you win."] },
    calm: { gentle: ["Oh! Hehe.", "Gentle, gentle. Hehe."], honest: ["That tickles a bit.", "Hm, ticklish."], brutal: ["Ticklish. Moving on."] },
    sassy: { gentle: ["Excuse me. Hehe.", "Hey! Also, do it again."], honest: ["The belly is off limits. Mostly.", "Bold move."], brutal: ["Hey! Okay, okay, that tickles."] },
    wise: { gentle: ["Laughter is medicine, they say.", "Hehe. Even old souls giggle."], honest: ["A laugh resets the day.", "Hm. Joy is allowed."], brutal: ["Laugh. Then get back to it."] },
  },
  dizzy: {
    playful: { gentle: ["Whoa, the room is spinning!", "Okay okay, I'm awake!"], honest: ["Too many pokes! Dizzy!", "Brain. Scrambled."], brutal: ["Whoa, dizzy! Gentle, please."] },
    calm: { gentle: ["Easy now. Breathe.", "Slow down, friend."], honest: ["That's a lot of poking.", "Too fast. I'm dizzy."], brutal: ["Slow down, I'm dizzy."] },
    sassy: { gentle: ["Was that necessary?", "I'm filing a complaint."], honest: ["Poke me once more. I dare you.", "Okay, okay!"], brutal: ["Too much poking! A check-in would be nicer."] },
    wise: { gentle: ["Patience, little one.", "Everything in moderation. Even poking."], honest: ["Restless hands. Restless mind?", "Slow. Breathe."], brutal: ["Restless hands? Let's keep them busy tonight."] },
  },
  stroke: {
    playful: { gentle: ["Best. Human. Ever.", "Purr mode activated!"], honest: ["This is the good stuff.", "Mmm, more!"], brutal: ["Okay, that's the good stuff."] },
    calm: { gentle: ["Mmm. Peaceful.", "This is all I need."], honest: ["That's calming.", "Nice and slow."], brutal: ["That's good. Keep it calm."] },
    sassy: { gentle: ["Fine, I'm purring. Tell no one.", "My reputation is ruined."], honest: ["Okay, that one was good.", "You're getting better at this."], brutal: ["Good. You're good at caring. Keep it up."] },
    wise: { gentle: ["Gentle hands, gentle heart.", "Calm is contagious."], honest: ["This is how healing feels.", "Slow is good."], brutal: ["Gentle hands. Be just as kind to yourself."] },
  },
  cleanThanks: {
    playful: { gentle: ["Thank you for today! I feel bouncy!", "You did it! I'm so happy!"], honest: ["Goal met! I can feel it working!", "A good day for both of us. I feel better!"], brutal: ["One goal-met day. Let's do it again tomorrow."] },
    calm: { gentle: ["Thank you. I feel a little better.", "A quiet, good day. Thank you."], honest: ["Goal met today. I'm healing.", "That helped. I can feel it."], brutal: ["Goal met. Here's to the next one."] },
    sassy: { gentle: ["Look at you, keeping promises.", "Okay, I'm impressed. Slightly."], honest: ["Goal met. I feel better, not that I'll admit it.", "Good day. Who are you?"], brutal: ["Goal met. Okay, I'm proud. A little."] },
    wise: { gentle: ["Thank you. Every good day counts.", "You kept your word. I feel it."], honest: ["Goal met today. I'm getting better.", "One more day kept. It adds up."], brutal: ["You kept your word today. Tomorrow is another chance to."] },
  },
  shrug: {
    playful: { gentle: ["We've had {d} good days. I'm okay, really!", "One wobble after {d} days? I'm still bouncy!"], honest: ["{d} good days. One slip doesn't undo that. I'm fine.", "I'm strong from {d} good days. I'll shake it off."], brutal: ["{d} good days kept me strong. Let's rebuild that cushion."] },
    calm: { gentle: ["After {d} good days, I'm all right. Rest.", "I'm okay. {d} days made me strong."], honest: ["{d} days of good care. I can absorb one slip.", "I'm fine. Those {d} days count."], brutal: ["{d} days of care covered this one. Let's get back on track."] },
    sassy: { gentle: ["{d} days in? I barely noticed. Barely.", "I'm fine. {d} days of care left me sturdy."], honest: ["{d} days of care made me tough. I'll shrug this one off.", "Shrugged it off. {d} days of practice."], brutal: ["{d} days of care left me strong. I'm fine. Let's top it up."] },
    wise: { gentle: ["One stumble on a long road. {d} good days hold me up.", "I'm well. {d} days of care."], honest: ["{d} days built a cushion, and it held. It's thinner now.", "{d} days of care softened this one."], brutal: ["{d} days of care held me up. Back to your plan now."] },
  },
  binge: {
    playful: { gentle: ["That was a lot today. I need rest.", "Ow. Too much at once."], honest: ["That was a lot. It took years off me.", "Too much today. That one leaves a mark."], brutal: ["That was a lot at once. Some of it will stay, but I'm still here."] },
    calm: { gentle: ["That was heavy. Let's rest tomorrow.", "Too much today. I'm tired."], honest: ["That much in one day leaves a mark. I'll carry it.", "Heavy day. Some of it stays."], brutal: ["Hard day. Some of it stays. Tomorrow we start again."] },
    sassy: { gentle: ["Well, that was a big one.", "That was… a lot. I'm still here."], honest: ["That was a heavy day. I'm still on your side.", "Some of that stays with me. We keep going."], brutal: ["That one leaves a mark. Let's make tomorrow different."] },
    wise: { gentle: ["Storms pass. Some leave marks.", "Rest now. Tomorrow, begin again."], honest: ["Some of that stays. What comes next still matters.", "A hard day leaves a mark. It doesn't define the road."], brutal: ["That took some years. What comes next can give some back."] },
  },
  slip: {
    playful: { gentle: ["Oof. I'll be okay. Will you?", "That one hurt a little."], honest: ["Ouch. That one stung.", "That hurt. I'm going to sit down."], brutal: ["Ow. That one hurt. Let's stop for today."] },
    calm: { gentle: ["It's all right. Breathe.", "I felt that. We'll be okay."], honest: ["That hurt. Let's not do it again today.", "I'm tired now."], brutal: ["That hurt a little. Let's rest and reset."] },
    sassy: { gentle: ["Okay. It happened. I'm still here.", "Noted. Snacks for the soul later."], honest: ["Noted. We bounce back from this.", "Okay. Now we know. Moving on."], brutal: ["Oof. Tomorrow's a new page."] },
    wise: { gentle: ["A slip is not a fall.", "We begin again."], honest: ["A slip costs. Honesty helps.", "That hurt. Tomorrow can be different."], brutal: ["A slip is a lesson. Tonight can still be good."] },
  },
};

/** Every line the pet can say, by event, personality and voice. Exported so the copy inspector lists them all. */
export const PET_LINES: Record<Event, Lines> = L;

/** One line for an event, picked at random so it never feels canned. `{d}` becomes `days`. */
export function say(event: Event, personality: Personality | undefined, tone: Tone, days = 0): string {
  const byPersonality = L[event][personality ?? "playful"] ?? L[event].playful;
  const xs = byPersonality[tone] ?? byPersonality.honest;
  return xs[Math.floor(Math.random() * xs.length)].replace("{d}", String(days));
}

/** The next step back to health, in tone. Numbers come from the engine. */
/**
 * The way back after a slip. Each goal-met day heals the same amount whether or not the days are in a row
 * (gaps are neutral), so no tone says "in a row" or implies a reset.
 */
export function recoveryLine(tone: Tone, name: string, undo: number, stage: { days: number; label: string } | null): string {
  const d = (n: number) => `${n} good ${n === 1 ? "day" : "days"}`;
  const undoes = (n: number) => (n === 1 ? "undoes" : "undo");
  const back = stage ? ` ${d(stage.days)} and ${name} is ${stage.label.toLowerCase()} again.` : "";
  if (tone === "gentle") return `${d(undo)} ${undoes(undo)} today, whenever they come.${back}`;
  if (tone === "brutal") return `${d(undo)} ${undoes(undo)} today.${back} Start with today.`;
  return `${d(undo)} with your goal met ${undoes(undo)} today.${back}`;
}

/** Notifications in the companion's voice. Title is the pet's name; body speaks in first person. */
export function careNote(kind: "thanks" | "morning" | "risk", personality: Personality | undefined, tone: Tone, name: string): { title: string; body: string } {
  if (kind === "thanks") return { title: name, body: say("cleanThanks", personality, tone) };
  const p = personality ?? "playful";
  if (kind === "risk") {
    const risk: Record<Personality, Record<Tone, string>> = {
      playful: { gentle: "This is usually a tricky hour. Want to hang out with me instead?", honest: "Heads up: this is when slips usually happen. Come say hi?", brutal: "This is your tricky hour. Make a plan now. I'm here." },
      calm: { gentle: "A gentle heads-up: this hour can be hard. I'm here.", honest: "This is usually the hard hour. Breathe with me if it comes.", brutal: "Hard hour coming. Have a plan." },
      sassy: { gentle: "It's that hour again. Let's be boring together.", honest: "Your usual slip o'clock. Let's not.", brutal: "Usual slip o'clock. Let's make tonight different." },
      wise: { gentle: "This hour has been hard before. It doesn't have to be tonight.", honest: "Patterns repeat until we change them. This is the hour.", brutal: "You know this hour. Decide now, not later." },
    };
    return { title: name, body: (risk[p] ?? risk.playful)[tone] ?? risk.playful.honest };
  }
  const morning: Record<Personality, Record<Tone, string>> = {
    playful: { gentle: "Slept so well! Thank you for yesterday!", honest: "Woke up feeling great. Yesterday went well!", brutal: "Good sleep. Yesterday went well. Repeat it." },
    calm: { gentle: "A good night's sleep. Thank you.", honest: "I slept well after a good day.", brutal: "Rested. Keep today on track too." },
    sassy: { gentle: "Slept like royalty. You may continue.", honest: "Best sleep in ages. Coincidence? No.", brutal: "Slept well. Let's keep today just as good." },
    wise: { gentle: "Rest comes easy after a kept promise.", honest: "A good day makes for a good sleep.", brutal: "Yesterday was kept. Today is new. Keep it." },
  };
  return { title: name, body: (morning[p] ?? morning.playful)[tone] ?? morning.playful.honest };
}
