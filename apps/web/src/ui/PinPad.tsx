import { useEffect, useState } from "react";
import { motion, useAnimationControls } from "motion/react";
import { haptic } from "../haptics";
import { spring } from "../motion";
import { t } from "../text";

/** Number pad with filling dots. Calls onDone once `length` digits are in; shakes on `error` changes. */
export function PinPad({ length = 4, onDone, error, disabled, label }: { length?: number; onDone: (pin: string) => void; error: number; disabled?: boolean; label: string }) {
  const [pin, setPin] = useState("");
  const shake = useAnimationControls();

  useEffect(() => {
    if (!error) return;
    haptic.warn();
    setPin("");
    void shake.start({ x: [0, -14, 14, -10, 10, -4, 0], transition: { duration: 0.45 } });
  }, [error, shake]);

  const press = (d: string) => {
    if (disabled) return;
    haptic.tap();
    const next = (pin + d).slice(0, length);
    setPin(next);
    if (next.length === length) setTimeout(() => { onDone(next); setPin(""); }, 120);
  };
  const back = () => { if (!disabled && pin) { haptic.select(); setPin(pin.slice(0, -1)); } };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (/^\d$/.test(e.key)) press(e.key); else if (e.key === "Backspace") back(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="pinpad" aria-label={label}>
      <motion.div className="pin-dots" animate={shake} aria-live="polite" aria-label={t("ui.settings.digits", { count: pin.length, length })}>
        {Array.from({ length }, (_, i) => (
          <motion.i key={i} data-on={i < pin.length} animate={{ scale: i < pin.length ? 1.15 : 1 }} transition={spring.bouncy} />
        ))}
      </motion.div>
      <div className="keys">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <motion.button key={d} className="key" whileTap={{ scale: 0.86 }} transition={spring.snappy} onClick={() => press(d)} disabled={disabled}>{d}</motion.button>
        ))}
        <span />
        <motion.button className="key" whileTap={{ scale: 0.86 }} transition={spring.snappy} onClick={() => press("0")} disabled={disabled}>0</motion.button>
        <motion.button className="key key-back" whileTap={{ scale: 0.86 }} onClick={back} disabled={disabled} aria-label={t("ui.common.delete_key")}>⌫</motion.button>
      </div>
    </div>
  );
}
