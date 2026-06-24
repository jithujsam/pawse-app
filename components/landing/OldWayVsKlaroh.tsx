"use client";

import { motion } from "framer-motion";
import { X, Check } from "lucide-react";

const withoutItems = [
  {
    title: "Shared tool login",
    description:
      "Clients get credentials to Smartlead or Instantly. One wrong click pauses a live campaign.",
  },
  {
    title: "Manual screenshots into Sheets/Notion",
    description:
      "3-4 hours per client each week spent copying data into Slack, email, or a shared doc.",
  },
  {
    title: "Hoping clients don't quietly lose confidence",
    description:
      'No signal between "all seems fine" and a cancellation email.',
  },
];

const withItems = [
  {
    title: "No-login client view",
    description:
      "A shareable link with live stats. Clients see progress. They never touch your tool.",
  },
  {
    title: "Automated live updates",
    description:
      "One remark in Klaroh replaces the Slack message, the email, and the screenshot.",
  },
  {
    title: "A timeline that shows you're paying attention",
    description:
      "Every update, stage change, and remark builds a visible record of your work.",
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

export default function OldWayVsKlaroh() {
  return (
    <section
      className="py-20 md:py-28"
      id="pricing"
      style={{ background: "var(--color-surface-container-low)" }}
    >
      <div className="max-w-5xl mx-auto px-5">
        <motion.p
          className="eyebrow mb-4"
          style={{ color: "var(--color-primary)" }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
        >
          THE OLD WAY vs KLAROH
        </motion.p>
        <motion.h2
          className="section-heading text-3xl md:text-4xl mb-12"
          style={{ color: "var(--color-on-surface)", lineHeight: 1.3 }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          Three things you&apos;re doing today. One simple replacement each.
        </motion.h2>

        <div className="grid md:grid-cols-2 gap-0 md:gap-6">
          {/* Without Klaroh */}
          <motion.div
            className="card mb-4 md:mb-0"
            custom={0}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
          >
            <p
              className="text-lg font-semibold mb-6"
              style={{ fontFamily: "Inter", color: "var(--color-error)" }}
            >
              Without Klaroh
            </p>
            <div className="space-y-5">
              {withoutItems.map((item, i) => (
                <div key={i} className="flex gap-4">
                  <div
                    className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center"
                    style={{
                      background: "rgba(186,26,26,0.10)",
                      color: "var(--color-error)",
                    }}
                  >
                    <X size={16} strokeWidth={2.5} />
                  </div>
                  <div>
                    <p
                      style={{
                        fontFamily: "Inter",
                        fontWeight: 600,
                        fontSize: "14px",
                        color: "var(--color-on-surface)",
                      }}
                    >
                      {item.title}
                    </p>
                    <p
                      style={{
                        fontFamily: "Inter",
                        fontSize: "13px",
                        color: "var(--color-on-surface-variant)",
                        marginTop: "2px",
                      }}
                    >
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* With Klaroh */}
          <motion.div
            className="card"
            custom={1}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
          >
            <p
              className="text-lg font-semibold mb-6"
              style={{ fontFamily: "Inter", color: "var(--color-primary)" }}
            >
              With Klaroh
            </p>
            <div className="space-y-5">
              {withItems.map((item, i) => (
                <div key={i} className="flex gap-4">
                  <div
                    className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center"
                    style={{
                      background: "rgba(173,241,207,0.2)",
                      color: "var(--color-primary)",
                    }}
                  >
                    <Check size={16} strokeWidth={2.5} />
                  </div>
                  <div>
                    <p
                      style={{
                        fontFamily: "Inter",
                        fontWeight: 600,
                        fontSize: "14px",
                        color: "var(--color-on-surface)",
                      }}
                    >
                      {item.title}
                    </p>
                    <p
                      style={{
                        fontFamily: "Inter",
                        fontSize: "13px",
                        color: "var(--color-on-surface-variant)",
                        marginTop: "2px",
                      }}
                    >
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
