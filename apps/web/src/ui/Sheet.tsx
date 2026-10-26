import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useDragControls } from "motion/react";
import { spring } from "../motion";
import { useBack } from "../back";

/** Bottom sheet: drag the handle down to dismiss, Escape closes, focus stays inside. */
export function Sheet({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  const controls = useDragControls();
  const ref = useRef<HTMLDivElement>(null);
  useBack(open, onClose);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => ref.current?.querySelector<HTMLElement>("input, button:not(.sheet-handle), select, textarea")?.focus({ preventScroll: true }), 320);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !ref.current) return;
      const els = [...ref.current.querySelectorAll<HTMLElement>("button, input, select, textarea, [tabindex]:not([tabindex='-1'])")].filter((x) => !x.hasAttribute("disabled"));
      if (!els.length) return;
      const first = els[0], last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); document.removeEventListener("keydown", onKey); prev?.focus?.({ preventScroll: true }); };
  }, [open, onClose]);

  // On <body>, so no transformed or filtered ancestor can shrink the scrim or break its blur.
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="scrim" onClick={onClose}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.2 } }}>
          <motion.div ref={ref} className="sheet" role="dialog" aria-modal="true" aria-label={label}
            onClick={(e) => e.stopPropagation()}
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%", transition: { duration: 0.24, ease: [0.4, 0, 1, 1] } }}
            transition={spring.soft}
            drag="y" dragListener={false} dragControls={controls} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0.04, bottom: 0.7 }}
            onDragEnd={(_, i) => { if (i.offset.y > 110 || i.velocity.y > 600) onClose(); }}>
            <button className="sheet-handle" aria-label="Drag down or tap to close" onPointerDown={(e) => controls.start(e)} onClick={onClose}><i /></button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
