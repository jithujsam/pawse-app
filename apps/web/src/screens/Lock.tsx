import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { kv } from "../db";
import { haptic } from "../haptics";
import { spring } from "../motion";
import { unlockWith, vault } from "../store";
import { signOutAndErase } from "../sync";
import { Button, Icon } from "../ui/Controls";
import { PinPad } from "../ui/PinPad";
import { afterFailure, type Lockout, type Sealed } from "../vault";

/**
 * Shown at launch when the data is encrypted (`sealed`), and when coming back from the background
 * after the auto-lock delay (no `sealed`: the PIN is checked against what is stored).
 */
export function LockScreen({ sealed, pinLength, onUnlock }: { sealed?: Sealed; pinLength: number; onUnlock: () => void }) {
  const [error, setError] = useState(0);
  const [busy, setBusy] = useState(false);
  const [lock, setLock] = useState<Lockout>({ fails: 0, until: 0 });
  const [now, setNow] = useState(Date.now());
  const [forgot, setForgot] = useState(false);
  const [erasing, setErasing] = useState(false);
  const [eraseFailed, setEraseFailed] = useState(false);

  useEffect(() => { void kv.get<Lockout>("lockout").then((l) => l && setLock(l)).catch(() => undefined); }, []);
  useEffect(() => { if (lock.until <= now) return; const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, [lock.until, now]);
  const waiting = Math.max(0, Math.ceil((lock.until - now) / 1000));

  async function tryPin(pin: string) {
    if (waiting) return;
    setBusy(true);
    const ok = sealed ? await unlockWith(pin, sealed) : await vault.check(pin);
    setBusy(false);
    if (ok) {
      haptic.success();
      await kv.del("lockout").catch(() => undefined);
      onUnlock();
      return;
    }
    const next = afterFailure(lock);
    setLock(next); setNow(Date.now());
    await kv.set("lockout", next).catch(() => undefined);
    setError((e) => e + 1);
  }

  async function erase() {
    setErasing(true); setEraseFailed(false);
    // Signs this phone out of the account before wiping it, so the history can't come straight back without a password.
    if (await signOutAndErase()) { onUnlock(); return; }
    setErasing(false); setEraseFailed(true);
  }

  return (
    <motion.main className="screen lock" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.04 }} transition={spring.soft}>
      <motion.div className="lock-ico" initial={{ scale: 0.6, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={spring.bouncy}>{Icon.lock}</motion.div>
      <h1>Welcome back</h1>
      <p className="muted">{waiting ? `Too many tries. Wait ${waiting}s.` : busy ? "Checking…" : lock.fails ? "Wrong PIN. Try again." : "Enter your PIN"}</p>
      <PinPad length={pinLength} onDone={tryPin} error={error} disabled={busy || waiting > 0} label="PIN" />
      <AnimatePresence mode="wait">
        {!forgot
          ? <motion.div key="f"><Button variant="text" onClick={() => setForgot(true)}>Forgot PIN?</Button></motion.div>
          : <motion.div key="e" className="card stack" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <p className="small">The PIN can't be recovered, because the copy on this phone is encrypted with it. You can erase this phone's copy and sign out of your account.</p>
              <p className="small">Your account's backup isn't deleted. To get your history back, sign in again with your email and password (you can reset the password by email). Anything that hadn't backed up yet is lost.</p>
              {eraseFailed && <p className="err" role="alert">Couldn't sign out, so nothing was erased. Check your connection and try again.</p>}
              <div className="actions">
                <Button variant="danger" disabled={erasing} onClick={erase}>{erasing ? "Erasing…" : "Erase and sign out"}</Button>
                <Button variant="secondary" disabled={erasing} onClick={() => setForgot(false)}>Cancel</Button>
              </div>
            </motion.div>}
      </AnimatePresence>
    </motion.main>
  );
}
