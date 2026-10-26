import { useRef, useState, type ReactNode } from "react";
import { motion } from "motion/react";
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

export interface Opt<T> { value: T; label: string; disabled?: boolean }
/** Options whose value and label are the same words. */
export const plainOpts = (xs: readonly string[]): Opt<string>[] => xs.map((x) => ({ value: x, label: x }));

/** A dropdown. Shows `placeholder` until something is picked. Uses the phone's own picker, so it works with screen readers and large text. */
export function Select<T extends string | number | boolean>({ value, options, onChange, label, placeholder = "Choose…", className = "", clearLabel, onClear }:
  { value: T | undefined | null; options: Opt<T>[]; onChange: (v: T) => void; label: string; placeholder?: string; className?: string; clearLabel?: string; onClear?: () => void }) {
  const at = options.findIndex((o) => o.value === value);
  return (
    <select className={`input dropdown ${className}`} aria-label={label} value={at < 0 ? "" : String(at)} data-empty={at < 0}
      onChange={(e) => {
        haptic.select();
        if (e.target.value === CLEAR) { onClear?.(); return; }
        const o = options[Number(e.target.value)];
        if (o) onChange(o.value);
      }}>
      {at < 0 && <option value="" disabled>{placeholder}</option>}
      {at >= 0 && clearLabel && onClear && <option value={CLEAR}>{clearLabel}</option>}
      {options.map((o, i) => <option key={String(o.value)} value={i} disabled={o.disabled}>{o.label}</option>)}
    </select>
  );
}

const OTHER = "__other";
const CLEAR = "__clear";

/**
 * A dropdown of common answers that always ends with "Something else…", which opens a text box. The value is the
 * answer itself: one of the options' values, or whatever the person typed. With `commitLabel` the typed answer is only
 * passed on when they tap that button, for forms where each change is saved straight away.
 */
export function SelectOther({ value, options, onChange, label, placeholder = "Choose…", otherLabel = "Something else…", otherPlaceholder = "Type your own", maxLength = 60, commitLabel, clearLabel }:
  { value: string; options: Opt<string>[]; onChange: (v: string) => void; label: string; placeholder?: string; otherLabel?: string; otherPlaceholder?: string; maxLength?: number; commitLabel?: string; clearLabel?: string }) {
  const known = options.some((o) => o.value === value);
  const [custom, setCustom] = useState(value !== "" && !known);
  const [draft, setDraft] = useState(value !== "" && !known ? value : "");
  const ref = useRef<HTMLInputElement>(null);
  const own = custom || (value !== "" && !known);
  const text = commitLabel ? draft : value;
  const at = options.findIndex((o) => o.value === value);
  const shown = own ? OTHER : at < 0 ? "" : String(at);
  const commit = () => { const t = draft.trim(); if (t) onChange(t); };
  return (
    <div className="stack tight">
      <select className="input dropdown" aria-label={label} value={shown} data-empty={shown === ""}
        onChange={(e) => {
          haptic.select();
          if (e.target.value === CLEAR) { setCustom(false); setDraft(""); onChange(""); return; }
          if (e.target.value === OTHER) { setCustom(true); if (!commitLabel) onChange(""); requestAnimationFrame(() => ref.current?.focus()); return; }
          const o = options[Number(e.target.value)];
          if (!o) return;
          setCustom(false); setDraft("");
          onChange(o.value);
        }}>
        {shown === "" && <option value="" disabled>{placeholder}</option>}
        {shown !== "" && clearLabel && <option value={CLEAR}>{clearLabel}</option>}
        {options.map((o, i) => <option key={o.value} value={i} disabled={o.disabled}>{o.label}</option>)}
        <option value={OTHER}>{otherLabel}</option>
      </select>
      {own && (
        <div className="other-row">
          <input ref={ref} className="input" autoComplete="off" maxLength={maxLength} value={text} placeholder={otherPlaceholder} aria-label={`${label}: ${otherPlaceholder.toLowerCase()}`}
            onChange={(e) => (commitLabel ? setDraft(e.target.value) : onChange(e.target.value))}
            onKeyDown={(e) => { if (commitLabel && e.key === "Enter") { e.preventDefault(); commit(); } }} />
          {commitLabel && <Button variant="secondary" disabled={!draft.trim() || draft.trim() === value} onClick={commit}>{commitLabel}</Button>}
        </div>
      )}
    </div>
  );
}

/**
 * Pick any number of answers from a dropdown; each one appears below as a tag that a tap removes. "Something else…"
 * adds a typed answer. Values not in `options` (typed ones) are shown as they are.
 */
export function MultiSelect({ value, options, onChange, label, max = 8, placeholder = "Add one…", otherLabel = "Something else…", otherPlaceholder = "Type your own", maxLength = 80, allowOther = true, ownPrefix = "" }:
  { value: string[]; options: Opt<string>[]; onChange: (v: string[]) => void; label: string; max?: number; placeholder?: string; otherLabel?: string; otherPlaceholder?: string; maxLength?: number; allowOther?: boolean; ownPrefix?: string }) {
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const full = value.length >= max;
  const left = options.filter((o) => !value.includes(o.value));
  const labelOf = (v: string) => options.find((o) => o.value === v)?.label ?? (ownPrefix && v.startsWith(ownPrefix) ? v.slice(ownPrefix.length).trim() : v);
  const add = (v: string) => { if (v && !value.includes(v) && !full) onChange([...value, v]); };
  const addOwn = () => { const t = draft.trim(); if (t) add(ownPrefix ? ownPrefix + t.replace(/,/g, " ") : t); setDraft(""); setTyping(false); };
  return (
    <div className="stack tight">
      {value.length > 0 && (
        <div className="chips" role="list" aria-label={label}>
          {value.map((v) => (
            <button key={v} type="button" role="listitem" className="chip tag" aria-label={`Remove ${labelOf(v)}`} onClick={() => { haptic.select(); onChange(value.filter((x) => x !== v)); }}>
              {labelOf(v)}{Icon.close}
            </button>
          ))}
        </div>
      )}
      {!full && (
        <select className="input dropdown" aria-label={`${label}: add`} value="" data-empty
          onChange={(e) => {
            haptic.select();
            if (e.target.value === OTHER) { setTyping(true); requestAnimationFrame(() => ref.current?.focus()); return; }
            const o = left[Number(e.target.value)];
            if (o) { setTyping(false); add(o.value); }
          }}>
          <option value="" disabled>{value.length ? "Add another…" : placeholder}</option>
          {left.map((o, i) => <option key={o.value} value={i}>{o.label}</option>)}
          {allowOther && <option value={OTHER}>{otherLabel}</option>}
        </select>
      )}
      {typing && !full && (
        <div className="other-row">
          <input ref={ref} className="input" autoComplete="off" maxLength={maxLength} value={draft} placeholder={otherPlaceholder} aria-label={`${label}: ${otherPlaceholder.toLowerCase()}`}
            onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOwn(); } }} />
          <Button variant="secondary" disabled={!draft.trim()} onClick={addOwn}>Add</Button>
        </div>
      )}
    </div>
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

/** The paw logo, drawn in the accent so it follows the theme and accent colour. Same shape as public/logo-mark.svg. */
export function PawLogo({ size = 96, className = "" }: { size?: number; className?: string }) {
  return <svg className={`logo ${className}`} viewBox="200 265 850 710" width={size} height={size} aria-hidden fill="currentColor"><ellipse cx="314" cy="586" rx="107" ry="118" transform="rotate(-22 314 586)" /><ellipse cx="493" cy="407" rx="108" ry="135" transform="rotate(-8 493 407)" /><ellipse cx="754" cy="407" rx="109" ry="135" transform="rotate(8 754 407)" /><ellipse cx="933" cy="586" rx="108" ry="120" transform="rotate(22 933 586)" /><path d="M625 552 C700 552 760 620 790 670 C830 730 880 745 905 800 C930 860 915 960 820 966 C740 970 690 918 625 918 C560 918 510 970 430 966 C335 960 320 860 345 800 C370 745 420 730 460 670 C490 620 550 552 625 552 Z" /></svg>;
}

/** The loading paw: pale, then each toe and the palm fill with the accent in turn, the whole paw holds a beat, and it goes again. */
export const PawLoader = ({ size = 88 }: { size?: number }) => <PawLogo size={size} className="paw-load" />;

export const Icon = {
  back: <svg viewBox="0 0 24 24" className="ico"><path d="M15 5l-7 7 7 7" /></svg>,
  check: <svg viewBox="0 0 24 24" className="ico"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>,
  close: <svg viewBox="0 0 24 24" className="ico"><path d="M6 6l12 12M18 6L6 18" /></svg>,
  more: <svg viewBox="0 0 24 24" className="ico"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>,
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
  flag: <svg viewBox="0 0 24 24" className="ico"><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></svg>,
  palette: <svg viewBox="0 0 24 24" className="ico"><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.6-1.6 0-1.3-1-1.6-1-2.6 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5c0-4-4-7.2-9-7.2z" /><circle cx="7.5" cy="11" r="1" /><circle cx="10.5" cy="7" r="1" /><circle cx="15" cy="7.5" r="1" /></svg>,
  sun: <svg viewBox="0 0 24 24" className="ico"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>,
  download: <svg viewBox="0 0 24 24" className="ico"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>,
};

/** Which track a screen is showing, where more than one could be meant. "Paused" is the approved track label. */
export function TrackContext({ name, pet, paused }: { name: string; pet: string; paused?: boolean }) {
  return <p className="track-context small"><span className="muted">Showing</span> <b>{name}</b> <span className="muted">· {pet}</span>{paused && <span className="tag">Paused</span>}</p>;
}
