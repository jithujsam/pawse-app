"use client";

import { useActionState, useState, useTransition } from "react";
import { saveJobAction, suggestQuestionsAction, type ActionResult } from "../actions";
import { useHydrated } from "@/components/app/useHydrated";

type Nice = { text: string; weight: number };
export type JobFormValues = {
  title: string;
  description: string;
  location: string;
  testMode: boolean;
  questions: string[];
  knockouts: string[];
  niceToHaves: Nice[];
};

const SAMPLE: JobFormValues = {
  title: "Customer Support Executive",
  description:
    "Handle customer calls and WhatsApp chats for an e-commerce brand in Bengaluru. Day shift, 6 days a week. Hindi and English required; Kannada is a plus.",
  location: "Bengaluru",
  testMode: true,
  questions: [
    "Can you speak and write in both Hindi and English with customers?",
    "How many years of customer support or telecalling experience do you have? Where?",
    "Have you used any CRM or ticketing software? Which one?",
    "What is your current and expected monthly salary?",
    "How soon can you join, and can you work from our Koramangala office?",
  ],
  knockouts: ["Speaks Hindi and English", "Can work from the Bengaluru office"],
  niceToHaves: [
    { text: "Customer support or telecalling experience", weight: 3 },
    { text: "Has used CRM or ticketing software", weight: 1 },
    { text: "Speaks Kannada", weight: 1 },
  ],
};

const EMPTY: JobFormValues = {
  title: "",
  description: "",
  location: "",
  testMode: true,
  questions: ["", "", "", "", ""],
  knockouts: [""],
  niceToHaves: [{ text: "", weight: 2 }],
};

export function JobForm({ jobId, initial, first }: { jobId?: string; initial?: JobFormValues; first?: boolean }) {
  const [v, setV] = useState<JobFormValues>(initial ?? EMPTY);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(saveJobAction, null);
  const [suggesting, startSuggest] = useTransition();
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const ready = useHydrated();

  const set = <K extends keyof JobFormValues>(k: K, val: JobFormValues[K]) => setV((p) => ({ ...p, [k]: val }));
  const payload = JSON.stringify({
    ...v,
    questions: v.questions.map((q) => q.trim()).filter(Boolean),
    knockouts: v.knockouts.map((k) => k.trim()).filter(Boolean),
    niceToHaves: v.niceToHaves.filter((n) => n.text.trim()).map((n) => ({ text: n.text.trim(), weight: n.weight })),
  });

  const suggest = () =>
    startSuggest(async () => {
      setSuggestError(null);
      const r = await suggestQuestionsAction({ title: v.title, description: v.description, location: v.location });
      if (r.ok) set("questions", r.questions);
      else setSuggestError(r.error);
    });

  return (
    <form action={action} className="space-y-8" data-ready={ready || undefined}>
      <input type="hidden" name="payload" value={payload} />
      {jobId && <input type="hidden" name="jobId" value={jobId} />}

      {first && !jobId && (
        <div className="rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ background: "var(--color-surface-container-low)" }}>
          <p className="text-sm">First time? Start from a sample role and edit it.</p>
          <button type="button" className="btn-base btn-ghost" onClick={() => setV(SAMPLE)}>
            Fill with a sample role
          </button>
        </div>
      )}

      <section className="card space-y-4">
        <h2 className="text-2xl">The role</h2>
        <label className="block">
          <span className="text-sm font-medium">Job title</span>
          <input className="input mt-1" value={v.title} onChange={(e) => set("title", e.target.value)} maxLength={120} required />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Location</span>
          <input className="input mt-1" value={v.location} onChange={(e) => set("location", e.target.value)} maxLength={120} required />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Description</span>
          <span className="block text-xs" style={{ color: "var(--color-on-surface-variant)" }}>
            Used to suggest questions and to score answers. Candidates don&apos;t see it.
          </span>
          <textarea className="input mt-1 min-h-28" value={v.description} onChange={(e) => set("description", e.target.value)} maxLength={5000} required />
        </label>
      </section>

      <section className="card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-2xl">Screening questions</h2>
            <p className="text-xs" style={{ color: "var(--color-on-surface-variant)" }}>
              Sent one at a time on WhatsApp. Candidates can reply by text or voice note. 3 to 5 questions.
            </p>
          </div>
          <button type="button" className="btn-base btn-ghost" onClick={suggest} disabled={suggesting || !v.title.trim()}>
            {suggesting ? "Drafting…" : "Draft questions with AI"}
          </button>
        </div>
        {suggestError && <p className="text-sm" style={{ color: "var(--color-error)" }}>{suggestError}</p>}
        {v.questions.map((q, i) => (
          <label key={i} className="block">
            <span className="text-sm font-medium">Question {i + 1}</span>
            <textarea
              className="input mt-1"
              rows={2}
              value={q}
              maxLength={500}
              onChange={(e) => set("questions", v.questions.map((x, j) => (j === i ? e.target.value : x)))}
            />
          </label>
        ))}
      </section>

      <section className="card space-y-4">
        <div>
          <h2 className="text-2xl">Scoring rubric</h2>
          <p className="text-xs" style={{ color: "var(--color-on-surface-variant)" }}>
            Must-haves are pass/fail: a candidate who doesn&apos;t meet one ranks below everyone who does. Nice-to-haves add points by weight.
          </p>
        </div>
        <div className="space-y-2">
          <div className="text-sm font-medium">Must-haves (knockouts)</div>
          {v.knockouts.map((k, i) => (
            <div key={i} className="flex gap-2">
              <input
                className="input"
                value={k}
                maxLength={300}
                placeholder="e.g. Valid two-wheeler licence"
                onChange={(e) => set("knockouts", v.knockouts.map((x, j) => (j === i ? e.target.value : x)))}
              />
              <button type="button" className="btn-base btn-ghost" aria-label="Remove" onClick={() => set("knockouts", v.knockouts.filter((_, j) => j !== i))}>
                ✕
              </button>
            </div>
          ))}
          {v.knockouts.length < 5 && (
            <button type="button" className="text-sm underline" onClick={() => set("knockouts", [...v.knockouts, ""])}>
              + Add must-have
            </button>
          )}
        </div>
        <div className="space-y-2">
          <div className="text-sm font-medium">Nice-to-haves</div>
          {v.niceToHaves.map((n, i) => (
            <div key={i} className="flex gap-2">
              <input
                className="input"
                value={n.text}
                maxLength={300}
                placeholder="e.g. 2+ years delivery experience"
                onChange={(e) => set("niceToHaves", v.niceToHaves.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
              />
              <select
                className="input w-32 shrink-0"
                aria-label="Weight"
                value={n.weight}
                onChange={(e) => set("niceToHaves", v.niceToHaves.map((x, j) => (j === i ? { ...x, weight: Number(e.target.value) } : x)))}
              >
                {[1, 2, 3, 4, 5].map((w) => (
                  <option key={w} value={w}>
                    Weight {w}
                  </option>
                ))}
              </select>
              <button type="button" className="btn-base btn-ghost" aria-label="Remove" onClick={() => set("niceToHaves", v.niceToHaves.filter((_, j) => j !== i))}>
                ✕
              </button>
            </div>
          ))}
          {v.niceToHaves.length < 8 && (
            <button type="button" className="text-sm underline" onClick={() => set("niceToHaves", [...v.niceToHaves, { text: "", weight: 2 }])}>
              + Add nice-to-have
            </button>
          )}
        </div>
      </section>

      <section className="card">
        <label className="flex items-start gap-3">
          <input type="checkbox" className="mt-1" checked={v.testMode} onChange={(e) => set("testMode", e.target.checked)} />
          <span>
            <span className="font-medium">Free test mode</span>
            <span className="block text-sm" style={{ color: "var(--color-on-surface-variant)" }}>
              Screen up to 5 candidates free to see how it works. Turn this off to screen a full list (paid per job).
            </span>
          </span>
        </label>
      </section>

      {state && !state.ok && (
        <p className="text-sm" style={{ color: "var(--color-error)" }} role="alert">
          {state.error}
        </p>
      )}
      <button className="btn-base btn-primary" disabled={pending}>
        {pending ? "Saving…" : jobId ? "Save changes" : "Save and upload candidates"}
      </button>
    </form>
  );
}
