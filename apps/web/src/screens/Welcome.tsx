import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { rise, slide, stagger } from "../motion";
import { Icon, PawLoader, PawLogo } from "../ui/Controls";
import { Account } from "./Account";
import { Story } from "./Onboarding";
import { APP_NAME } from "../brand";

/** Before anything else: the story, then an account. The app isn't usable signed out. */
export function Welcome() {
  const [stage, setStage] = useState<"story" | "auth">("story");
  return (
    <div className="screen onboard">
      <AnimatePresence mode="wait" initial={false} custom={1}>
        <motion.div key={stage} className="step" custom={1} variants={slide} initial="enter" animate="center" exit="exit">
          {stage === "story"
            ? <div className="step-inner">
                <div className="brand"><PawLogo size={34} /><b>{APP_NAME}</b></div>
                <Story species="dog" onStart={() => setStage("auth")} />
              </div>
            : (
              <motion.div className="step-inner auth" variants={stagger} initial="hidden" animate="show">
                <motion.button variants={rise} className="icon-btn" aria-label="Back" onClick={() => setStage("story")}>{Icon.back}</motion.button>
                <motion.h1 variants={rise}>Create your account</motion.h1>
                <motion.p variants={rise} className="muted">Your pet and your progress are tied to your account, so they're safe if you lose or change your phone. Only you can see them.</motion.p>
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
      <PawLoader />
      <h1>One moment</h1>
      <p className="muted">Checking your account for an existing pet…</p>
    </main>
  );
}
