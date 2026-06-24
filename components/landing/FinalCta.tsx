"use client";

import { motion } from "framer-motion";

export default function FinalCta() {
  return (
    <section
      className="py-20 md:py-28 text-center"
      style={{ background: "var(--color-surface-container-low)" }}
    >
      <motion.div
        className="max-w-3xl mx-auto px-5"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        <h2
          className="text-3xl md:text-4xl mb-6 text-balance"
          style={{
            fontFamily: "Instrument Serif, Georgia, serif",
            fontStyle: "italic",
            fontWeight: 400,
            color: "var(--color-on-surface)",
            lineHeight: 1.2,
          }}
        >
          Stop handing out logins.
          <br />
          Start handing out confidence.
        </h2>
        <a
          href="https://app.klaroh.online"
          className="btn-primary btn-base text-base px-8 py-4"
        >
          Book Your Demo Call
        </a>
        <p
          className="mt-5 text-sm"
          style={{
            fontFamily: "Inter",
            color: "var(--color-on-surface-variant)",
            lineHeight: 1.5,
          }}
        >
          Built for agencies who&apos;ve already been burned once.
        </p>
      </motion.div>
    </section>
  );
}
