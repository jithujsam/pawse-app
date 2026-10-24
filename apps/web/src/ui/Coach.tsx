import { useLayoutEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { spring } from "../motion";
import { Button } from "./Controls";

interface Step { target: string; title: string; body: string }

/** First-run tips: a soft spotlight walks over the three things that matter on Home. */
export function Coach({ name, onDone }: { name: string; onDone: () => void }) {
  const steps: Step[] = [
    { target: ".live-pet", title: `This is ${name}`, body: "Tap to say hello. How they look is how things are going." },
    { target: ".checkin", title: "Check in once a day", body: "Slip or goal met, it takes ten seconds. Honest logs are the whole point." },
    { target: ".tabbar", title: "Patterns live here", body: "Your calendar and weekly report fill in as you log." },
  ];
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const el = document.querySelector(steps[i].target);
      if (!el) { setRect(null); return; }
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      setTimeout(() => setRect(el.getBoundingClientRect()), 260);
    };
    const t = setTimeout(measure, i === 0 ? 900 : 0);
    window.addEventListener("resize", measure);
    return () => { clearTimeout(t); window.removeEventListener("resize", measure); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  const step = steps[i];
  const pad = 10;
  const below = rect ? rect.top + rect.height / 2 < window.innerHeight / 2 : true;
  const next = () => (i < steps.length - 1 ? setI(i + 1) : onDone());

  return (
    <AnimatePresence>
      {rect && (
        <motion.div className="coach" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={next}>
          <motion.div className="coach-spot" animate={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} transition={spring.soft} />
          <motion.div key={i} className="coach-tip" role="dialog" aria-label={step.title}
            style={below ? { top: Math.min(window.innerHeight - 200, rect.bottom + pad + 12) } : { bottom: window.innerHeight - rect.top + pad + 12 }}
            initial={{ opacity: 0, y: below ? -10 : 10 }} animate={{ opacity: 1, y: 0 }} transition={spring.soft} onClick={(e) => e.stopPropagation()}>
            <h2>{step.title}</h2>
            <p className="muted">{step.body}</p>
            <div className="row">
              <span className="muted small">{i + 1} of {steps.length}</span>
              <div className="row" style={{ gap: 4 }}>
                <Button variant="text" onClick={onDone}>Skip</Button>
                <Button onClick={next}>{i < steps.length - 1 ? "Next" : "Got it"}</Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
