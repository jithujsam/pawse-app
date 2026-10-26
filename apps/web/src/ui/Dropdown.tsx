import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { haptic } from "../haptics";
import { spring } from "../motion";

export interface DropItem { key: string; label: string; disabled?: boolean }

/** The menu's longest possible height (.dd-menu max-height), used to decide whether it opens upward. */
const MENU_MAX = 280;

/**
 * The app's own dropdown: the same field as the rest of the forms, and a menu on the same surface that opens under it
 * (or over it, near the bottom of the screen). Nothing leaves the app, so it keeps the theme and the flow. Arrow keys
 * move through the menu, Enter picks, Escape or a tap outside closes it.
 */
export function Dropdown({ items, selected, onPick, label, placeholder = "", className = "" }:
  { items: DropItem[]; selected: string | null; onPick: (key: string) => void; label: string; placeholder?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const shown = items.find((i) => i.key === selected);

  function show() {
    const r = wrap.current!.getBoundingClientRect();
    setUp(window.innerHeight - r.bottom < MENU_MAX + 16 && r.top > MENU_MAX + 16);
    setOpen(true);
  }
  function close() {
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }
  function pick(i: DropItem) {
    if (i.disabled) return;
    haptic.select();
    onPick(i.key);
    close();
  }

  // A tap anywhere else closes the menu; the first choice (the current one if there is one) takes the focus.
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    const first = wrap.current?.querySelector<HTMLElement>('[aria-selected="true"]') ?? wrap.current?.querySelector<HTMLElement>('[role="option"]:not([aria-disabled="true"])');
    requestAnimationFrame(() => first?.focus({ preventScroll: true }));
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  function onMenuKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); close(); return; }
    if (e.key === "Tab") { setOpen(false); return; }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const opts = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="option"]:not([aria-disabled="true"])')];
    const at = opts.indexOf(document.activeElement as HTMLElement);
    opts[(at + (e.key === "ArrowDown" ? 1 : -1) + opts.length) % opts.length]?.focus();
  }

  return (
    <div ref={wrap} className={`dd ${className}`}>
      <button ref={trigger} type="button" className="input dropdown-btn" aria-label={label} aria-haspopup="listbox" aria-expanded={open}
        data-empty={!shown} onClick={() => (open ? close() : show())}
        onKeyDown={(e) => { if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) { e.preventDefault(); show(); } }}>
        <span className="dd-text">{shown?.label ?? placeholder}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className={`dd-menu${up ? " up" : ""}`} role="listbox" aria-label={label} onKeyDown={onMenuKey}
            initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={spring.soft}>
            {items.map((i) => (
              <button key={i.key} type="button" role="option" aria-selected={i.key === selected} aria-disabled={i.disabled || undefined}
                data-on={i.key === selected} className="dd-opt" onClick={() => pick(i)}>{i.label}</button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
