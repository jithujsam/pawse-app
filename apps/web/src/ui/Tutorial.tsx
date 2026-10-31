import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { spring } from "../motion";
import { haptic } from "../haptics";
import { useBack } from "../back";
import { t, type PlainId } from "../text";
import { Button, Icon } from "./Controls";

/**
 * "How Pawse works": a short, swipe-free walkthrough of the whole app, one idea per page. Shown once on each phone
 * (including after the update that added it) and any time from Me → How Pawse works.
 */
const SEEN_KEY = "pawse/tutorial-v1";
const OPEN_EVENT = "pawse:tutorial";

/** Opens the walkthrough from anywhere (Me → How Pawse works). */
export const openTutorial = () => window.dispatchEvent(new Event(OPEN_EVENT));

const PAGES: { icon: keyof typeof Icon; title: PlainId; body: PlainId }[] = [
  { icon: "paw", title: "help.tutorial.p1_title", body: "help.tutorial.p1_body" },
  { icon: "plus", title: "help.tutorial.p2_title", body: "help.tutorial.p2_body" },
  { icon: "flag", title: "help.tutorial.p3_title", body: "help.tutorial.p3_body" },
  { icon: "check", title: "help.tutorial.p4_title", body: "help.tutorial.p4_body" },
  { icon: "chat", title: "help.tutorial.p5_title", body: "help.tutorial.p5_body" },
  { icon: "list", title: "help.tutorial.p6_title", body: "help.tutorial.p6_body" },
];

export function Tutorial({ firstRun }: { firstRun: boolean }) {
  const [open, setOpen] = useState(() => { if (!firstRun) return false; try { return !localStorage.getItem(SEEN_KEY); } catch { return false; } });
  const [i, setI] = useState(0);
  useEffect(() => { const show = () => { setI(0); setOpen(true); }; window.addEventListener(OPEN_EVENT, show); return () => window.removeEventListener(OPEN_EVENT, show); }, []);
  const close = () => { setOpen(false); try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* private mode */ } };
  useBack(open, close);
  const last = i === PAGES.length - 1;
  const page = PAGES[i];
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="tutorial" role="dialog" aria-modal="true" aria-label={t("help.tutorial.label")} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="tutorial-top">
            <span className="small muted">{t("help.tutorial.count", { n: i + 1, total: PAGES.length })}</span>
            {!last && <button className="tutorial-skip" onClick={() => { haptic.tap(); close(); }}>{t("help.tutorial.skip")}</button>}
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={i} className="tutorial-page" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={spring.soft}>
              <span className="tutorial-icon" aria-hidden>{Icon[page.icon]}</span>
              <h2>{t(page.title as never)}</h2>
              <p>{t(page.body as never)}</p>
            </motion.div>
          </AnimatePresence>
          <div className="tutorial-dots" aria-hidden>{PAGES.map((_, k) => <i key={k} data-on={k === i} />)}</div>
          <div className="tutorial-actions">
            {i > 0 && <Button variant="secondary" onClick={() => { haptic.select(); setI(i - 1); }}>{t("help.tutorial.back")}</Button>}
            <Button onClick={() => { haptic.select(); if (last) close(); else setI(i + 1); }}>{last ? t("help.tutorial.done") : t("help.tutorial.next")}</Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
