"use client";

import { motion } from "framer-motion";
import { Lock, Bell } from "lucide-react";

const problems = [
  {
    stat: "3-4 hrs/wk",
    statLabel: "Per Client",
    description:
      "That's how long your team spends each week pulling screenshots, pasting them into Slack, and formatting updates for a single client. It's not billable. It's just overhead.",
    icon: null,
  },
  {
    title: "Every login is a risk",
    description:
      "Each client you share credentials with is one accidental pause away from breaking a live campaign. You've seen it happen. Or you're waiting for it.",
    icon: Lock,
    iconBg: "rgba(186,26,26,0.10)",
    iconColor: "var(--color-error)",
  },
  {
    title: '"No news" isn\'t good news',
    description:
      "When clients go quiet, they're not satisfied — they're detaching. By the time they send a cancellation, they stopped feeling informed weeks ago.",
    icon: Bell,
    iconBg: "rgba(173,241,207,0.2)",
    iconColor: "var(--color-primary)",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.1 },
  }),
};

export default function TheProblem() {
  return (
    <section
      className="py-20 md:py-28"
      id="features"
      style={{ background: "var(--color-surface-container-low)" }}
    >
      <div className="max-w-6xl mx-auto px-5">
        <motion.p
          className="eyebrow mb-4"
          style={{ color: "var(--color-primary)" }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
        >
          THE PROBLEM
        </motion.p>
        <motion.h2
          className="section-heading text-3xl md:text-4xl mb-12 text-balance"
          style={{ color: "var(--color-on-surface)", lineHeight: 1.3 }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          You&apos;re not an agency. You&apos;re a screenshot factory.
        </motion.h2>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Card 1: stat card */}
          <motion.div
            className="card"
            custom={0}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
          >
            <div
              className="type-stat text-5xl md:text-6xl mb-3"
              style={{ color: "var(--color-primary)" }}
            >
              {problems[0].stat}
            </div>
            <p
              className="eyebrow mb-2"
              style={{ color: "var(--color-primary)" }}
            >
              {problems[0].statLabel}
            </p>
            <p
              style={{
                fontFamily: "Inter",
                fontSize: "14px",
                lineHeight: 1.6,
                color: "var(--color-on-surface-variant)",
              }}
            >
              {problems[0].description}
            </p>
          </motion.div>

          {/* Card 2 */}
          <motion.div
            className="card"
            custom={1}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
              style={{
                background: problems[1].iconBg,
                color: problems[1].iconColor,
              }}
            >
              <Lock size={20} />
            </div>
            <p
              style={{
                fontFamily: "Inter",
                fontWeight: 600,
                fontSize: "15px",
                marginBottom: "8px",
                color: "var(--color-on-surface)",
              }}
            >
              {problems[1].title}
            </p>
            <p
              style={{
                fontFamily: "Inter",
                fontSize: "14px",
                lineHeight: 1.6,
                color: "var(--color-on-surface-variant)",
              }}
            >
              {problems[1].description}
            </p>
          </motion.div>

          {/* Card 3 */}
          <motion.div
            className="card"
            custom={2}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
              style={{
                background: problems[2].iconBg,
                color: problems[2].iconColor,
              }}
            >
              <Bell size={20} />
            </div>
            <p
              style={{
                fontFamily: "Inter",
                fontWeight: 600,
                fontSize: "15px",
                marginBottom: "8px",
                color: "var(--color-on-surface)",
              }}
            >
              {problems[2].title}
            </p>
            <p
              style={{
                fontFamily: "Inter",
                fontSize: "14px",
                lineHeight: 1.6,
                color: "var(--color-on-surface-variant)",
              }}
            >
              {problems[2].description}
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
