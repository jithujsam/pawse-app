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
  | "cleanThanks" | "shrug" | "binge" | "slip" | "rodeOut" | "urgeStart"
  /** Coming back after quiet days: 2 to 3, 4 to 6, a week or more. `{d}` is the number of days. */
  | "away" | "awayLong" | "awayWeek";

type Lines = Record<Personality, Record<Tone, string[]>>;

const L: Record<Event, Lines> = {
  urgeStart: {
    playful: { gentle: ["I'm right here. Breathe with me!", "Let's wait it out together!"], honest: ["It'll pass. Breathe with me.", "Two minutes. You and me."], brutal: ["Breathe with me instead. It will pass."] },
    calm: { gentle: ["In, and out. I'm here.", "Slow breaths. It passes."], honest: ["Breathe. The wave peaks and falls.", "Stay with me for two minutes."], brutal: ["Sit with it. Don't act on it."] },
    sassy: { gentle: ["Ugh, cravings. Let's ignore it together.", "Breathe. Be dramatic later."], honest: ["Watch it fizzle. Breathe.", "It's loud, not in charge."], brutal: ["Breathe with me. It passes."] },
    wise: { gentle: ["Notice it. You don't have to obey it.", "An urge is a wave. Let it pass."], honest: ["Urges rise and fall. Ride this one.", "Breathe. Watch it change."], brutal: ["A craving is a request, not an order."] },
    savage: { gentle: ["The craving's being dramatic. That's my job. Breathe with me."], honest: ["That urge is all talk. Stare it down with me.", "Cravings are loud and dumb. Out-wait it."], brutal: ["Your craving is a bad salesman. Don't buy.", "Ignore it. It hates that."] },
  },
  rodeOut: {
    playful: { gentle: ["You did it! I'm so proud!", "Wave surfed! High five!"], honest: ["It passed and you didn't! Amazing!", "That's how it's done!"], brutal: ["That's a win. Count it."] },
    calm: { gentle: ["Well done. That was strong.", "It passed. You stayed. Lovely."], honest: ["You waited it out. That's a skill.", "Quietly brilliant."], brutal: ["Good. That's the work."] },
    sassy: { gentle: ["Look at you, all disciplined.", "The craving lost. Obviously."], honest: ["Craving: zero. You: one.", "Told you it was all talk."], brutal: ["See? You don't have to obey it."] },
    wise: { gentle: ["Each wave you get through makes the next smaller.", "You were stronger than the moment."], honest: ["This is how habits change: one urge at a time.", "You chose. That matters."], brutal: ["You didn't give in. Remember this feeling."] },
    savage: { gentle: ["Craving: ghosted. Iconic."], honest: ["The urge showed up, got ignored and left. Love that for us."], brutal: ["Urge zero, you one. Rub it in."] },
  },
  petted: {
    playful: { gentle: ["Again! Again!", "That's my favourite spot!"], honest: ["Ooh, right there.", "More of that, please."], brutal: ["Okay, that's nice. Don't stop."] },
    calm: { gentle: ["Mm. That's lovely.", "I could sleep like this."], honest: ["That helps.", "Nice and slow. Good."], brutal: ["Fine. That's nice."] },
    sassy: { gentle: ["I suppose I'll allow it.", "Acceptable. Continue."], honest: ["You may continue.", "Mm, yes. That's the spot."], brutal: ["Fine, I like it. Keep going."] },
    wise: { gentle: ["A small kindness goes a long way.", "Thank you. I feel that."], honest: ["Care given is care returned.", "Steady hands. Good."], brutal: ["Kindness to me is easy. Be that kind to yourself."] },
    savage: { gentle: ["Fine. Yes. Don't make it weird."], honest: ["A bribe? Accepted."], brutal: ["Keep going. I'll pretend I don't care."] },
  },
  giggle: {
    playful: { gentle: ["Hee! That tickles!", "Stop it! No, don't stop!"], honest: ["Ha! Tickle war!", "You found the ticklish bit."], brutal: ["Hah! Okay, you win."] },
    calm: { gentle: ["Oh! Hehe.", "Gentle, gentle. Hehe."], honest: ["That tickles a bit.", "Hm, ticklish."], brutal: ["Ticklish. Moving on."] },
    sassy: { gentle: ["Excuse me. Hehe.", "Hey! Also, do it again."], honest: ["The belly is off limits. Mostly.", "Bold move."], brutal: ["Hey! Okay, okay, that tickles."] },
    wise: { gentle: ["Laughter is medicine, they say.", "Hehe. Even old souls giggle."], honest: ["A laugh resets the day.", "Hm. Joy is allowed."], brutal: ["Laugh. Then get back to it."] },
    savage: { gentle: ["Hey! I have a reputation."], honest: ["Tickling a beast. Bold."], brutal: ["Do that again and I'll… let you. Ugh."] },
  },
  dizzy: {
    playful: { gentle: ["Whoa, the room is spinning!", "Okay okay, I'm awake!"], honest: ["Too many pokes! Dizzy!", "Brain. Scrambled."], brutal: ["Whoa, dizzy! Gentle, please."] },
    calm: { gentle: ["Easy now. Breathe.", "Slow down, friend."], honest: ["That's a lot of poking.", "Too fast. I'm dizzy."], brutal: ["Slow down, I'm dizzy."] },
    sassy: { gentle: ["Was that necessary?", "I'm filing a complaint."], honest: ["Poke me once more. I dare you.", "Okay, okay!"], brutal: ["Too much poking! A check-in would be nicer."] },
    wise: { gentle: ["Patience, little one.", "Everything in moderation. Even poking."], honest: ["Restless hands. Restless mind?", "Slow. Breathe."], brutal: ["Restless hands? Let's keep them busy tonight."] },
    savage: { gentle: ["I'm a pet, not a stress ball."], honest: ["Poke me again and I'm unionising."], brutal: ["Stop poking. Go check in. Productive fingers."] },
  },
  stroke: {
    playful: { gentle: ["Best. Human. Ever.", "Purr mode activated!"], honest: ["This is the good stuff.", "Mmm, more!"], brutal: ["Okay, that's the good stuff."] },
    calm: { gentle: ["Mmm. Peaceful.", "This is all I need."], honest: ["That's calming.", "Nice and slow."], brutal: ["That's good. Keep it calm."] },
    sassy: { gentle: ["Fine, I'm purring. Tell no one.", "My reputation is ruined."], honest: ["Okay, that one was good.", "You're getting better at this."], brutal: ["Good. You're good at caring. Keep it up."] },
    wise: { gentle: ["Gentle hands, gentle heart.", "Calm is contagious."], honest: ["This is how healing feels.", "Slow is good."], brutal: ["Gentle hands. Be just as kind to yourself."] },
    savage: { gentle: ["Okay, this is elite. Tell no one."], honest: ["Elite petting. Ten out of ten, no notes."], brutal: ["Fine. You're good at this. Annoyingly good."] },
  },
  cleanThanks: {
    playful: { gentle: ["Thank you for today! I feel bouncy!", "You did it! I'm so happy!"], honest: ["Goal met! I can feel it working!", "A good day for both of us. I feel better!"], brutal: ["One goal-met day. Let's do it again tomorrow."] },
    calm: { gentle: ["Thank you. I feel a little better.", "A quiet, good day. Thank you."], honest: ["Goal met today. I'm healing.", "That helped. I can feel it."], brutal: ["Goal met. Here's to the next one."] },
    sassy: { gentle: ["Look at you, keeping promises.", "Okay, I'm impressed. Slightly."], honest: ["Goal met. I feel better, not that I'll admit it.", "Good day. Who are you?"], brutal: ["Goal met. Okay, I'm proud. A little."] },
    wise: { gentle: ["Thank you. Every good day counts.", "You kept your word. I feel it."], honest: ["Goal met today. I'm getting better.", "One more day kept. It adds up."], brutal: ["You kept your word today. Tomorrow is another chance to."] },
    savage: { gentle: ["Goal met. Look at us, thriving."], honest: ["Goal met. I feel fantastic and, frankly, I look it."], brutal: ["Goal met. The habit got nothing today. Delicious."] },
  },
  shrug: {
    playful: { gentle: ["We've had {d} good days. I'm okay, really!", "One wobble after {d} days? I'm still bouncy!"], honest: ["{d} good days. One slip doesn't undo that. I'm fine.", "I'm strong from {d} good days. I'll shake it off."], brutal: ["{d} good days kept me strong. Let's rebuild that cushion."] },
    calm: { gentle: ["After {d} good days, I'm all right. Rest.", "I'm okay. {d} days made me strong."], honest: ["{d} days of good care. I can absorb one slip.", "I'm fine. Those {d} days count."], brutal: ["{d} days of care covered this one. Let's get back on track."] },
    sassy: { gentle: ["{d} days in? I barely noticed. Barely.", "I'm fine. {d} days of care left me sturdy."], honest: ["{d} days of care made me tough. I'll shrug this one off.", "Shrugged it off. {d} days of practice."], brutal: ["{d} days of care left me strong. I'm fine. Let's top it up."] },
    wise: { gentle: ["One stumble on a long road. {d} good days hold me up.", "I'm well. {d} days of care."], honest: ["{d} days built a cushion, and it held. It's thinner now.", "{d} days of care softened this one."], brutal: ["{d} days of care held me up. Back to your plan now."] },
    savage: { gentle: ["{d} good days made me sturdy. That barely tickled."], honest: ["{d} days of care? I'm built different. Shrugged it off."], brutal: ["{d} good days bought me armour. It's dented now. Refill it."] },
  },
  binge: {
    playful: { gentle: ["That was a lot today. I need rest.", "Ow. Too much at once."], honest: ["That was a lot. It took years off me.", "Too much today. That one leaves a mark."], brutal: ["That was a lot at once. Some of it will stay, but I'm still here."] },
    calm: { gentle: ["That was heavy. Let's rest tomorrow.", "Too much today. I'm tired."], honest: ["That much in one day leaves a mark. I'll carry it.", "Heavy day. Some of it stays."], brutal: ["Hard day. Some of it stays. Tomorrow we start again."] },
    sassy: { gentle: ["Well, that was a big one.", "That was… a lot. I'm still here."], honest: ["That was a heavy day. I'm still on your side.", "Some of that stays with me. We keep going."], brutal: ["That one leaves a mark. Let's make tomorrow different."] },
    wise: { gentle: ["Storms pass. Some leave marks.", "Rest now. Tomorrow, begin again."], honest: ["Some of that stays. What comes next still matters.", "A hard day leaves a mark. It doesn't define the road."], brutal: ["That took some years. What comes next can give some back."] },
    savage: { gentle: ["Okay, that was a lot. I'm lying down for a bit."], honest: ["Heavy one. I'll wear it for a while. Still here, still fabulous."], brutal: ["Big day for the habit, bad day for my looks. Tomorrow we fight back."] },
  },
  slip: {
    playful: { gentle: ["Oof. I'll be okay. Will you?", "That one hurt a little."], honest: ["Ouch. That one stung.", "That hurt. I'm going to sit down."], brutal: ["Ow. That one hurt. Let's stop for today."] },
    calm: { gentle: ["It's all right. Breathe.", "I felt that. We'll be okay."], honest: ["That hurt. Let's not do it again today.", "I'm tired now."], brutal: ["That hurt a little. Let's rest and reset."] },
    sassy: { gentle: ["Okay. It happened. I'm still here.", "Noted. Snacks for the soul later."], honest: ["Noted. We bounce back from this.", "Okay. Now we know. Moving on."], brutal: ["Oof. Tomorrow's a new page."] },
    wise: { gentle: ["A slip is not a fall.", "We begin again."], honest: ["A slip costs. Honesty helps.", "That hurt. Tomorrow can be different."], brutal: ["A slip is a lesson. Tonight can still be good."] },
    savage: { gentle: ["Ow. Rude, habit. Very rude."], honest: ["The habit just took a bite out of me. Noted. Petty revenge tomorrow."], brutal: ["The habit won that round. It doesn't get a rematch tonight."] },
  },
  away: {
    playful: { gentle: ["You're back! I counted {d} days. I'm bad at counting, so it felt like a hundred!"], honest: ["{d} days! I waited by the door. Check in and tell me everything!"], brutal: ["{d} days quiet. I'm thrilled you're here. Check in for today."] },
    calm: { gentle: ["Hello again. {d} quiet days. No catching up needed."], honest: ["{d} days without a check-in. Today is what counts."], brutal: ["{d} days quiet. Just record today."] },
    sassy: { gentle: ["Oh, you're back. I hardly noticed the {d} days. Hardly."], honest: ["{d} days. I reorganised my toys twice. Check in?"], brutal: ["{d} days of silence. Rude. Today still counts, so check in."] },
    wise: { gentle: ["{d} quiet days. The road is still here, and so am I."], honest: ["{d} days unrecorded. Nothing lost. Begin with today."], brutal: ["{d} days quiet. Don't count them. Count today."] },
    savage: { gentle: ["Oh look, you remembered I exist. {d} days. Today still counts."], honest: ["{d} days. I chewed a cushion out of pure boredom. Check in?"], brutal: ["{d} days of radio silence. I was about to print posters. Today counts. Check in."] },
  },
  awayLong: {
    playful: { gentle: ["{d} days! I practised my happy dance the whole time. No catching up needed."], honest: ["{d} days away! I'm so glad you're back. Just today, okay?"], brutal: ["{d} days. Welcome back. One check-in and we're rolling again."] },
    calm: { gentle: ["{d} days. I kept your spot warm. Start wherever you are."], honest: ["{d} days quiet. They don't count against you. Today does."], brutal: ["{d} days quiet. Record today and carry on."] },
    sassy: { gentle: ["{d} days? I aged a full minute. Kidding. Welcome back."], honest: ["{d} days. I've started talking to the houseplant. Check in and save us both."], brutal: ["{d} days gone. Dramatic exit, solid comeback. Check in for today."] },
    wise: { gentle: ["{d} days. Every return is a beginning."], honest: ["{d} quiet days. They're blanks, not black marks. Fill in today."], brutal: ["{d} days quiet. Leave them blank. Start with today."] },
    savage: { gentle: ["{d} days. I assumed you'd been abducted. Glad they returned you. Today counts."], honest: ["{d} days. I wrote you a strongly worded letter. Then ate it. Check in?"], brutal: ["{d} days. I was this close to selling your stuff. Kidding. Check in for today."] },
  },
  awayWeek: {
    playful: { gentle: ["You're here! {d} days felt so long. No catching up, just today!"], honest: ["{d} days! Welcome back! Those days don't count against you. Today does."], brutal: ["{d} days. You're back, that's what matters. Check in for today."] },
    calm: { gentle: ["{d} days. Welcome home. Nothing to make up."], honest: ["{d} days quiet. Nothing is lost. Start with today."], brutal: ["{d} days. Nothing to make up. Pick it up today."] },
    sassy: { gentle: ["{d} days? Fine. I'm over it. Mostly. Welcome back."], honest: ["{d} days. I almost redecorated. Quiet days don't count against you. Today does."], brutal: ["A whole {d} days. Iconic disappearance. Now check in for today."] },
    wise: { gentle: ["After {d} days, the door is still open."], honest: ["{d} days have passed. They don't count against you. Today can."], brutal: ["{d} days. Gone is gone. Today is here."] },
    savage: { gentle: ["{d} days! I assumed you'd joined a circus. Welcome back. Today counts."], honest: ["{d} days. I've been staring at the door like it owes me money. Check in for today."], brutal: ["{d} days gone. Quiet days don't count against you. Today does. Move."] },
  },
};

/** Every line the pet can say, by event, personality and voice. Exported so the copy inspector lists them all. */
export const PET_LINES: Record<Event, Lines> = L;

/**
 * One line for an event, picked at random so it never feels canned. `{d}` becomes `days`. A `seed` (say, today's
 * date) picks the same line every time instead, for text that is drawn again on every render.
 */
export function say(event: Event, personality: Personality | undefined, tone: Tone, days = 0, seed?: string): string {
  const byPersonality = L[event][personality ?? "playful"] ?? L[event].playful;
  const xs = byPersonality[tone] ?? byPersonality.honest;
  const i = seed === undefined ? Math.floor(Math.random() * xs.length) : [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % xs.length;
  return xs[i].replace("{d}", String(days));
}

/**
 * The line for coming back after quiet days in a row, or null under two. Quiet days are missing data (RECOVERY_RULES
 * rule 1): the pet is theatrical about the wait, never hurt or lonely, and every line says today still counts.
 */
export const awayEvent = (quiet: number): Event | null => (quiet >= 7 ? "awayWeek" : quiet >= 4 ? "awayLong" : quiet >= 2 ? "away" : null);

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

const CARE_EMOJI = { thanks: "💛", morning: "☀️", risk: "🌙" } as const;
/** Adds the person's name before the last full stop, "!" or "?": "Thank you for yesterday!" becomes "Thank you for yesterday, Jithu!". */
const toYou = (line: string, userName?: string): string => {
  const who = userName?.trim();
  if (!who) return line;
  return /[.!?]$/.test(line) ? line.replace(/([.!?])$/, `, ${who}$1`) : `${line}, ${who}`;
};
/** Notifications in the companion's voice. Title is the pet's name with an emoji; body speaks in first person, ends with an emoji and calls the person by name when it has one. */
export function careNote(kind: "thanks" | "morning" | "risk", personality: Personality | undefined, tone: Tone, name: string, userName?: string, own?: string): { title: string; body: string } {
  const e = CARE_EMOJI[kind];
  const out = (body: string) => ({ title: `${e} ${name}`, body: `${toYou(body, userName)} ${e}` });
  // The pet's own line for today (PRD §24), already validated; the hand-written lines below are the fallback.
  if (own?.trim()) return out(own.trim());
  if (kind === "thanks") return out(say("cleanThanks", personality, tone));
  const p = personality ?? "playful";
  if (kind === "risk") {
    const risk: Record<Personality, Record<Tone, string>> = {
      playful: { gentle: "This is usually a tricky hour. Want to hang out with me instead?", honest: "Heads up: this is when slips usually happen. Come say hi?", brutal: "This is your tricky hour. Make a plan now. I'm here." },
      calm: { gentle: "A gentle heads-up: this hour can be hard. I'm here.", honest: "This is usually the hard hour. Breathe with me if it comes.", brutal: "Hard hour coming. Have a plan." },
      sassy: { gentle: "It's that hour again. Let's be boring together.", honest: "Your usual slip o'clock. Let's not.", brutal: "Usual slip o'clock. Let's make tonight different." },
      wise: { gentle: "This hour has been hard before. It doesn't have to be tonight.", honest: "Patterns repeat until we change them. This is the hour.", brutal: "You know this hour. Decide now, not later." },
      savage: { gentle: "Heads up: your tricky hour. Let's be boring together. I'm great at boring.", honest: "Slip o'clock is near. I've seen this movie. Change the ending.", brutal: "Your usual slip hour. The habit's warming up. Don't show up for it." },
    };
    return out((risk[p] ?? risk.playful)[tone] ?? risk.playful.honest);
  }
  const morning: Record<Personality, Record<Tone, string>> = {
    playful: { gentle: "Slept so well! Thank you for yesterday!", honest: "Woke up feeling great. Yesterday went well!", brutal: "Good sleep. Yesterday went well. Repeat it." },
    calm: { gentle: "A good night's sleep. Thank you.", honest: "I slept well after a good day.", brutal: "Rested. Keep today on track too." },
    sassy: { gentle: "Slept like royalty. You may continue.", honest: "Best sleep in ages. Coincidence? No.", brutal: "Slept well. Let's keep today just as good." },
    wise: { gentle: "Rest comes easy after a kept promise.", honest: "A good day makes for a good sleep.", brutal: "Yesterday was kept. Today is new. Keep it." },
    savage: { gentle: "Slept like royalty. Yesterday did that.", honest: "Woke up gorgeous. Yesterday's goal did that.", brutal: "Slept great. Do yesterday again." },
  };
  return out((morning[p] ?? morning.playful)[tone] ?? morning.playful.honest);
}
