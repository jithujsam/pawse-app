import type { Transition, Variants } from "motion/react";

/** One set of springs for the whole app, so everything moves with the same personality. */
export const spring = {
  /** Buttons, chips, toggles: quick and crisp. */
  snappy: { type: "spring", stiffness: 520, damping: 34, mass: 0.8 } as Transition,
  /** Cards, sheets, screens: soft landing. */
  soft: { type: "spring", stiffness: 260, damping: 30 } as Transition,
  /** Celebrations and the companion: a little bounce. */
  bouncy: { type: "spring", stiffness: 380, damping: 16 } as Transition,
  /** Numbers and progress: no overshoot. */
  calm: { type: "spring", stiffness: 120, damping: 24 } as Transition,
};

export const ease = [0.22, 0.8, 0.3, 1] as const;

/** Screens and steps: a plain fade in and out, the same everywhere. */
export const fade: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1, transition: { duration: 0.2, ease: "easeOut" } },
  exit: { opacity: 0, transition: { duration: 0.15, ease: "easeIn" } },
};

/** Children arrive one after another. */
export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
};
/** Sections and cards: a plain fade in. */
export const rise: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.25, ease: "easeOut" } },
};

/** Press feedback for anything tappable. */
export const press = { whileTap: { scale: 0.96 }, transition: spring.snappy };
