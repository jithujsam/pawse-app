import type { Stage } from "@detox/engine";
import { STAGE_LABEL } from "@detox/engine";
import {
  absorbedLine, bingeLine, cleanLine, cleanToast, deathLine, dyingBanner, greeting, hatchLine, milestoneLine, pauseHint, pauseRefused, pausedLine,
  pauseToast, quietBanner, reminderLine, restrictionNoteSample, resumeHint, resumeToast, slipLine, statusLine, tonePreview, verdict, waitingLine, welcomeBackLine,
} from "../copy";
import { PET_LINES, recoveryLine, type Event } from "../voice";
import { afterSlipLine, lapseHeadline, progressKept, restLine, urgeActedLine, urgeActedNote, urgeManagedLine, urgePauseLine, STATUS_LABEL, STRATEGIES, GOALS, REASONS, SITUATIONS, FIRST_STEPS, REPLACEMENTS } from "../recovery";
import { AMOUNT_CHOICES, HABIT_CHOICES, MOODS, starterFields } from "../questions";
import { CONDITION_TEXT } from "../health";
import { ACCESSORIES, COATS, NAMES, PERSONALITIES, SPECIES } from "../pets";
import { STYLE_3D } from "../pet3d-support";
import { BASELINES } from "../screens/Onboarding";
import { SAVING_FOR } from "../screens/Report";
import { CURRENCIES } from "../screens/Me";
import type { Personality, Tone } from "../types";

/**
 * Text that code builds rather than one fixed string: lines that depend on the Voice or on numbers, and the lists of
 * choices. It lives where the logic is (the file named in `source`), and is listed here so nothing is invisible.
 * The inspector shows these as "generated": the samples are computed from the real functions, so they can't drift.
 */
export interface GeneratedLine { id: string; group: "generated" | "pet-speech" | "lists"; title: string; source: string; /** One rendered sample per Voice, or one text for all. */ samples: Partial<Record<Tone, string[]>> | string[] }

const TONES: Tone[] = ["gentle", "honest", "brutal"];
const per = (f: (t: Tone) => string | string[]): GeneratedLine["samples"] => Object.fromEntries(TONES.map((t) => [t, ([] as string[]).concat(f(t))])) as Partial<Record<Tone, string[]>>;
const N = "Biscuit";
const STAGES: Stage[] = ["baby", "young", "adult", "middle", "old", "frail", "dead"];

export const generated = (): GeneratedLine[] => [
  { id: "pet.slip_line", group: "generated", title: "Slip result sentence", source: "src/copy.ts slipLine", samples: per((t) => [slipLine(t, N, 4, 1), slipLine(t, N, 2.5, 3)]) },
  { id: "pet.clean_line", group: "generated", title: "Goal met, on the pet screen", source: "src/copy.ts cleanLine", samples: per((t) => [cleanLine(t, N, 1), cleanLine(t, N, 5)]) },
  { id: "pet.clean_toast", group: "generated", title: "Goal met, toast", source: "src/copy.ts cleanToast", samples: per((t) => cleanToast(t, N)) },
  { id: "pet.status_line", group: "generated", title: "How the pet is, by stage", source: "src/copy.ts statusLine", samples: per((t) => STAGES.map((s) => `${STAGE_LABEL[s]}: ${statusLine(t, N, s)}`)) },
  { id: "pet.waiting_line", group: "generated", title: "Waiting for a check-in", source: "src/copy.ts waitingLine", samples: per((t) => waitingLine(t, N)) },
  { id: "pet.welcome_back", group: "generated", title: "After a few quiet days", source: "src/copy.ts welcomeBackLine", samples: per((t) => welcomeBackLine(t, N)) },
  { id: "pet.death_line", group: "generated", title: "When the pet dies (classic rules)", source: "src/copy.ts deathLine", samples: per((t) => deathLine(t, N)) },
  { id: "pet.dying_banner", group: "generated", title: "Very frail banner", source: "src/copy.ts dyingBanner", samples: per((t) => dyingBanner(t, N, 92)) },
  { id: "pet.absorbed_line", group: "generated", title: "A slip the pet's strength absorbed", source: "src/copy.ts absorbedLine", samples: per((t) => [absorbedLine(t, N, 12, 3, true), absorbedLine(t, N, 12, 1, false), absorbedLine(t, N, 12, 2.5, false)]) },
  { id: "pet.heavy_day", group: "generated", title: "A heavy day (3 or more slips)", source: "src/copy.ts bingeLine", samples: per((t) => bingeLine(t, N)) },
  { id: "pet.quiet_banner", group: "generated", title: "After quiet days", source: "src/copy.ts quietBanner", samples: per((t) => quietBanner(t, N)) },
  { id: "pet.greeting", group: "generated", title: "Greeting by time of day", source: "src/copy.ts greeting", samples: per((t) => [greeting(t, 9, "Asha"), greeting(t, 23, "Asha"), greeting(t, 14)]) },
  { id: "pet.milestone", group: "generated", title: "Milestone", source: "src/copy.ts milestoneLine", samples: per((t) => { const m = milestoneLine(t, N, 7); return `${m.title}: ${m.body}`; }) },
  { id: "pet.hatch", group: "generated", title: "Hatching", source: "src/copy.ts hatchLine", samples: per((t) => hatchLine(t, N)) },
  { id: "pet.tone_preview", group: "generated", title: "Voice preview", source: "src/copy.ts tonePreview", samples: per((t) => tonePreview(t, N)) },
  { id: "pet.reminder", group: "generated", title: "Daily reminder notification", source: "src/copy.ts reminderLine (text in notifications.daily)", samples: per((t) => { const r = reminderLine(t, N); return `${r.title}: ${r.body}`; }) },
  { id: "tracks.pause_hint", group: "generated", title: "What pausing does", source: "src/copy.ts pauseHint", samples: per((t) => pauseHint(t)) },
  { id: "tracks.resume_hint", group: "generated", title: "What resuming does", source: "src/copy.ts resumeHint", samples: per((t) => resumeHint(t)) },
  { id: "tracks.paused_line", group: "generated", title: "Pet while paused", source: "src/copy.ts pausedLine", samples: per((t) => pausedLine(t, N)) },
  { id: "tracks.pause_toast", group: "generated", title: "Paused toast", source: "src/copy.ts pauseToast", samples: per((t) => pauseToast(t, N)) },
  { id: "tracks.resume_toast", group: "generated", title: "Resumed toast", source: "src/copy.ts resumeToast", samples: per((t) => resumeToast(t)) },
  { id: "tracks.pause_refused", group: "generated", title: "Pause or resume refused", source: "src/copy.ts pauseRefused", samples: per((t) => pauseRefused(t)) },
  { id: "insights.verdict", group: "generated", title: "This week against last week", source: "src/copy.ts verdict", samples: per((t) => [verdict(t, 0, 0), verdict(t, 0, 3), verdict(t, 2, 0), verdict(t, 1, 3), verdict(t, 3, 3), verdict(t, 4, 2)]) },
  { id: "recovery.lapse_headline", group: "generated", title: "After a slip is logged", source: "src/recovery.ts lapseHeadline", samples: per((t) => lapseHeadline(t, N)) },
  { id: "recovery.progress_kept", group: "generated", title: "What still stands after a slip", source: "src/recovery.ts progressKept", samples: per((t) => [progressKept(t, 5, 2), progressKept(t, 0, 0)]) },
  { id: "recovery.after_slip", group: "generated", title: "Pet later on a slip day", source: "src/recovery.ts afterSlipLine", samples: per((t) => afterSlipLine(t, N)) },
  { id: "recovery.rest_line", group: "generated", title: "Not tracking today", source: "src/recovery.ts restLine", samples: per((t) => restLine(t)) },
  { id: "recovery.way_back", group: "generated", title: "The way back after a slip", source: "src/voice.ts recoveryLine", samples: per((t) => [recoveryLine(t, N, 3, { days: 12, label: "Young" }), recoveryLine(t, N, 1, null)]) },
  { id: "urge.pause", group: "generated", title: "Urge: the pause", source: "src/recovery.ts urgePauseLine", samples: per((t) => urgePauseLine(t)) },
  { id: "urge.managed", group: "generated", title: "Urge: managed", source: "src/recovery.ts urgeManagedLine", samples: per((t) => urgeManagedLine(t, N)) },
  { id: "urge.acted", group: "generated", title: "Urge: acted on", source: "src/recovery.ts urgeActedLine", samples: per((t) => urgeActedLine(t)) },
  { id: "urge.acted_note", group: "generated", title: "Urge: acted on, note", source: "src/recovery.ts urgeActedNote", samples: per((t) => urgeActedNote(t)) },
  { id: "safety.restriction_sample", group: "generated", title: "Food and weight note (same in every Voice)", source: "src/copy.ts RESTRICTION_NOTE", samples: [restrictionNoteSample()] },
];

const PERSONALITY_IDS: Personality[] = ["playful", "calm", "sassy", "wise"];
/** Every line the pet can say, as written in src/voice.ts. */
export const petSpeech = (): GeneratedLine[] =>
  (Object.keys(PET_LINES) as Event[]).flatMap((event) => PERSONALITY_IDS.map((p) => ({
    id: `voice.${event}.${p}`, group: "pet-speech" as const, title: `Pet says on "${event}" (${p})`, source: "src/voice.ts PET_LINES",
    samples: Object.fromEntries(TONES.map((t) => [t, PET_LINES[event][p][t]])) as Partial<Record<Tone, string[]>>,
  })));

/** The lists of choices the app offers. */
export const lists = (): GeneratedLine[] => [
  { id: "lists.habits", group: "lists", title: "What people want to change", source: "src/questions.ts HABIT_CHOICES", samples: [...HABIT_CHOICES] },
  { id: "lists.amounts", group: "lists", title: "What to count each time", source: "src/questions.ts AMOUNT_CHOICES", samples: AMOUNT_CHOICES.map((a) => a.label) },
  { id: "lists.moods", group: "lists", title: "What was going on (slip question)", source: "src/questions.ts MOODS", samples: MOODS.map((m) => `${m.label} (${m.chip})`) },
  { id: "lists.situations", group: "lists", title: "Hard situations", source: "src/recovery.ts SITUATIONS", samples: [...SITUATIONS] },
  { id: "lists.reasons", group: "lists", title: "Reasons it matters", source: "src/recovery.ts REASONS", samples: [...REASONS] },
  { id: "lists.goals", group: "lists", title: "Goals", source: "src/recovery.ts GOALS", samples: GOALS.map((g) => `${g.label}: ${g.hint}`) },
  { id: "lists.first_steps", group: "lists", title: "First steps, by kind of habit", source: "src/recovery.ts FIRST_STEPS", samples: Object.entries(FIRST_STEPS).map(([k, v]) => `${k}: ${v.join(" / ")}`) },
  { id: "lists.strategies", group: "lists", title: "Ways through an urge", source: "src/recovery.ts STRATEGIES", samples: STRATEGIES.map((s) => `${s.title} (${s.hint}): ${s.steps.join(" ")}`) },
  { id: "lists.replacements", group: "lists", title: "Something else to do", source: "src/recovery.ts REPLACEMENTS", samples: [...REPLACEMENTS] },
  { id: "lists.status_labels", group: "lists", title: "Day status labels", source: "src/recovery.ts STATUS_LABEL", samples: Object.entries(STATUS_LABEL).map(([k, v]) => `${k}: ${v}`) },
  { id: "lists.stages", group: "lists", title: "Life stages", source: "packages/engine STAGE_LABEL", samples: STAGES.map((s) => STAGE_LABEL[s]) },
  { id: "lists.baselines", group: "lists", title: "How often right now", source: "src/screens/Onboarding.tsx BASELINES", samples: BASELINES.map((b) => b.label) },
  { id: "lists.saving_for", group: "lists", title: "Things to save for", source: "src/screens/Report.tsx SAVING_FOR", samples: [...SAVING_FOR] },
  { id: "lists.currencies", group: "lists", title: "Currencies", source: "src/screens/Me.tsx CURRENCIES", samples: CURRENCIES.map((c) => `${c.sym} ${c.name}`) },
  { id: "lists.starter_questions", group: "lists", title: "A new track's check-in questions", source: "src/questions.ts starterFields", samples: starterFields({ what: "x", measure: "money", amountLabel: "Money spent", cls: "custom", triggers: [] }).map((f) => f.label) },
  { id: "lists.conditions", group: "lists", title: "Pet conditions, by kind of habit and species", source: "src/health.ts CONDITION_TEXT", samples: Object.entries(CONDITION_TEXT).flatMap(([k, v]) => Object.entries(v).map(([sp, pair]) => `${k}/${sp}: ${pair![0]}: ${pair![1]}`)) },
  { id: "lists.records_driven", group: "lists", title: "Wording built from the person's own records", source: "src/recovery.ts observations, src/health.ts healthReport and history", samples: ["What the records show, the health report and the pet's history are put together from a person's own logs, so they have no fixed sample. Their wording is in the named files and follows the same rules: no food refusal, no shaming, singular and plural handled, months rounded for display."] },
  { id: "lists.species", group: "lists", title: "Species", source: "src/pets.ts SPECIES", samples: SPECIES.map((s) => `${s.label}: ${s.blurb}`) },
  { id: "lists.styles_3d", group: "lists", title: "3D pet names", source: "src/pet3d-support.ts STYLE_3D", samples: Object.values(STYLE_3D).map((s) => `${s.label}: ${s.note}`) },
  { id: "lists.coats", group: "lists", title: "Coats", source: "src/pets.ts COATS", samples: Object.entries(COATS).map(([sp, c]) => `${sp}: ${c.map((x) => x.label).join(", ")}`) },
  { id: "lists.personalities", group: "lists", title: "Personalities", source: "src/pets.ts PERSONALITIES", samples: PERSONALITIES.map((p) => `${p.label}: ${p.blurb}`) },
  { id: "lists.accessories", group: "lists", title: "Accessories", source: "src/pets.ts ACCESSORIES", samples: ACCESSORIES.map((a) => `${a.label} (${a.days} days)`) },
  { id: "lists.names", group: "lists", title: "Suggested pet names", source: "src/pets.ts NAMES", samples: Object.entries(NAMES).map(([sp, n]) => `${sp}: ${n.join(", ")}`) },
];
