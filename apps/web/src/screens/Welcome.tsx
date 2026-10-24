import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { rise, slide, stagger } from "../motion";
import { Icon } from "../ui/Controls";
import { Account } from "./Account";
import { Story } from "./Onboarding";

/** Before anything else: the story, then an account. The app isn't usable signed out. */
export function Welcome() {
  const [stage, setStage] = useState<"story" | "auth">("story");
  return (
    <div className="screen onboard">
      <AnimatePresence mode="wait" initial={false} custom={1}>
        <motion.div key={stage} className="step" custom={1} variants={slide} initial="enter" animate="center" exit="exit">
          {stage === "story"
            ? <div className="step-inner"><Story species="dog" onStart={() => setStage("auth")} /></div>
            : (
              <motion.div className="step-inner auth" variants={stagger} initial="hidden" animate="show">
                <motion.button variants={rise} className="icon-btn" aria-label="Back" onClick={() => setStage("story")}>{Icon.back}</motion.button>
                <motion.h1 variants={rise}>Create your account</motion.h1>
                <motion.p variants={rise} className="muted">Your companion and history are tied to your account, so they're safe if you lose or change your phone. Only you can see them.</motion.p>
                <motion.div variants={rise} className="card"><Account compact /></motion.div>
                <motion.p variants={rise} className="muted small">By continuing you confirm you're 18 or older. This is a self-awareness tool, not medical advice.</motion.p>
              </motion.div>
            )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function Restoring() {
  return (
    <main className="screen center-screen" aria-busy="true">
      <motion.div className="lock-ico" animate={{ scale: [1, 0.9, 1] }} transition={{ repeat: Infinity, duration: 1.6 }}>{Icon.cloud}</motion.div>
      <h1>One moment</h1>
      <p className="muted">Checking your account for an existing companion…</p>
    </main>
  );
}
