import type { Tone } from "../types";

/**
 * The shape of the copy catalogue. Every piece of user-visible text that belongs to a screen lives in a section,
 * and every section sits between `@copy-section <id>` and `@copy-section-end <id>` markers in its own file, so an
 * editor can find and change exactly that block. Nothing here knows about React or the store.
 *
 *  - A plain string is tone-neutral on purpose: a label, a safety instruction, a factual status, a privacy statement.
 *  - A tone entry has one version per Voice (gentle, honest, brutal; "Direct" on screen). All three are required.
 *  - `{name}`-style placeholders are filled by t() / tt(); the types make a missing one a compile error. `{app}` is
 *    always the product name (src/brand.ts).
 */
export type ToneText = Readonly<Record<Tone, string>>;
export type Entry = string | ToneText;
export type Entries = Readonly<Record<string, Entry>>;

export interface Section<I extends string = string, E extends Entries = Entries> {
  /** Stable id, `screen.section`. Never reused for different copy. */
  readonly id: I;
  /** Which screen or area shows it, in the words the app uses for it. */
  readonly screen: string;
  readonly title: string;
  /** The file or files that render this copy. */
  readonly source: string;
  readonly entries: E;
}

export function defineSection<const I extends string, const E extends Entries>(
  id: I, meta: { screen: string; title: string; source: string }, entries: E,
): Section<I, E> {
  return { id, ...meta, entries };
}

/** Handy for writing a tone entry. */
/** Keeps each version's literal text, so a missing placeholder is a compile error. */
export const tones = <const G extends string, const H extends string, const B extends string>(gentle: G, honest: H, brutal: B) => ({ gentle, honest, brutal }) as const;

// ---------- placeholders, in the types ----------

type PlaceholdersIn<S extends string> = S extends `${string}{${infer K}}${infer R}` ? K | PlaceholdersIn<R> : never;
export type VarsOfEntry<E> = E extends string ? PlaceholdersIn<E> : E extends ToneText ? PlaceholdersIn<E["gentle"] | E["honest"] | E["brutal"]> : never;
export type NeedsVars<E> = Exclude<VarsOfEntry<E>, "app">;
export type VarsArg<E> = [NeedsVars<E>] extends [never] ? [] : [Record<NeedsVars<E>, string | number>];

export function interpolate(text: string, vars: Readonly<Record<string, string | number>>): string {
  return text.replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? String(vars[key]) : whole));
}

export const isToneText = (e: Entry): e is ToneText => typeof e !== "string";
/** The tone's version, or the Honest one if the tone is somehow missing, so a screen never gets undefined. */
export const pickTone = (e: ToneText, tone: Tone): string => e[tone] ?? e.honest;
