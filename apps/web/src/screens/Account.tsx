import { useState } from "react";
import { configured, supabase, useSession } from "../supabase";
import { startSync, stopSync } from "../sync";

export function Account({ compact = false, onSignedIn }: { compact?: boolean; onSignedIn?: () => void }) {
  const { session } = useSession();
  const [mode, setMode] = useState<"up" | "in">("up");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!configured || !supabase) {
    return <p className="muted small">Accounts aren't switched on in this build, so everything stays on this phone.</p>;
  }
  if (session) {
    return (
      <div className="stack">
        <p>Signed in as <b>{session.user.email}</b>. Your data is saved to your account.</p>
        {!compact && <button className="btn secondary" onClick={async () => { stopSync(); await supabase!.auth.signOut(); }}>Sign out</button>}
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const { data, error } = mode === "up"
      ? await supabase!.auth.signUp({ email: email.trim(), password })
      : await supabase!.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    if (data.session) { await startSync(data.session.user.id); onSignedIn?.(); }
    else setMsg("Check your email to confirm your address, then sign in.");
  }

  return (
    <form className="stack" onSubmit={submit}>
      <div className="chips" role="group" aria-label="Account mode">
        <button type="button" className="chip" aria-pressed={mode === "up"} onClick={() => setMode("up")}>Create account</button>
        <button type="button" className="chip" aria-pressed={mode === "in"} onClick={() => setMode("in")}>Sign in</button>
      </div>
      <label className="field">Email<input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label className="field">Password<input className="input" type="password" autoComplete={mode === "up" ? "new-password" : "current-password"} minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      {msg && <p className="err" role="alert">{msg}</p>}
      <button className="btn" disabled={busy || !email || password.length < 8}>{busy ? "One moment" : mode === "up" ? "Create account" : "Sign in"}</button>
    </form>
  );
}
