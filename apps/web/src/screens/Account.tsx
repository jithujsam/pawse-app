import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { haptic } from "../haptics";
import { spring } from "../motion";
import { actions } from "../store";
import { AUTH_REDIRECT, configured, supabase, useSession } from "../supabase";
import { forgetSync, getSyncStatus, stopSync, syncNow, useSyncStatus } from "../sync";
import { Button, Select } from "../ui/Controls";
import { accountBlocker, friendlyAuthError, newPasswordBlocker, passwordScore } from "../authErrors";
import { t } from "../text";
import { toast } from "../ui/Toast";

const STRENGTH = [t("account.form.strength_0"), t("account.form.strength_1"), t("account.form.strength_2"), t("account.form.strength_3"), t("account.form.strength_4")];

function SyncLine() {
  const s = useSyncStatus();
  // Quick syncs stay invisible; only a slow one says so.
  const [slow, setSlow] = useState(false);
  useEffect(() => { if (s.state !== "syncing") { setSlow(false); return; } const timer = setTimeout(() => setSlow(true), 800); return () => clearTimeout(timer); }, [s.state]);
  const text = s.state === "syncing" && (slow || !s.last) ? t("account.sync.syncing")
    : s.state === "offline" ? (s.pending ? (s.pending === 1 ? t("account.sync.offline_pending_one") : t("account.sync.offline_pending_other", { n: s.pending })) : t("account.sync.offline"))
      : s.state === "error" ? t("account.sync.error")
        : s.last ? t("account.sync.backed_up", { time: new Date(s.last).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) }) : t("account.sync.not_yet");
  return (
    <div className="sync-line" data-state={s.state === "syncing" && !slow && s.last ? "idle" : s.state}>
      <motion.i animate={s.state === "syncing" && slow ? { rotate: 360 } : { rotate: 0 }} transition={s.state === "syncing" ? { repeat: Infinity, duration: 1, ease: "linear" } : { duration: 0 }} />
      <span className="small">{text}</span>
      {s.state !== "syncing" && <button className="link small" onClick={() => void syncNow()}>{t("account.sync.now")}</button>}
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
  // Changes that hadn't backed up when the person tapped Sign out: the same block asks once more, in the app, not in a browser dialog.
  const [unsynced, setUnsynced] = useState<number | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  if (!configured || !supabase) {
    return <p className="muted small">{t("account.form.unavailable")}</p>;
  }

  if (session) {
    return (
      <div className="stack">
        <p>{t("account.signed_in.as", { email: session.user.email ?? "" })}</p>
        <SyncLine />
        {!compact && (
          <AnimatePresence mode="wait" initial={false}>
            {confirm === null && (
              <motion.div key="btns" className="actions" exit={{ opacity: 0 }}>
                <Button variant="secondary" onClick={() => { setUnsynced(null); setConfirm("signout"); }}>{t("account.signed_in.sign_out")}</Button>
                <Button variant="danger" onClick={() => setConfirm("delete")}>{t("account.signed_in.delete")}</Button>
              </motion.div>
            )}
            {confirm === "signout" && (
              <motion.div key="so" className="stack tight" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                <p className="small" role={unsynced ? "alert" : undefined}>{unsynced ? (unsynced === 1 ? t("account.signed_in.pending_one") : t("account.signed_in.pending_other", { n: unsynced })) : t("account.signed_in.sign_out_body")}</p>
                <Button variant="secondary" onClick={async () => {
                  if (unsynced === null) {
                    await syncNow();
                    const pending = getSyncStatus().pending;
                    if (pending > 0) { haptic.warn(); setUnsynced(pending); return; }
                  }
                  const uid = session.user.id; stopSync(); await forgetSync(uid); await supabase!.auth.signOut(); await actions.resetAll();
                }}>{t("account.signed_in.sign_out")}</Button>
                <Button variant="text" onClick={() => { setUnsynced(null); setConfirm(null); }}>{t("ui.common.cancel")}</Button>
              </motion.div>
            )}
            {confirm === "delete" && (
              <motion.div key="del" className="stack tight" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                <p className="small">{t("account.signed_in.delete_body")}</p>
                <Button variant="danger" onClick={async () => {
                  haptic.heavy();
                  const uid = session.user.id;
                  const { error } = await supabase!.rpc("delete_my_account");
                  if (error) { toast(friendlyAuthError(error.message), { kind: "bad" }); return; }
                  stopSync(); await forgetSync(uid); await supabase!.auth.signOut(); await actions.resetAll();
                  toast(t("account.signed_in.deleted"));
                }}>{t("account.signed_in.delete_confirm")}</Button>
                <Button variant="text" onClick={() => setConfirm(null)}>{t("ui.common.cancel")}</Button>
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
        <h2>{t("account.check_email.title")}</h2>
        <p className="muted small">{t("account.check_email.body", { email: sent })}</p>
        <Button variant="secondary" disabled={resent} onClick={async () => {
          const { error } = await supabase!.auth.resend({ type: "signup", email: sent, options: { emailRedirectTo: AUTH_REDIRECT } });
          if (error) toast(friendlyAuthError(error.message), { kind: "bad" }); else { setResent(true); toast(t("account.check_email.resent"), { kind: "good" }); }
        }}>{resent ? t("account.check_email.resent") : t("account.check_email.resend")}</Button>
        <Button variant="text" onClick={() => { setSent(null); setMode("in"); }}>{t("account.check_email.confirmed")}</Button>
      </motion.div>
    );
  }

  const score = passwordScore(password);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const blocked = accountBlocker({ mode, email, password });
    if (blocked) { setMsg(blocked); haptic.warn(); return; }
    setBusy(true); setMsg(null);
    const { data, error } = mode === "up"
      ? await supabase!.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: AUTH_REDIRECT } })
      : await supabase!.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) { setMsg(friendlyAuthError(error.message)); haptic.warn(); return; }
    // An address that already has an account gets a silent success and no email (so accounts can't be probed). Say so.
    if (mode === "up" && !data.session && data.user && (data.user.identities?.length ?? 0) === 0) {
      setMode("in"); setMsg(t("account.form.exists")); haptic.warn(); return;
    }
    if (data.session) { haptic.success(); toast(mode === "up" ? t("account.form.created") : t("account.form.signed_in_toast"), { kind: "good" }); }
    else { setSent(email.trim()); setMsg(null); }
  }
  async function reset() {
    if (!email.trim()) { setMsg(t("account.form.email_first")); return; }
    const { error } = await supabase!.auth.resetPasswordForEmail(email.trim(), { redirectTo: AUTH_REDIRECT });
    setMsg(error ? friendlyAuthError(error.message) : t("account.form.reset_sent"));
  }

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <div className="field"><span className="field-label">{t("account.form.mode_label")}</span><Select label={t("account.form.action_aria")} value={mode} onChange={(m) => { setMode(m); setMsg(null); }} options={[{ value: "up", label: t("account.form.mode_up") }, { value: "in", label: t("account.form.mode_in") }]} /></div>
      <label className="field"><span className="field-label">{t("account.form.email")}</span><input className="input" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <div className="field"><label className="field-label" htmlFor="account-password">{t("account.form.password")}</label>
        <span className="pw-wrap">
          <input id="account-password" name="password" className="input" type={show ? "text" : "password"} autoComplete={mode === "up" ? "new-password" : "current-password"} minLength={8} maxLength={128} required value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="button" className="pw-toggle" onClick={() => setShow(!show)} aria-label={show ? t("account.form.hide_aria") : t("account.form.show_aria")}>{show ? t("account.form.hide") : t("account.form.show")}</button>
        </span>
      </div>
      <AnimatePresence>
        {mode === "up" && password && (
          <motion.div className="meter" data-score={score} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <div className="meter-bar">{[0, 1, 2, 3].map((i) => <motion.i key={i} animate={{ opacity: i < score ? 1 : 0.2 }} transition={spring.snappy} />)}</div>
            <span className="small muted">{STRENGTH[score]}</span>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>{msg && <motion.p className="err" role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>{msg}</motion.p>}</AnimatePresence>
      {(() => { const why = accountBlocker({ mode, email, password }); return why && (email || password) ? <p className="small muted" aria-live="polite">{why}</p> : null; })()}
      <Button type="submit" disabled={busy || accountBlocker({ mode, email, password }) !== null}>{busy ? t("account.form.busy") : mode === "up" ? t("account.form.submit_up") : t("account.form.submit_in")}</Button>
      {mode === "in" && <Button variant="text" onClick={reset}>{t("account.form.forgot")}</Button>}
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
        <h1>{t("account.new_password.title")}</h1>
        <p className="muted">{t("account.new_password.body")}</p>
        <div className="card stack">
          <label className="field"><span className="field-label">{t("account.new_password.label")}</span>
            <input className="input" type="password" autoComplete="new-password" minLength={8} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {password && <span className="small muted">{STRENGTH[score]}</span>}
          {password && newPasswordBlocker(password) && <span className="small muted" aria-live="polite">{newPasswordBlocker(password)}</span>}
          {msg && <p className="err" role="alert">{msg}</p>}
          <Button disabled={busy || newPasswordBlocker(password) !== null} onClick={async () => {
            setBusy(true);
            const { error } = await supabase!.auth.updateUser({ password });
            setBusy(false);
            if (error) { setMsg(friendlyAuthError(error.message)); return; }
            toast(t("account.new_password.updated"), { kind: "good" });
            onDone();
          }}>{busy ? t("account.new_password.saving") : t("account.new_password.save")}</Button>
        </div>
      </div>
    </main>
  );
}
