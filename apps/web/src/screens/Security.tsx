import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { haptic } from "../haptics";
import { actions, useData, vault } from "../store";
import { Button, Icon, Segmented, Switch } from "../ui/Controls";
import { PinPad } from "../ui/PinPad";
import { Sheet } from "../ui/Sheet";
import { toast } from "../ui/Toast";
import { isWeakPin } from "../vault";
import type { AutoLock } from "../types";

type Flow = null | "set" | "remove" | "change";

export function SecurityCard() {
  const { settings } = useData();
  const [on, setOn] = useState(vault.hasPin());
  const [flow, setFlow] = useState<Flow>(null);

  return (
    <section className="card stack">
      <div className="row" style={{ justifyContent: "flex-start", gap: 8 }}>{Icon.lock}<h2>Privacy and lock</h2></div>
      <Switch checked={on} onChange={(v) => setFlow(v ? "set" : "remove")} label="App lock"
        hint={on ? "PIN on. Everything on this phone is encrypted." : "Ask for a PIN when the app opens"} />
      <AnimatePresence>
        {on && (
          <motion.div className="stack tight" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <span className="field-label">Lock again after</span>
            <Segmented<AutoLock> label="Auto-lock" value={settings.autoLock} onChange={(v) => actions.setSettings({ autoLock: v })}
              options={[{ value: "immediately", label: "At once" }, { value: "1m", label: "1 min" }, { value: "5m", label: "5 min" }]} />
            <Button variant="text" onClick={() => setFlow("change")}>Change PIN</Button>
          </motion.div>
        )}
      </AnimatePresence>
      <p className="muted small">Photos never leave this phone. Nothing is shared, and there are no ads or trackers.</p>
      <Sheet open={flow !== null} onClose={() => setFlow(null)} label={flow === "remove" ? "Turn off app lock" : "Set a PIN"}>
        {flow === "set" && <SetPin onDone={() => { setOn(true); setFlow(null); }} />}
        {flow === "remove" && <CheckPin onOk={async () => { await vault.removePin(); toast("App lock is off"); setOn(false); setFlow(null); }} />}
        {flow === "change" && <ChangePin onDone={() => setFlow(null)} />}
      </Sheet>
    </section>
  );
}

function SetPin({ onDone }: { onDone: () => void }) {
  const [length, setLength] = useState<4 | 6>(4);
  const [first, setFirst] = useState<string | null>(null);
  const [error, setError] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function done(pin: string) {
    if (!first) {
      if (isWeakPin(pin)) { setMsg("That one is easy to guess. Try something less obvious."); setError((e) => e + 1); return; }
      setFirst(pin); setMsg(null); return;
    }
    if (pin !== first) { setFirst(null); setMsg("Those didn't match. Start again."); setError((e) => e + 1); return; }
    setBusy(true);
    await vault.setPin(pin);
    setBusy(false);
    haptic.success();
    toast("App lock is on", { kind: "good" });
    onDone();
  }

  return (
    <div className="stack center-text">
      <h2>{first ? "Enter it again" : "Choose a PIN"}</h2>
      {!first && <Segmented label="PIN length" value={String(length)} onChange={(v) => setLength(v === "6" ? 6 : 4)} options={[{ value: "4", label: "4 digits" }, { value: "6", label: "6 digits" }]} />}
      <p className="muted small" aria-live="polite">{busy ? "Encrypting your data…" : msg ?? "There's no way to recover it, so pick one you'll remember."}</p>
      <PinPad key={`${length}-${first ? 2 : 1}`} length={length} onDone={done} error={error} disabled={busy} label="New PIN" />
    </div>
  );
}

function ChangePin({ onDone }: { onDone: () => void }) {
  const [ok, setOk] = useState(false);
  return ok ? <SetPin onDone={onDone} /> : <CheckPin onOk={() => setOk(true)} />;
}

function CheckPin({ onOk }: { onOk: () => void }) {
  const [error, setError] = useState(0);
  const [length, setLength] = useState(4);
  useEffect(() => { void vault.pinLength().then(setLength); }, []);
  async function done(pin: string) {
    if (!(await vault.check(pin))) { setError((e) => e + 1); return; }
    onOk();
  }
  return (
    <div className="stack center-text">
      <h2>Enter your current PIN</h2>
      <PinPad key={length} length={length} onDone={done} error={error} label="Current PIN" />
    </div>
  );
}
