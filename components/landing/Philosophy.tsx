"use client";

import { motion } from "framer-motion";

export default function Philosophy() {
  return (
    <section
      className="relative py-24 md:py-32 overflow-hidden"
      style={{ background: "var(--color-primary)" }}
    >
      {/* Glow circles */}
      <div
        className="glow-circle w-[500px] h-[500px] -top-40 -right-20"
        style={{ background: "rgba(173,241,207,0.08)" }}
      />
      <div
        className="glow-circle w-[400px] h-[400px] -bottom-40 -left-20"
        style={{ background: "rgba(255,255,255,0.05)" }}
      />

      <motion.div
        className="relative max-w-4xl mx-auto px-5 text-center"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <p
          className="text-sm mb-6"
          style={{
            fontFamily: "Inter",
            fontWeight: 500,
            color: "rgba(173,241,207,0.7)",
            letterSpacing: "0.04em",
          }}
        >
          Most agencies think clients leave because results dropped.
        </p>
        <h2
          className="text-3xl md:text-5xl lg:text-6xl text-balance"
          style={{
            fontFamily: "Instrument Serif, Georgia, serif",
            fontStyle: "italic",
            fontWeight: 400,
            lineHeight: 1.2,
            color: "var(--color-on-primary)",
          }}
        >
          Clients leave because they stopped feeling informed&nbsp;
          <span style={{ color: "var(--color-primary-fixed)" }}>
            — then it&apos;s already too late.
          </span>
        </h2>
        <p
          className="mt-8 max-w-2xl mx-auto text-base"
          style={{
            fontFamily: "Inter",
            color: "rgba(173,241,207,0.8)",
            lineHeight: 1.6,
          }}
        >
          Retention isn&apos;t about better results. It&apos;s about never
          letting a client go quiet. Klaroh is the layer between your work and
          your client&apos;s confidence — a timeline that proves, every day,
          that someone is paying attention.
        </p>
      </motion.div>
    </section>
  );
}
