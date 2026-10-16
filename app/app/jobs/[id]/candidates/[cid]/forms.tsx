"use client";

import { useActionState, useEffect, useRef } from "react";
import { directMessageAction, editScoreAction, type ActionResult } from "../../../../actions";

export function EditScoreForm({ jobId, candidateId, current }: { jobId: string; candidateId: string; current: number }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(editScoreAction, null);
  return (
    <details className="mt-4">
      <summary className="text-sm underline cursor-pointer">Edit score</summary>
      <form action={action} className="mt-3 flex flex-col sm:flex-row gap-2 sm:items-end">
        <input type="hidden" name="jobId" value={jobId} />
        <input type="hidden" name="candidateId" value={candidateId} />
        <label className="text-sm">
          Score (0-100)
          <input name="total" type="number" min={0} max={100} defaultValue={current} className="input mt-1 w-28" required />
        </label>
        <label className="text-sm flex-1">
          Reason (kept in the audit log)
          <input name="note" className="input mt-1" maxLength={500} />
        </label>
        <button className="btn-base btn-ghost" disabled={pending}>
          Save
        </button>
      </form>
      {state && (
        <p className="text-sm mt-2" style={{ color: state.ok ? "var(--color-primary)" : "var(--color-error)" }}>
          {state.ok ? "Score updated." : state.error}
        </p>
      )}
    </details>
  );
}

export function DirectMessageForm({ jobId, candidateId }: { jobId: string; candidateId: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(directMessageAction, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="mt-4 space-y-2">
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="candidateId" value={candidateId} />
      <label className="block text-sm font-medium">
        Message this candidate
        <textarea name="body" rows={2} maxLength={2000} className="input mt-1" required />
      </label>
      {state && !state.ok && (
        <p className="text-sm" style={{ color: "var(--color-error)" }}>
          {state.error}
        </p>
      )}
      <button className="btn-base btn-ghost" disabled={pending}>
        {pending ? "Sending…" : "Send on WhatsApp"}
      </button>
    </form>
  );
}
