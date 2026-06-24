"use client";

import { motion } from "framer-motion";

export default function Hero() {
  return (
    <section
      className="relative min-h-screen pt-20 pb-16 md:pt-28 md:pb-24 overflow-hidden"
      style={{ background: "var(--color-surface)" }}
    >
      {/* Glow circles */}
      <div
        className="glow-circle w-[400px] h-[400px] -top-20 -right-20"
        style={{ background: "rgba(173,241,207,0.15)" }}
      />
      <div
        className="glow-circle w-[350px] h-[350px] -bottom-20 -left-20"
        style={{ background: "rgba(0,62,42,0.10)" }}
      />

      <div className="relative max-w-6xl mx-auto px-5">
        {/* Eyebrow */}
        <motion.p
          className="eyebrow mb-5"
          style={{ color: "var(--color-primary)" }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          FOR COLD EMAIL &amp; OUTBOUND AGENCIES
        </motion.p>

        {/* Headline */}
        <motion.h1
          className="hero-heading text-4xl md:text-5xl lg:text-6xl mb-6 text-balance"
          style={{
            color: "var(--color-on-surface)",
            lineHeight: 1.15,
          }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          One shared login.
          <br />
          One wrong click.
          <br />
          One broken campaign.
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          className="text-base md:text-lg mb-10 max-w-2xl"
          style={{ color: "var(--color-on-surface-variant)", lineHeight: 1.6 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
        >
          You hand clients your Smartlead or Instantly login so they can check
          progress.
          <br className="hidden sm:block" />
          One accidental pause and a live campaign goes dark. Klaroh gives them
          a live,
          <br className="hidden sm:block" />
          no-login view — so they stay informed without touching your tool.
        </motion.p>

        {/* CTAs */}
        <motion.div
          className="flex flex-wrap gap-4 mb-14"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <a
            href="https://app.klaroh.online"
            className="btn-primary btn-base"
          >
            Book Your Demo Call
          </a>
          <a href="#how-it-works" className="btn-ghost btn-base">
            See How It Works
          </a>
        </motion.div>

        {/* Dashboard mockup */}
        <motion.div
          className="card card-stat max-w-3xl mx-auto"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          {/* Stat grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { value: "12,847", label: "Sent" },
              { value: "3,421", label: "Opened" },
              { value: "847", label: "Replied" },
              { value: "203", label: "Booked" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div
                  className="type-stat text-3xl md:text-4xl mb-1"
                  style={{ color: "var(--color-on-surface)" }}
                >
                  {stat.value}
                </div>
                <p
                  className="eyebrow"
                  style={{ color: "var(--color-on-surface-variant)" }}
                >
                  {stat.label}
                </p>
              </div>
            ))}
          </div>

          {/* Activity timeline */}
          <div className="space-y-3">
            {[
              {
                badge: "Live",
                text: 'Campaign "Q2 Outreach" running — 847 replies this week',
                time: "2m ago",
                warning: false,
              },
              {
                badge: "Action Required",
                text: "Bounce rate spiked to 12% — review sending warmup",
                time: "14m ago",
                warning: true,
              },
              {
                badge: "Live",
                text: 'New sequence "June Prod" added — 3,200 leads queued',
                time: "1h ago",
                warning: false,
              },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 py-2"
                style={{ borderTop: "1px solid rgba(191,201,193,0.3)" }}
              >
                <span
                  className={`badge ${
                    item.warning ? "badge-warning" : "badge-success"
                  }`}
                >
                  {item.badge}
                </span>
                <span
                  style={{
                    fontFamily: "Inter",
                    fontSize: "13px",
                    color: "var(--color-on-surface-variant)",
                  }}
                >
                  {item.text}
                </span>
                <span
                  className="ml-auto text-xs"
                  style={{ fontFamily: "Inter", color: "var(--color-outline)" }}
                >
                  {item.time}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
