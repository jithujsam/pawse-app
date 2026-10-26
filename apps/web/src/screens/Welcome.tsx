import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { fade, rise, stagger } from "../motion";
import { Icon, PawLoader, PawLogo } from "../ui/Controls";
import { Account } from "./Account";
import { Story } from "./Onboarding";
import { APP_NAME } from "../brand";
import { t } from "../text";

/** Before anything else: the story, then an account. The app isn't usable signed out. */
export function Welcome() {
  const [stage, setStage] = useState<"story" | "auth">("story");
  return (
    <div className="screen onboard">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={stage} className="step" variants={fade} initial="enter" animate="center" exit="exit">
          {stage === "story"
            ? <div className="step-inner">
                <div className="brand"><PawLogo size={34} /><b>{APP_NAME}</b></div>
                <Story species="dog" onStart={() => setStage("auth")} />
              </div>
            : (
              <motion.div className="step-inner auth" variants={stagger} initial="hidden" animate="show">
                <motion.button variants={rise} className="icon-btn" aria-label={t("ui.common.back")} onClick={() => setStage("story")}>{Icon.back}</motion.button>
                <motion.h1 variants={rise}>{t("welcome.account.title")}</motion.h1>
                <motion.p variants={rise} className="muted">{t("welcome.account.body")}</motion.p>
                <motion.div variants={rise} className="card"><Account compact /></motion.div>
                <motion.p variants={rise} className="muted small">{t("welcome.account.legal")}</motion.p>
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
      <h1>{t("welcome.restoring.title")}</h1>
      <p className="muted">{t("welcome.restoring.body")}</p>
    </main>
  );
}
