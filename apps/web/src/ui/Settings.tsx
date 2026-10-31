import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useBack } from "../back";
import { haptic } from "../haptics";
import { spring } from "../motion";
import { TopBar } from "./TopBar";
import { Icon } from "./Controls";

/** A titled block of rows, like a phone's own settings. */
export function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="group" aria-label={title}>
      {title && <h3 className="group-title">{title}</h3>}
      <div className="group-body">{children}</div>
    </section>
  );
}

/** One tappable settings row: icon, label, current value, chevron. */
export function Row({ icon, label, value, onClick, tone, badge }: { icon: ReactNode; label: string; value?: ReactNode; onClick: () => void; tone?: "danger"; badge?: { count: number; label: string } }) {
  return (
    <motion.button className="srow" data-tone={tone} onClick={() => { haptic.tap(); onClick(); }} whileTap={{ scale: 0.985 }} transition={spring.snappy}>
      <span className="srow-ico" aria-hidden>{icon}</span>
      <span className="srow-label">{label}</span>
      {badge && <span className="srow-badge"><span aria-hidden>{badge.count}</span><span className="sr-only">{badge.label}</span></span>}
      {value !== undefined && <span className="srow-value">{value}</span>}
      <span className="srow-chev" aria-hidden>{Icon.chevR}</span>
    </motion.button>
  );
}

/** A settings page that slides in over the tab. Back (button, gesture or Android key) closes it. */
export function SubPage({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  useBack(open, onClose);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="subpage" role="dialog" aria-modal="true" aria-label={title}
          initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%", transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }} transition={spring.soft}
          drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={{ left: 0, right: 0.6 }} dragDirectionLock
          onDragEnd={(_, i) => { if (i.offset.x > 110 || i.velocity.x > 600) onClose(); }}>
          <div className="screen subpage-body"><TopBar title={title} back={onClose} />{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
