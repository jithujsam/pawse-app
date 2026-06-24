"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";

const faqs = [
  {
    question: "Does this replace Smartlead or Instantly?",
    answer:
      "No. Klaroh sits on top of whatever sending infrastructure you already use. It pulls in campaign data via API and gives clients a read-only view. Your Smartlead, Instantly, or other tools stay exactly as they are.",
  },
  {
    question: "Will my clients actually check it?",
    answer:
      "That's the theory we're betting on — and we're still validating the exact engagement numbers. What we've heard from agencies so far is that clients who used to ask for weekly updates stop asking once they have a live dashboard. Early signals are promising.",
  },
  {
    question: "Is this just another reporting dashboard?",
    answer:
      "No. Reporting dashboards show numbers. Klaroh shows you're paying attention. The activity timeline — the remarks, stage updates, and context your team posts every day — is the actual product. The stats are just proof that the work is happening.",
  },
  {
    question: "How long does setup take?",
    answer:
      "Most agencies are up and running in under 15 minutes. Connect your Smartlead or Instantly account via API, invite your first client, and you're live. No onboarding calls, no implementation project.",
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section
      className="py-20 md:py-28"
      style={{ background: "var(--color-surface)" }}
    >
      <div className="max-w-3xl mx-auto px-5">
        <motion.p
          className="eyebrow mb-4"
          style={{ color: "var(--color-primary)" }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
        >
          FAQ
        </motion.p>
        <motion.h2
          className="section-heading text-3xl md:text-4xl mb-12"
          style={{ color: "var(--color-on-surface)", lineHeight: 1.3 }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          Questions you&apos;re probably asking.
        </motion.h2>

        <motion.div
          className="space-y-2"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="card p-5"
              style={{ borderRadius: "8px" }}
            >
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() =>
                  setOpenIndex(openIndex === i ? null : i)
                }
              >
                <h3
                  className="text-lg pr-4"
                  style={{
                    fontFamily: "Instrument Serif, Georgia, serif",
                    fontStyle: "italic",
                    fontWeight: 400,
                    color: "var(--color-on-surface)",
                    lineHeight: 1.3,
                  }}
                >
                  {faq.question}
                </h3>
                <motion.span
                  className="shrink-0"
                  style={{
                    color: "var(--color-primary)",
                    fontFamily: "Inter",
                    fontWeight: 300,
                    lineHeight: 1,
                  }}
                  animate={{ rotate: openIndex === i ? 45 : 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Plus size={20} />
                </motion.span>
              </div>
              <motion.div
                initial={false}
                animate={{
                  maxHeight: openIndex === i ? 300 : 0,
                  opacity: openIndex === i ? 1 : 0,
                }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                style={{ overflow: "hidden" }}
              >
                <div className="mt-3">
                  <p
                    style={{
                      fontFamily: "Inter",
                      fontSize: "14px",
                      lineHeight: 1.6,
                      color: "var(--color-on-surface-variant)",
                    }}
                  >
                    {faq.answer}
                  </p>
                </div>
              </motion.div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
