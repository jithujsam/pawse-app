import { useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { spring } from "../motion";

interface Toast { id: number; text: string; action?: { label: string; run: () => void }; extra?: { label: string; run: () => void }; kind: "info" | "good" | "bad" }

let toasts: Toast[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(text: string, opts: { action?: Toast["action"]; extra?: Toast["action"]; kind?: Toast["kind"]; ms?: number } = {}) {
  const t: Toast = { id: ++seq, text, action: opts.action, extra: opts.extra, kind: opts.kind ?? "info" };
  toasts = [...toasts.slice(-2), t];
  emit();
  setTimeout(() => dismiss(t.id), opts.ms ?? (opts.action ? 5000 : 2600));
}
const dismiss = (id: number) => { toasts = toasts.filter((t) => t.id !== id); emit(); };

export function ToastHost() {
  const list = useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => toasts);
  return (
    <div className="toasts" role="status" aria-live="polite">
      <AnimatePresence initial={false}>
        {list.map((t) => (
          <motion.div key={t.id} layout className={`toast ${t.kind}`}
            initial={{ opacity: 0, y: 24, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96, transition: { duration: 0.16 } }} transition={spring.soft}
            drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.5}
            onDragEnd={(_, i) => { if (Math.abs(i.offset.x) > 80) dismiss(t.id); }}>
            <span>{t.text}</span>
            {t.extra && <button className="toast-action" onClick={() => { t.extra!.run(); dismiss(t.id); }}>{t.extra.label}</button>}
            {t.action && <button className="toast-action" onClick={() => { t.action!.run(); dismiss(t.id); }}>{t.action.label}</button>}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
