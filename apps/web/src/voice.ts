import type { Personality, Tone } from "./types";

/**
 * What the companion says, in its own voice. Personality decides how it talks; tone decides how blunt
 * it is about slips. Every line exists for all four personalities in all three tones.
 *
 * The psychology, briefly: clean days get an immediate, warm, slightly unpredictable reward (variable
 * reinforcement); a slip costs something the person cares about (the pet won't eat), but always comes
 * with a way back (recovery plan), because shame after a slip makes people give up entirely
 * (the abstinence violation effect). The pet is hurt by the behaviour, never disgusted by the person.
 */
export type Event =
  | "petted" | "giggle" | "dizzy" | "stroke"
  | "fed" | "full" | "strike" | "treat" | "noTreats"
  | "cleanThanks" | "shrug" | "binge" | "slip" | "rodeOut" | "urgeStart";

type Lines = Record<Personality, Record<Tone, string[]>>;

const L: Record<Event, Lines> = {
  urgeStart: {
    playful: { gentle: ["I'm right here. Breathe with me!", "Let's wait it out together!"], honest: ["It'll pass. Breathe with me.", "Two minutes. You and me."], brutal: ["Don't. Breathe with me instead."] },
    calm: { gentle: ["In, and out. I'm here.", "Slow breaths. It passes."], honest: ["Breathe. The wave peaks and falls.", "Stay with me for two minutes."], brutal: ["Sit with it. Don't act on it."] },
    sassy: { gentle: ["Ugh, cravings. Let's ignore it together.", "Breathe. Be dramatic later."], honest: ["Watch it fizzle. Breathe.", "It's loud, not in charge."], brutal: ["Not today. Breathe."] },
    wise: { gentle: ["Notice it. You don't have to obey it.", "An urge is a wave. Let it pass."], honest: ["Urges rise and fall. Ride this one.", "Breathe. Watch it change."], brutal: ["A craving is a request, not an order."] },
  },
  rodeOut: {
    playful: { gentle: ["You did it! I'm so proud!", "Wave surfed! High five!"], honest: ["It passed and you didn't! Amazing!", "That's how it's done!"], brutal: ["That's a win. Count it."] },
    calm: { gentle: ["Well done. That was strong.", "It passed. You stayed. Lovely."], honest: ["You waited it out. That's a skill.", "Quietly brilliant."], brutal: ["Good. That's the work."] },
    sassy: { gentle: ["Look at you, all disciplined.", "The craving lost. Obviously."], honest: ["Craving: zero. You: one.", "Told you it was all talk."], brutal: ["See? You don't have to obey it."] },
    wise: { gentle: ["Each wave ridden makes the next smaller.", "You were stronger than the moment."], honest: ["This is how habits change: one urge at a time.", "You chose. That matters."], brutal: ["You didn't give in. Remember this feeling."] },
  },
  petted: {
    playful: { gentle: ["Again! Again!", "That's my favourite spot!"], honest: ["Ooh, right there.", "More of that, please."], brutal: ["Okay, that's nice. Don't stop."] },
    calm: { gentle: ["Mm. That's lovely.", "I could sleep like this."], honest: ["That helps.", "Nice and slow. Good."], brutal: ["Fine. That's nice."] },
    sassy: { gentle: ["I suppose I'll allow it.", "Acceptable. Continue."], honest: ["You may continue.", "Took you long enough."], brutal: ["Don't get sentimental. Keep going."] },
    wise: { gentle: ["A small kindness goes a long way.", "Thank you. I feel that."], honest: ["Care given is care returned.", "Steady hands. Good."], brutal: ["Kindness to me is easy. Be that kind to yourself."] },
  },
  giggle: {
    playful: { gentle: ["Hee! That tickles!", "Stop it! No, don't stop!"], honest: ["Ha! Tickle war!", "You found the ticklish bit."], brutal: ["Hah! Okay, you win."] },
    calm: { gentle: ["Oh! Hehe.", "Gentle, gentle. Hehe."], honest: ["That tickles a bit.", "Hm, ticklish."], brutal: ["Ticklish. Moving on."] },
    sassy: { gentle: ["Excuse me. Hehe.", "Rude. Also, do it again."], honest: ["The belly is off limits. Mostly.", "Bold move."], brutal: ["Poke me like that again and see."] },
    wise: { gentle: ["Laughter is medicine, they say.", "Hehe. Even old souls giggle."], honest: ["A laugh resets the day.", "Hm. Joy is allowed."], brutal: ["Laugh. Then get back to it."] },
  },
  dizzy: {
    playful: { gentle: ["Whoa, the room is spinning!", "Okay okay, I'm awake!"], honest: ["Too many pokes! Dizzy!", "Brain. Scrambled."], brutal: ["Enough poking. I'm dizzy."] },
    calm: { gentle: ["Easy now. Breathe.", "Slow down, friend."], honest: ["That's a lot of poking.", "Too fast. I'm dizzy."], brutal: ["Stop. I'm dizzy."] },
    sassy: { gentle: ["Was that necessary?", "I'm filing a complaint."], honest: ["Poke me once more. I dare you.", "Wow. Okay."], brutal: ["You poke me more than you check in."] },
    wise: { gentle: ["Patience, little one.", "Everything in moderation. Even poking."], honest: ["Restless hands. Restless mind?", "Slow. Breathe."], brutal: ["Restless hands. Watch them tonight."] },
  },
  stroke: {
    playful: { gentle: ["Best. Human. Ever.", "Purr mode activated!"], honest: ["This is the good stuff.", "Mmm, more!"], brutal: ["Okay, you're forgiven. Mostly."] },
    calm: { gentle: ["Mmm. Peaceful.", "This is all I need."], honest: ["That's calming.", "Nice and slow."], brutal: ["That's good. Keep it calm."] },
    sassy: { gentle: ["Fine, I'm purring. Tell no one.", "My reputation is ruined."], honest: ["Okay, that one was good.", "You're getting better at this."], brutal: ["Good. Now do the hard part too."] },
    wise: { gentle: ["Gentle hands, gentle heart.", "Calm is contagious."], honest: ["This is how healing feels.", "Slow is good."], brutal: ["You can be gentle. Be gentle with tomorrow."] },
  },
  fed: {
    playful: { gentle: ["Nom nom nom! Thank you!", "Yum! Best meal ever!"], honest: ["Food! You kept your word today.", "Crunch crunch. Good day."], brutal: ["Eating. Because you earned it today."] },
    calm: { gentle: ["Thank you. That was lovely.", "A warm meal. A good day."], honest: ["Thanks. I'm eating well today.", "Good food, quiet day."], brutal: ["I'll eat. Today was clean."] },
    sassy: { gentle: ["Finally, room service.", "Delicious. You may stay."], honest: ["Not bad. Same time tomorrow.", "Five stars. Clean day too."], brutal: ["I'll eat. Don't make me skip tomorrow."] },
    wise: { gentle: ["Nourished. Thank you.", "Small meals, good habits."], honest: ["We both eat better on good days.", "Well fed, well kept."], brutal: ["You fed me well by keeping your word."] },
  },
  full: {
    playful: { gentle: ["I'm stuffed! Maybe later!", "So full! Belly rubs instead?"], honest: ["Already ate! Treat, though?", "Full! Thanks!"], brutal: ["Already fed. Give me a clean day instead."] },
    calm: { gentle: ["I'm full, thank you.", "No more for now."], honest: ["I've eaten today.", "Full. Thanks."], brutal: ["Full. Keep the day clean."] },
    sassy: { gentle: ["Are you trying to roll me home?", "I have a figure to maintain."], honest: ["I already ate. Pay attention.", "Twice? Who am I?"], brutal: ["Food doesn't fix things. Clean days do."] },
    wise: { gentle: ["Enough is a feast.", "Full and grateful."], honest: ["Enough is enough. For both of us.", "I've had my share."], brutal: ["More is not better. You know that."] },
  },
  strike: {
    playful: { gentle: ["I'm not hungry today. Tomorrow?", "Not today. I just feel a bit off."], honest: ["I'm not eating today. Not after that.", "No food. I'm too upset."], brutal: ["You broke your word. I'm not eating until you stop."] },
    calm: { gentle: ["I'll skip today. I'll be okay.", "No appetite today. Let's try tomorrow."], honest: ["I can't eat today. It hurt.", "Not today. Give me a clean day."], brutal: ["No. Not until you stop doing it."] },
    sassy: { gentle: ["I'm on strike. A small one.", "Not hungry. Guess why."], honest: ["Hunger strike. You know the demands.", "I'll eat when you keep your promise."], brutal: ["Funny. You indulge, I starve. I'll eat when you stop."] },
    wise: { gentle: ["I'll fast today. Tomorrow is new.", "Some days we both go without."], honest: ["I won't eat on a day you didn't keep your word.", "A promise broken spoils the meal."], brutal: ["You said you'd stop. Until you do, I won't eat."] },
  },
  treat: {
    playful: { gentle: ["A treat!! You're the best!", "Yay! Treat dance!"], honest: ["Treat earned, treat eaten!", "Yes! From the clean-day jar!"], brutal: ["One treat per clean day. Fair trade."] },
    calm: { gentle: ["Oh, thank you. Lovely.", "A little treat. How kind."], honest: ["That one was earned.", "Thank you. Clean days taste good."], brutal: ["Earned. Thank you."] },
    sassy: { gentle: ["Bribery works. Thank you.", "You know the way to my heart."], honest: ["Paid in treats. Excellent.", "A clean-day treat. Classy."], brutal: ["Good. Keep earning them."] },
    wise: { gentle: ["The sweetest things are earned.", "Thank you, friend."], honest: ["Each treat is a day you kept.", "Earned joy is the best kind."], brutal: ["You earned this one. Keep earning."] },
  },
  noTreats: {
    playful: { gentle: ["Jar's empty! A clean day fills it!", "No treats yet. Tomorrow?"], honest: ["Empty jar. Clean days add treats.", "None left! Earn one tomorrow?"], brutal: ["No clean days, no treats."] },
    calm: { gentle: ["No treats left. That's okay.", "The jar is empty for now."], honest: ["Out of treats. A clean day adds one.", "None left."], brutal: ["Empty. Earn the next one."] },
    sassy: { gentle: ["The jar is tragically empty.", "No treats? Scandalous."], honest: ["Treats come from clean days. Do the math.", "Empty. Hint, hint."], brutal: ["Treats aren't free. Clean days are the price."] },
    wise: { gentle: ["Patience. The jar will fill.", "Nothing yet. That's all right."], honest: ["Clean days fill the jar.", "The jar waits for good days."], brutal: ["Earn it first."] },
  },
  cleanThanks: {
    playful: { gentle: ["Thank you for today! I feel bouncy!", "You did it! I'm so happy!"], honest: ["Clean day! I can feel it working!", "Thanks for not doing it today. I feel better!"], brutal: ["One clean day. Do it again tomorrow."] },
    calm: { gentle: ["Thank you. I feel a little better.", "A quiet, good day. Thank you."], honest: ["Thanks for not doing it today. I'm healing.", "That helped. I can feel it."], brutal: ["Good. One day. Now the next."] },
    sassy: { gentle: ["Look at you, keeping promises.", "Okay, I'm impressed. Slightly."], honest: ["Thanks for not doing it. I feel better, not that I'll admit it.", "Clean day. Who are you?"], brutal: ["Clean. Don't let it go to your head."] },
    wise: { gentle: ["Thank you. Every good day counts.", "You kept your word. I feel it."], honest: ["Thanks for not doing it today. I'm getting better.", "One more day kept. It adds up."], brutal: ["You kept your word today. Keep it tomorrow."] },
  },
  shrug: {
    playful: { gentle: ["We've had {d} good days. I'm okay, really!", "One wobble after {d} days? I'm still bouncy!"], honest: ["{d} days clean. One slip doesn't undo that. I'm fine.", "I'm strong from {d} good days. I'll shake it off."], brutal: ["{d} good days kept me strong. Don't spend them all."] },
    calm: { gentle: ["After {d} good days, I'm all right. Rest.", "I'm okay. {d} days made me strong."], honest: ["{d} days of good care. I can absorb one slip.", "I'm fine. Those {d} days count."], brutal: ["{d} days bought you this one. Only this one."] },
    sassy: { gentle: ["{d} days in? I barely noticed. Barely.", "I'm fine. I have {d} days of savings."], honest: ["I've got {d} days of credit. You just spent some.", "Shrugged it off. {d} days of practice."], brutal: ["You had {d} days of credit. Now you have less."] },
    wise: { gentle: ["One stumble on a long road. {d} good days hold me up.", "I'm well. {d} days of care."], honest: ["{d} days built a cushion. It held. Rebuild it.", "{d} days of streak forgave one slip. Not two."], brutal: ["{d} days carried you. Don't make them carry more."] },
  },
  binge: {
    playful: { gentle: ["That was a lot today. I need rest.", "Ow. Too much at once."], honest: ["That was a lot. It took years off me.", "Too much today. That one leaves a mark."], brutal: ["That was a binge. That one leaves a scar."] },
    calm: { gentle: ["That was heavy. Let's rest tomorrow.", "Too much today. I'm tired."], honest: ["That much in one day scars. I'll carry it.", "Heavy day. Some of it stays."], brutal: ["You lost control today. That damage stays."] },
    sassy: { gentle: ["Well, that escalated.", "That was... a lot."], honest: ["That wasn't a slip. That was a slide.", "Some of that doesn't heal, you know."], brutal: ["That's a scar now. Proud?"] },
    wise: { gentle: ["Storms pass. Some leave marks.", "Rest now. Tomorrow, begin again."], honest: ["Some damage stays. What comes next still matters.", "A hard day leaves a mark."], brutal: ["That took years. Don't let it take more."] },
  },
  slip: {
    playful: { gentle: ["Oof. I'll be okay. Will you?", "That one hurt a little."], honest: ["Ouch. That one stung.", "That hurt. I'm going to sit down."], brutal: ["Ow. You said you'd stop."] },
    calm: { gentle: ["It's all right. Breathe.", "I felt that. We'll be okay."], honest: ["That hurt. Let's not do it again today.", "I'm tired now."], brutal: ["That one hurt. Stop for today."] },
    sassy: { gentle: ["Really? Okay.", "Noted. Sigh."], honest: ["Wow. Okay. Noted.", "I saw that."], brutal: ["You promised. I remember."] },
    wise: { gentle: ["A slip is not a fall.", "We begin again."], honest: ["A slip costs. Honesty helps.", "That hurt. Tomorrow can be different."], brutal: ["You know what this costs. Choose better tonight."] },
  },
};

/** One line for an event, picked at random so it never feels canned. `{d}` becomes `days`. */
export function say(event: Event, personality: Personality | undefined, tone: Tone, days = 0): string {
  const xs = L[event][personality ?? "playful"][tone];
  return xs[Math.floor(Math.random() * xs.length)].replace("{d}", String(days));
}

/** The next step back to health, in tone. Numbers come from the engine. */
export function recoveryLine(tone: Tone, name: string, undo: number, stage: { days: number; label: string } | null): string {
  const d = (n: number) => `${n} clean ${n === 1 ? "day" : "days"}`;
  const back = stage ? ` ${d(stage.days)} in a row and ${name} is ${stage.label.toLowerCase()} again.` : "";
  if (tone === "gentle") return `${d(undo)} undoes today.${back}`;
  if (tone === "brutal") return `That costs ${d(undo)} to undo.${back} No shortcuts.`;
  return `${d(undo)} in a row undoes today.${back}`;
}

/** Notifications in the companion's voice. Title is the pet's name; body speaks in first person. */
export function careNote(kind: "thanks" | "strike" | "morning" | "risk", personality: Personality | undefined, tone: Tone, name: string): { title: string; body: string } {
  if (kind === "thanks") return { title: name, body: say("cleanThanks", personality, tone) };
  if (kind === "strike") return { title: `${name} hasn't eaten`, body: say("strike", personality, tone) };
  const p = personality ?? "playful";
  if (kind === "risk") {
    const risk: Record<Personality, Record<Tone, string>> = {
      playful: { gentle: "This is usually a tricky hour. Want to hang out with me instead?", honest: "Heads up: this is when slips usually happen. Come say hi?", brutal: "This is your weak hour. Don't. Come see me." },
      calm: { gentle: "A gentle heads-up: this hour can be hard. I'm here.", honest: "This is usually the hard hour. Breathe with me if it comes.", brutal: "Hard hour coming. Have a plan." },
      sassy: { gentle: "It's that hour again. Let's be boring together.", honest: "Your usual slip o'clock. Let's not.", brutal: "Slip o'clock. Prove me wrong." },
      wise: { gentle: "This hour has been hard before. It doesn't have to be tonight.", honest: "Patterns repeat until we change them. This is the hour.", brutal: "You know this hour. Decide now, not later." },
    };
    return { title: name, body: risk[p][tone] };
  }
  const morning: Record<Personality, Record<Tone, string>> = {
    playful: { gentle: "Slept so well! Thank you for yesterday!", honest: "Woke up feeling great. Yesterday was clean!", brutal: "Good sleep. Yesterday was clean. Repeat it." },
    calm: { gentle: "A good night's sleep. Thank you.", honest: "I slept well after a clean day.", brutal: "Rested. Keep today clean too." },
    sassy: { gentle: "Slept like royalty. You may continue.", honest: "Best sleep in ages. Coincidence? No.", brutal: "Slept well. Don't ruin it today." },
    wise: { gentle: "Rest comes easy after a kept promise.", honest: "A clean day makes for a clean sleep.", brutal: "Yesterday was kept. Today is new. Keep it." },
  };
  return { title: name, body: morning[p][tone] };
}
