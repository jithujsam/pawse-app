"use client";

import { useActionState } from "react";
import { createWorkspace, type CreateWorkspaceState } from "./actions";

export function WorkspaceForm() {
  const [state, action, pending] = useActionState<CreateWorkspaceState, FormData>(createWorkspace, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Company or team name
        <input name="name" required maxLength={120} className="rounded-md border border-slate-300 bg-white px-3 py-2 font-normal" />
      </label>
      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1 font-medium">Where are most of your locations?</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="country" value="US" defaultChecked /> United States
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="country" value="GB" /> United Kingdom
        </label>
        <span className="text-slate-500">Rows with a country column can still mix both.</span>
      </fieldset>
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create workspace"}
      </button>
      {state.error && (
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
