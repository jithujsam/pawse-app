"use client";

import { useActionState } from "react";
import { createOrgAction, type ActionResult } from "../actions";

export function OrgForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(createOrgAction, null);
  return (
    <form action={action} className="space-y-5">
      <label className="block">
        <span className="text-sm font-medium">Agency or company name</span>
        <input name="name" required minLength={2} maxLength={120} className="input mt-1" placeholder="e.g. Sharma Staffing" />
      </label>
      <fieldset>
        <legend className="text-sm font-medium mb-2">You are</legend>
        <div className="flex flex-col sm:flex-row gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="kind" value="agency" defaultChecked /> A staffing or recruitment agency
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="kind" value="company" /> A company hiring for itself
          </label>
        </div>
      </fieldset>
      {state && !state.ok && (
        <p className="text-sm" style={{ color: "var(--color-error)" }} role="alert">
          {state.error}
        </p>
      )}
      <button className="btn-base btn-primary" disabled={pending}>
        {pending ? "Creating…" : "Continue"}
      </button>
    </form>
  );
}
