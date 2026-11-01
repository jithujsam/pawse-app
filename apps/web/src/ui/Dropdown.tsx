import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { haptic } from "../haptics";
import { spring } from "../motion";

export interface DropItem { key: string; label: string; disabled?: boolean }

/** The menu's longest possible height, and the shortest it is squeezed to. */
const MENU_MAX = 280, MENU_MIN = 140, GAP = 6, EDGE = 12;

/**
 * The app's own dropdown: the same field as the rest of the forms, and a menu on the same surface that opens under it
 * (or over it, where there is more room). The menu is drawn on <body>, placed from the field's position and sized to the
 * room on screen, so a sheet's edges never clip it, and it follows the field when the page scrolls. Nothing leaves the app,
 * so it keeps the theme and the flow. Arrow keys move through the menu, Enter picks, Escape or a tap outside closes it.
 */
export function Dropdown({ items, selected, onPick, label, placeholder = "", className = "" }:
  { items: DropItem[]; selected: string | null; onPick: (key: string) => void; label: string; placeholder?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<{ up: boolean; style: CSSProperties } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const shown = items.find((i) => i.key === selected);

  function measure() {
    const r = wrap.current!.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - EDGE - GAP, above = r.top - EDGE - GAP;
    const up = below < Math.min(MENU_MAX, MENU_MIN) && above > below;
    const room = Math.max(MENU_MIN, Math.min(MENU_MAX, up ? above : below));
    return { up, style: { left: r.left, width: r.width, maxHeight: room, ...(up ? { bottom: window.innerHeight - r.top + GAP } : { top: r.bottom + GAP }) } };
  }
  function show() {
    setPlace(measure());
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
    const inside = (n: Node | null) => !!n && (!!wrap.current?.contains(n) || !!menu.current?.contains(n));
    const outside = (e: PointerEvent) => { if (!inside(e.target as Node)) setOpen(false); };
    // A scroll or resize moves the field: the menu follows it, and closes only once the field has left the screen.
    // (Closing on any scroll shut the menu as it opened when a tap landed while the page was still settling.)
    const moved = (e: Event) => {
      if (inside(e.target as Node) || !wrap.current) return;
      const r = wrap.current.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) setOpen(false);
      else setPlace(measure());
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("scroll", moved, true);
    window.addEventListener("resize", moved);
    requestAnimationFrame(() => {
      const first = menu.current?.querySelector<HTMLElement>('[aria-selected="true"]') ?? menu.current?.querySelector<HTMLElement>('[role="option"]:not([aria-disabled="true"])');
      first?.focus({ preventScroll: true });
      menu.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
    });
    return () => { document.removeEventListener("pointerdown", outside); window.removeEventListener("scroll", moved, true); window.removeEventListener("resize", moved); };
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
      {place && createPortal(
        <AnimatePresence>
          {open && (
            <motion.div ref={menu} className={`dd-menu${place.up ? " up" : ""}`} style={place.style} role="listbox" aria-label={label} onKeyDown={onMenuKey}
              initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={spring.soft}>
              {items.map((i) => (
                <button key={i.key} type="button" role="option" aria-selected={i.key === selected} aria-disabled={i.disabled || undefined}
                  data-on={i.key === selected} className="dd-opt" onClick={() => pick(i)}>{i.label}</button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
