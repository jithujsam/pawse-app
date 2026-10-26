import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { haptic } from "../haptics";
import { actions, useData, vault } from "../store";
import { Button, Icon, Select, Switch } from "../ui/Controls";
import { PinPad } from "../ui/PinPad";
import { Sheet } from "../ui/Sheet";
import { toast } from "../ui/Toast";
import { isWeakPin } from "../vault";
import { t } from "../text";
import type { AutoLock } from "../types";

type Flow = null | "set" | "remove" | "change";

export function SecurityCard() {
  const { settings } = useData();
  const [on, setOn] = useState(vault.hasPin());
  const [flow, setFlow] = useState<Flow>(null);

  return (
    <section className="card stack">
      <div className="row" style={{ justifyContent: "flex-start", gap: 8 }}>{Icon.lock}<h2>{t("security.lock.title")}</h2></div>
      <Switch checked={on} onChange={(v) => setFlow(v ? "set" : "remove")} label={t("security.lock.switch")}
        hint={on ? t("security.lock.on_hint") : t("security.lock.off_hint")} />
      <AnimatePresence>
        {on && (
          <motion.div className="stack tight" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <span className="field-label">{t("security.lock.again")}</span>
            <Select<AutoLock> label={t("security.lock.auto_aria")} value={settings.autoLock} onChange={(v) => actions.setSettings({ autoLock: v })}
              options={[{ value: "immediately", label: t("security.lock.immediately") }, { value: "1m", label: t("security.lock.one_minute") }, { value: "5m", label: t("security.lock.five_minutes") }]} />
            <Button variant="text" onClick={() => setFlow("change")}>{t("security.lock.change")}</Button>
          </motion.div>
        )}
      </AnimatePresence>
      <p className="muted small">{t("privacy.summary.line")}</p>
      <Sheet open={flow !== null} onClose={() => setFlow(null)} label={flow === "remove" ? t("security.lock.sheet_off") : t("security.lock.sheet_set")}>
        {flow === "set" && <SetPin onDone={() => { setOn(true); setFlow(null); }} />}
        {flow === "remove" && <CheckPin onOk={async () => { await vault.removePin(); toast(t("security.lock.is_off")); setOn(false); setFlow(null); }} />}
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
      if (isWeakPin(pin)) { setMsg(t("security.pin.weak")); setError((e) => e + 1); return; }
      setFirst(pin); setMsg(null); return;
    }
    if (pin !== first) { setFirst(null); setMsg(t("security.pin.mismatch")); setError((e) => e + 1); return; }
    setBusy(true);
    await vault.setPin(pin);
    setBusy(false);
    haptic.success();
    toast(t("security.lock.is_on"), { kind: "good" });
    onDone();
  }

  return (
    <div className="stack center-text">
      <h2>{first ? t("security.pin.again") : t("security.pin.choose")}</h2>
      {!first && <Select label={t("security.pin.length")} value={String(length)} onChange={(v) => setLength(v === "6" ? 6 : 4)} options={[{ value: "4", label: t("security.pin.four") }, { value: "6", label: t("security.pin.six") }]} />}
      <p className="muted small" aria-live="polite">{busy ? t("security.pin.encrypting") : msg ?? t("security.pin.no_recovery")}</p>
      <PinPad key={`${length}-${first ? 2 : 1}`} length={length} onDone={done} error={error} disabled={busy} label={t("security.pin.new_label")} />
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
      <h2>{t("security.lock.current")}</h2>
      <PinPad key={length} length={length} onDone={done} error={error} label={t("security.lock.current_label")} />
    </div>
  );
}
