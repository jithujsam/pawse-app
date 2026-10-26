import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { APP_VERSION, runUpdate, useUpdatePrompt } from "../update";
import { updatePhase } from "../copy";
import { t, tt } from "../text";
import { useData } from "../store";
import { useBack } from "../back";
import { haptic } from "../haptics";
import { spring } from "../motion";
import { Button, Icon } from "./Controls";

/** Shown once the app has loaded when a newer version exists. Same look as the milestone dialog; Back and Escape mean Later. */
export function UpdateDialog() {
  const { tone } = useData().settings;
  const c = { title: t("update.dialog.title"), sub: tt("update.dialog.sub", tone), now: t("update.dialog.now"), later: t("update.dialog.later"), skip: t("update.dialog.skip"), whatsNew: t("update.dialog.whats_new") };
  const { latest, later, skip } = useUpdatePrompt();
  const [percent, setPercent] = useState<number | null>(null);
  const busy = percent !== null;
  const ref = useRef<HTMLDivElement>(null);
  const close = () => { if (!busy) later(); };
  useBack(!!latest, close);

  useEffect(() => {
    if (!latest) return;
    const prev = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => ref.current?.querySelector<HTMLElement>(".btn")?.focus({ preventScroll: true }), 250);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key !== "Tab" || !ref.current) return;
      const els = [...ref.current.querySelectorAll<HTMLElement>("button")].filter((x) => !x.hasAttribute("disabled"));
      if (!els.length) return;
      const first = els[0], last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); document.removeEventListener("keydown", onKey); prev?.focus?.({ preventScroll: true }); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latest, busy]);

  const notes = (latest?.notes ?? "").split("\n").map((x) => x.trim()).filter(Boolean);
  return createPortal(
    <AnimatePresence>
      {latest && (
        <motion.div className="scrim center" onClick={close} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div ref={ref} className="celebrate update-dialog" role="dialog" aria-modal="true" aria-label={c.title} onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.92, opacity: 0, y: 24 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }} transition={spring.soft}>
            <header className="update-head">
              <h2>{c.title}</h2>
              <p className="muted">{c.sub}</p>
            </header>
            <div className="update-versions" aria-label={t("update.dialog.from_to", { from: APP_VERSION.name, to: latest.name })}>
              <span><small>{t("update.dialog.current")}</small><b className="pill">v{APP_VERSION.name}</b></span>
              <span className="update-arrow" aria-hidden>{Icon.chevR}</span>
              <span><small>{t("update.dialog.new")}</small><b className="pill on">v{latest.name}</b></span>
            </div>
            {notes.length > 0 && (
              <section className="update-notes" aria-label={c.whatsNew}>
                <h3>{c.whatsNew}</h3>
                <div>{notes.map((n, i) => <p key={i}>{n}</p>)}</div>
              </section>
            )}
            <Button disabled={busy} onClick={() => { setPercent(0); void runUpdate(latest, setPercent).finally(() => setPercent(null)); }}>
              {busy ? updatePhase(percent) : <>{Icon.download}<span>{c.now}</span></>}
            </Button>
            <div className="update-actions">
              <Button variant="text" disabled={busy} onClick={() => { haptic.select(); skip(); }}>{c.skip}</Button>
              <Button variant="secondary" disabled={busy} onClick={later}>{c.later}</Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
