"use client";

import { useActionState } from "react";
import { sendMagicLink, type LoginState } from "./actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendMagicLink, { status: "idle" });

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-24">
      <h1 className="text-2xl font-semibold">Sign in to Beatmap</h1>
      {state.status === "sent" ? (
        <p className="rounded-md bg-emerald-50 p-4 text-sm text-emerald-800" role="status">
          {state.message}
        </p>
      ) : (
        <form action={action} className="flex flex-col gap-3">
          <label htmlFor="email" className="text-sm font-medium">
            Work email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="rounded-md border border-slate-300 bg-white px-3 py-2"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
          >
            {pending ? "Sending…" : "Email me a sign-in link"}
          </button>
          {state.status === "error" && (
            <p className="text-sm text-red-700" role="alert">
              {state.message}
            </p>
          )}
        </form>
      )}
    </main>
  );
}
