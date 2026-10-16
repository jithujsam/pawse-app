"use client";

import { useActionState } from "react";
import { requestLinkAction, type LinkState } from "./actions";
import { useHydrated } from "@/components/app/useHydrated";

export function LoginForm() {
  const [state, action, pending] = useActionState<LinkState, FormData>(requestLinkAction, null);
  const ready = useHydrated();

  if (state?.ok) {
    return (
      <div className="space-y-3">
        <p className="text-sm">Check your inbox for a sign-in link. It expires in 15 minutes.</p>
        {state.devLink && (
          <div className="rounded-lg p-3 text-sm" style={{ background: "var(--color-surface-container-low)" }}>
            <div className="eyebrow mb-1">Local mode: no email provider configured</div>
            <a href={state.devLink} className="underline break-all" style={{ color: "var(--color-primary)" }}>
              Open sign-in link
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4" data-ready={ready || undefined}>
      <label className="block">
        <span className="text-sm font-medium">Work email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="input mt-1"
          placeholder="you@agency.in"
        />
      </label>
      {state && !state.ok && (
        <p className="text-sm" style={{ color: "var(--color-error)" }} role="alert">
          {state.error}
        </p>
      )}
      <button className="btn-base btn-primary w-full" disabled={pending}>
        {pending ? "Sending…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
