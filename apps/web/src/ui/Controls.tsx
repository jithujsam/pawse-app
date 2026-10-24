import { useId, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { haptic } from "../haptics";
import { spring } from "../motion";

/** Pill button with spring press feedback and a light haptic. */
export function Button({ variant = "primary", children, onClick, disabled, type = "button", className = "", ...rest }:
  { variant?: "primary" | "secondary" | "text" | "danger" | "ghost"; children: ReactNode; onClick?: () => void; disabled?: boolean; type?: "button" | "submit"; className?: string; "aria-label"?: string }) {
  const cls = variant === "primary" ? "btn" : `btn ${variant}`;
  return (
    <motion.button type={type} className={`${cls} ${className}`} disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.96 }} transition={spring.snappy}
      onClick={() => { if (disabled) return; haptic.tap(); onClick?.(); }} {...rest}>
      {children}
    </motion.button>
  );
}

export function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="switch-row" onClick={() => { haptic.select(); onChange(!checked); }}>
      <span className="switch-text"><span>{label}</span>{hint && <span className="muted small">{hint}</span>}</span>
      <span className="switch" data-on={checked}>
        <motion.i layout transition={spring.snappy} />
      </span>
    </button>
  );
}

/** Segmented control with a sliding highlight. */
export function Segmented<T extends string | boolean>({ value, options, onChange, label }:
  { value: T | undefined; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  const id = useId();
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button key={String(o.value)} type="button" role="radio" aria-checked={on} className="seg" onClick={() => { haptic.select(); onChange(o.value); }}>
            {on && <motion.span layoutId={`seg-${id}`} className="seg-pill" transition={spring.snappy} />}
            <span className="seg-label">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Chip({ pressed, onClick, children, ...rest }: { pressed: boolean; onClick: () => void; children: ReactNode; "aria-label"?: string }) {
  return (
    <motion.button type="button" className="chip" aria-pressed={pressed} whileTap={{ scale: 0.92 }} transition={spring.snappy}
      onClick={() => { haptic.select(); onClick(); }} {...rest}>
      <AnimatePresence initial={false}>
        {pressed && <motion.svg className="chip-check" viewBox="0 0 24 24" initial={{ width: 0, opacity: 0 }} animate={{ width: 16, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={spring.snappy}>
          <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.25 }} />
        </motion.svg>}
      </AnimatePresence>
      {children}
    </motion.button>
  );
}

/** A one-shot burst of hearts or sparkles. Keyed by `burst` so each change fires again. */
export function Burst({ burst, kind = "spark", count = 8 }: { burst: number; kind?: "spark" | "heart"; count?: number }) {
  if (!burst) return null;
  return (
    <div className="burst" aria-hidden key={burst}>
      {Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2 + (burst % 7) * 0.3;
        const r = 70 + ((i * 37 + burst) % 50);
        return (
          <motion.i key={i} className={kind}
            initial={{ x: 0, y: 0, scale: 0.2, opacity: 1 }}
            animate={{ x: Math.cos(a) * r, y: Math.sin(a) * r - 40, scale: kind === "heart" ? 1 : 0.9, opacity: 0, rotate: (i % 2 ? 1 : -1) * 25 }}
            transition={{ duration: 1.1 + (i % 3) * 0.15, ease: [0.16, 1, 0.3, 1] }} />
        );
      })}
    </div>
  );
}

export const Icon = {
  back: <svg viewBox="0 0 24 24" className="ico"><path d="M15 5l-7 7 7 7" /></svg>,
  check: <svg viewBox="0 0 24 24" className="ico"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>,
  close: <svg viewBox="0 0 24 24" className="ico"><path d="M6 6l12 12M18 6L6 18" /></svg>,
  camera: <svg viewBox="0 0 24 24" className="ico"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>,
  chevL: <svg viewBox="0 0 24 24" className="ico"><path d="M15 5l-7 7 7 7" /></svg>,
  chevR: <svg viewBox="0 0 24 24" className="ico"><path d="M9 5l7 7-7 7" /></svg>,
  trash: <svg viewBox="0 0 24 24" className="ico"><path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" /></svg>,
  spark: <svg viewBox="0 0 24 24" className="ico"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" /></svg>,
  lock: <svg viewBox="0 0 24 24" className="ico"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>,
  cloud: <svg viewBox="0 0 24 24" className="ico"><path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6 10a4 4 0 0 0 1 8z" /></svg>,
  bell: <svg viewBox="0 0 24 24" className="ico"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0" /></svg>,
  plus: <svg viewBox="0 0 24 24" className="ico"><path d="M12 5v14M5 12h14" /></svg>,
  paw: <svg viewBox="0 0 24 24" className="ico"><circle cx="7" cy="10" r="1.8" /><circle cx="11" cy="6.5" r="1.8" /><circle cx="15.5" cy="7" r="1.8" /><circle cx="18" cy="11" r="1.8" /><path d="M8.5 17.5c0-2.5 1.8-4.5 3.8-4.5s3.7 2 3.7 4.5c0 1.6-1.4 2-3.7 2s-3.8-.4-3.8-2z" /></svg>,
  chat: <svg viewBox="0 0 24 24" className="ico"><path d="M5 18l-1 3 4-2h9a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v8a3 3 0 0 0 1 2z" /></svg>,
  list: <svg viewBox="0 0 24 24" className="ico"><path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" /></svg>,
  shield: <svg viewBox="0 0 24 24" className="ico"><path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z" /><path d="M9 12l2 2 4-4" /></svg>,
  data: <svg viewBox="0 0 24 24" className="ico"><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></svg>,
  info: <svg viewBox="0 0 24 24" className="ico"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>,
  phone: <svg viewBox="0 0 24 24" className="ico"><rect x="7" y="3" width="10" height="18" rx="2.5" /><path d="M11 18h2" /></svg>,
  flask: <svg viewBox="0 0 24 24" className="ico"><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3" /><path d="M7.5 15h9" /></svg>,
  heart: <svg viewBox="0 0 24 24" className="ico"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>,
  wave: <svg viewBox="0 0 24 24" className="ico"><path d="M3 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0" /><path d="M3 17c2-3 4-3 6 0s4 3 6 0 4-3 6 0" opacity=".5" /></svg>,
  slip: <svg viewBox="0 0 24 24" className="ico"><path d="M12 4v10M7 9l5 5 5-5" /><path d="M5 20h14" /></svg>,
  sun: <svg viewBox="0 0 24 24" className="ico"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>,
  download: <svg viewBox="0 0 24 24" className="ico"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>,
};
