import { interpolate, isToneText, pickTone, type Section, type ToneText, type VarsArg } from "./core";
import { APP_NAME } from "../brand";
import type { Tone } from "../types";
import { accountBlockers, accountCheckEmail, accountErrors, accountForm, accountNewPassword, accountSignedIn, accountSync } from "./sections/account";
import { homeCoach, homeHeader, homeHero, homeMilestone, homePaused, homeToday, homeWeek, calendarAge, calendarDay, calendarMilestones, calendarMonth, calendarNote, calendarStats } from "./sections/home";
import { insightsChart, insightsForecast, insightsGoalLine, insightsHeader, insightsMoney, insightsPatterns, insightsReflect, insightsReview, insightsSince, insightsSummary, insightsUrges, insightsWeek, insightsWhen } from "./sections/insights";
import { meAbout, meAppearance, meData, meFeel, mePet, meProfile, meQuestions, meReminders, meVoice } from "./sections/me";
import { notificationsCatchup, notificationsDaily, notificationsPermission, notificationsQuiet } from "./sections/notifications";
import { onboardingChange, onboardingChrome, onboardingCount, onboardingFinal, onboardingHatch, onboardingHelp, onboardingPet, onboardingReminders, onboardingTriggers, onboardingVoice, onboardingWhy } from "./sections/onboarding";
import { petsAdd, petsGrid, petsMenu, petsPicker } from "./sections/pets";
import { privacyFlows, privacySummary } from "./sections/privacy";
import { safetyCrisis, safetyDisclaimer, safetyHelplines, safetyProfessional, safetyRestriction, safetySupport } from "./sections/safety";
import { lockScreen, securityLock, securityPin } from "./sections/security";
import { sheetsHealth, sheetsLog, sheetsMemorial, sheetsPlan, sheetsQuick, sheetsReflection, sheetsUrge } from "./sections/sheets";
import { missionsContent, missionsSheet } from "./sections/missions";
import { navLoading, navTabs, petLook, uiCommon, uiSelect, uiSettings } from "./sections/system";
import { updateDialog, updateToasts } from "./sections/update";
import { welcomeAccount, welcomeRestoring, welcomeStory } from "./sections/welcome";

/**
 * Every section of the copy catalogue, in the order the app shows them. This list is the registry: a section that is
 * not here does not exist as far as the app, the tests and the inspector are concerned.
 */
export const SECTIONS = [
  navTabs, navLoading, petLook, uiCommon, uiSelect, uiSettings,
  welcomeStory, welcomeAccount, welcomeRestoring,
  onboardingChrome, onboardingPet, onboardingChange, onboardingCount, onboardingTriggers, onboardingWhy, onboardingHelp, onboardingVoice, onboardingReminders, onboardingFinal, onboardingHatch,
  petsGrid, petsMenu, petsPicker, petsAdd,
  homeHeader, homeHero, homePaused, homeWeek, homeToday, homeMilestone, homeCoach,
  missionsSheet, missionsContent,
  calendarNote, calendarAge, calendarMonth, calendarDay, calendarStats, calendarMilestones,
  insightsHeader, insightsWeek, insightsUrges, insightsMoney, insightsWhen, insightsSince, insightsSummary, insightsChart, insightsForecast, insightsReflect, insightsReview, insightsGoalLine, insightsPatterns,
  meProfile, mePet, meVoice, meReminders, meQuestions, meData, meAppearance, meFeel, meAbout,
  sheetsLog, sheetsReflection, sheetsUrge, sheetsQuick, sheetsHealth, sheetsPlan, sheetsMemorial,
  accountForm, accountBlockers, accountErrors, accountSignedIn, accountSync, accountCheckEmail, accountNewPassword,
  securityLock, securityPin, lockScreen,
  updateDialog, updateToasts,
  notificationsPermission, notificationsDaily, notificationsQuiet, notificationsCatchup,
  safetyHelplines, safetyCrisis, safetyRestriction, safetyProfessional, safetyDisclaimer, safetySupport,
  privacyFlows, privacySummary,
] as const;

type FlatOf<S> = S extends Section<infer I, infer E> ? { [K in Extract<keyof E, string> as `${I}.${K}`]: E[K] } : never;
type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (k: infer I) => void ? I : never;
type Flat = UnionToIntersection<FlatOf<(typeof SECTIONS)[number]>>;

/** Every id in the catalogue. A typo in an id is a compile error. */
export type CopyId = Extract<keyof Flat, string>;
export type PlainId = { [K in CopyId]: Flat[K] extends string ? K : never }[CopyId];
export type ToneId = { [K in CopyId]: Flat[K] extends ToneText ? K : never }[CopyId];

const ENTRIES = new Map<string, { section: Section; key: string; entry: string | ToneText }>();
for (const section of SECTIONS as readonly Section[]) {
  for (const [key, entry] of Object.entries(section.entries)) ENTRIES.set(`${section.id}.${key}`, { section, key, entry });
}

/** Every entry as the inspector, the manifest and the tests see it. */
export const catalogue = (): { id: string; section: Section; key: string; entry: string | ToneText }[] =>
  [...ENTRIES].map(([id, v]) => ({ id, ...v }));

const withApp = <V extends Record<string, string | number>>(vars?: V) => ({ app: APP_NAME, ...(vars ?? {}) });

/** A tone-neutral line of copy, with its placeholders filled in. */
export function t<K extends PlainId>(id: K, ...vars: VarsArg<Flat[K]>): string {
  const hit = ENTRIES.get(id);
  if (!hit || isToneText(hit.entry)) return id; // unreachable for typed ids; the tests prove every id resolves
  return interpolate(hit.entry, withApp(vars[0] as Record<string, string | number> | undefined));
}

/** The Voice's version of a line (Gentle, Honest or Direct), with its placeholders filled in. An unknown Voice reads as Honest. */
export function tt<K extends ToneId>(id: K, tone: Tone, ...vars: VarsArg<Flat[K]>): string {
  const hit = ENTRIES.get(id);
  if (!hit || !isToneText(hit.entry)) return id;
  return interpolate(pickTone(hit.entry, tone), withApp(vars[0] as Record<string, string | number> | undefined));
}
