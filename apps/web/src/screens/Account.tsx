import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { haptic } from "../haptics";
import { spring } from "../motion";
import { actions } from "../store";
import { AUTH_REDIRECT, configured, supabase, useSession } from "../supabase";
import { forgetSync, getSyncStatus, stopSync, syncNow, useSyncStatus } from "../sync";
import { Button, Select } from "../ui/Controls";
import { toast } from "../ui/Toast";

/** 0..4, rewarding length and variety. Good enough to nudge, not to gatekeep. */
export function passwordScore(p: string): number {
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
  if (/^(.)\1+$/.test(p) || /password|123456|qwerty/i.test(p)) s = 0;
  return Math.min(4, s);
}
const SCORE = ["Too easy to guess", "Weak", "Okay", "Good", "Strong"];

function friendly(msg: string): string {
  if (/invalid login/i.test(msg)) return "That email and password don't match. If you've forgotten it, tap Forgot password.";
  if (/already registered|already been registered/i.test(msg)) return "There's already an account with that email. Try signing in.";
  if (/email rate limit/i.test(msg)) return "Too many emails have been sent in the last hour. Try again later, or sign in if you already have an account.";
  if (/rate limit|too many/i.test(msg)) return "Too many tries. Wait a minute and try again.";
  if (/email not confirmed/i.test(msg)) return "Confirm your email first: open the link we sent you on this phone.";
  if (/network|fetch/i.test(msg)) return "Couldn't reach the server. Check your connection.";
  if (/weak|pwned|leaked/i.test(msg)) return "That password has shown up in data leaks. Pick another.";
  return msg;
}

function SyncLine() {
  const s = useSyncStatus();
  // Quick syncs stay invisible; only a slow one says so.
  const [slow, setSlow] = useState(false);
  useEffect(() => { if (s.state !== "syncing") { setSlow(false); return; } const t = setTimeout(() => setSlow(true), 800); return () => clearTimeout(t); }, [s.state]);
  const text = s.state === "syncing" && (slow || !s.last) ? "Syncing…"
    : s.state === "offline" ? `Offline. ${s.pending ? `${s.pending} changes will sync when you're back.` : "Everything is saved on this phone."}`
      : s.state === "error" ? "Sync paused. It will retry on its own."
        : s.last ? `Backed up ${new Date(s.last).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` : "Backed up";
  return (
    <div className="sync-line" data-state={s.state === "syncing" && !slow && s.last ? "idle" : s.state}>
      <motion.i animate={s.state === "syncing" && slow ? { rotate: 360 } : { rotate: 0 }} transition={s.state === "syncing" ? { repeat: Infinity, duration: 1, ease: "linear" } : { duration: 0 }} />
      <span className="small">{text}</span>
      {s.state !== "syncing" && <button className="link small" onClick={() => void syncNow()}>Sync now</button>}
    </div>
  );
}

export function Account({ compact = false }: { compact?: boolean }) {
  const { session } = useSession();
  const [mode, setMode] = useState<"up" | "in">("up");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | "signout" | "delete">(null);
  const [sent, setSent] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  if (!configured || !supabase) {
    return <p className="muted small">Accounts aren't available in this build.</p>;
  }

  if (session) {
    return (
      <div className="stack">
        <p>Signed in as <b>{session.user.email}</b></p>
        <SyncLine />
        {!compact && (
          <AnimatePresence mode="wait" initial={false}>
            {confirm === null && (
              <motion.div key="btns" className="actions" exit={{ opacity: 0 }}>
                <Button variant="secondary" onClick={() => setConfirm("signout")}>Sign out</Button>
                <Button variant="danger" onClick={() => setConfirm("delete")}>Delete account</Button>
              </motion.div>
            )}
            {confirm === "signout" && (
              <motion.div key="so" className="stack tight" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                <p className="small">Everything is kept in your account. This phone's copy is removed when you sign out, and comes back when you sign in again.</p>
                <Button variant="secondary" onClick={async () => {
                  await syncNow();
                  if (getSyncStatus().pending > 0 && !window.confirm(`${getSyncStatus().pending} changes haven't backed up yet and will be lost. Sign out anyway?`)) return;
                  const uid = session.user.id; stopSync(); await forgetSync(uid); await supabase!.auth.signOut(); await actions.resetAll();
                }}>Sign out</Button>
                <Button variant="text" onClick={() => setConfirm(null)}>Cancel</Button>
              </motion.div>
            )}
            {confirm === "delete" && (
              <motion.div key="del" className="stack tight" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                <p className="small">This permanently deletes your account, your pets and every log, here and in the cloud. It can't be undone.</p>
                <Button variant="danger" onClick={async () => {
                  haptic.heavy();
                  const uid = session.user.id;
                  const { error } = await supabase!.rpc("delete_my_account");
                  if (error) { toast(friendly(error.message), { kind: "bad" }); return; }
                  stopSync(); await forgetSync(uid); await supabase!.auth.signOut(); await actions.resetAll();
                  toast("Your account was deleted");
                }}>Delete my account for good</Button>
                <Button variant="text" onClick={() => setConfirm(null)}>Cancel</Button>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    );
  }

  if (sent) {
    return (
      <motion.div className="stack center-text" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <motion.div className="lock-ico" initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={spring.bouncy}>✉</motion.div>
        <h2>Check your email</h2>
        <p className="muted small">We sent a link to <b>{sent}</b>. Open it on this phone and it brings you straight back here, signed in.</p>
        <Button variant="secondary" disabled={resent} onClick={async () => {
          const { error } = await supabase!.auth.resend({ type: "signup", email: sent, options: { emailRedirectTo: AUTH_REDIRECT } });
          if (error) toast(friendly(error.message), { kind: "bad" }); else { setResent(true); toast("Sent again", { kind: "good" }); }
        }}>{resent ? "Sent again" : "Resend the email"}</Button>
        <Button variant="text" onClick={() => { setSent(null); setMode("in"); }}>I've confirmed, sign in</Button>
      </motion.div>
    );
  }

  const score = passwordScore(password);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "up" && score < 2) { setMsg("Pick a longer password, ideally 12 characters or more."); haptic.warn(); return; }
    setBusy(true); setMsg(null);
    const { data, error } = mode === "up"
      ? await supabase!.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: AUTH_REDIRECT } })
      : await supabase!.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) { setMsg(friendly(error.message)); haptic.warn(); return; }
    // An address that already has an account gets a silent success and no email (so accounts can't be probed). Say so.
    if (mode === "up" && !data.session && data.user && (data.user.identities?.length ?? 0) === 0) {
      setMode("in"); setMsg("There's already an account with this email. Sign in with its password, or tap Forgot password."); haptic.warn(); return;
    }
    if (data.session) { haptic.success(); toast(mode === "up" ? "Account created" : "Signed in", { kind: "good" }); }
    else { setSent(email.trim()); setMsg(null); }
  }
  async function reset() {
    if (!email.trim()) { setMsg("Type your email above first."); return; }
    const { error } = await supabase!.auth.resetPasswordForEmail(email.trim(), { redirectTo: AUTH_REDIRECT });
    setMsg(error ? friendly(error.message) : "If there's an account for that email, a reset link is on its way.");
  }

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <div className="field"><span className="field-label">I want to</span><Select label="Account action" value={mode} onChange={(m) => { setMode(m); setMsg(null); }} options={[{ value: "up", label: "Create an account" }, { value: "in", label: "Sign in to my account" }]} /></div>
      <label className="field"><span className="field-label">Email</span><input className="input" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <div className="field"><label className="field-label" htmlFor="account-password">Password</label>
        <span className="pw-wrap">
          <input id="account-password" name="password" className="input" type={show ? "text" : "password"} autoComplete={mode === "up" ? "new-password" : "current-password"} minLength={8} maxLength={128} required value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="button" className="pw-toggle" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"}>{show ? "Hide" : "Show"}</button>
        </span>
      </div>
      <AnimatePresence>
        {mode === "up" && password && (
          <motion.div className="meter" data-score={score} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <div className="meter-bar">{[0, 1, 2, 3].map((i) => <motion.i key={i} animate={{ opacity: i < score ? 1 : 0.2 }} transition={spring.snappy} />)}</div>
            <span className="small muted">{SCORE[score]}</span>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>{msg && <motion.p className="err" role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>{msg}</motion.p>}</AnimatePresence>
      <Button type="submit" disabled={busy || !/^\S+@\S+\.\S+$/.test(email.trim()) || password.length < 8}>{busy ? "One moment…" : mode === "up" ? "Create account" : "Sign in"}</Button>
      {mode === "in" && <Button variant="text" onClick={reset}>Forgot password?</Button>}
    </form>
  );
}

/** Shown after a password-reset link opens the app: the person is signed in and picks a new password. */
export function NewPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const score = passwordScore(password);
  return (
    <main className="screen onboard">
      <div className="step-inner auth">
        <h1>Choose a new password</h1>
        <p className="muted">You opened a reset link, so you're signed in. Pick a new password to finish.</p>
        <div className="card stack">
          <label className="field"><span className="field-label">New password</span>
            <input className="input" type="password" autoComplete="new-password" minLength={8} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {password && <span className="small muted">{SCORE[score]}</span>}
          {msg && <p className="err" role="alert">{msg}</p>}
          <Button disabled={busy || score < 2} onClick={async () => {
            setBusy(true);
            const { error } = await supabase!.auth.updateUser({ password });
            setBusy(false);
            if (error) { setMsg(friendly(error.message)); return; }
            toast("Password updated", { kind: "good" });
            onDone();
          }}>{busy ? "Saving…" : "Save password"}</Button>
        </div>
      </div>
    </main>
  );
}
