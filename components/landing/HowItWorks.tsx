"use client";

import { motion } from "framer-motion";

const features = [
  {
    title: "Live dashboard, no login required",
    description:
      "Clients get a shareable link — no account, no password, no risk. They see live campaign stats: sent, opened, replied, booked. That's it. Your Smartlead credentials stay yours.",
    stats: [
      { value: "12.8k", label: "Sent" },
      { value: "3.4k", label: "Opened" },
      { value: "847", label: "Replied" },
      { value: "203", label: "Booked" },
    ],
  },
  {
    title: "Automated updates, zero screenshots",
    description:
      "Post a remark once and it's visible to the client instantly — no Slack thread, no email chain, no copy-paste. Each update shows a stage, a timestamp, and context.",
    timeline: [
      { badge: "Live", text: "Campaign running — steady reply rate", time: "" },
      {
        badge: "Live",
        text: "Q2 Outreach sequence — 847 replies this week, reply rate holding at 6.8%",
        time: "Today, 10:23 AM",
      },
      {
        badge: "Action Required",
        text: 'Bounce rate hit 12% on the "June Prod" list — reviewing warming status',
        time: "Yesterday, 4:15 PM",
        warning: true,
      },
      {
        badge: "Live",
        text: 'Sent 3,200 new leads into "June Prod" sequence — first results expected Tuesday',
        time: "Yesterday, 9:45 AM",
      },
    ],
  },
  {
    title: "A timeline that proves you're paying attention",
    description:
      "Every campaign update, stage change, and team remark lives in a scrollable timeline. Clients see the cadence of your work — not just the results.",
    activityTimeline: [
      {
        badge: "Live",
        text: "Campaign running — 847 replies, 6.8% reply rate",
        time: "Today, 10:23 AM",
        color: "var(--color-primary)",
      },
      {
        badge: "Campaign Paused",
        text: 'Bounce spike paused "June Prod" — warming review in progress',
        time: "Yesterday, 4:15 PM",
        color: "var(--color-error)",
        warning: true,
      },
      {
        badge: "Live",
        text: '3,200 leads loaded into "June Prod" sequence',
        time: "Yesterday, 9:45 AM",
        color: "var(--color-primary)",
      },
      {
        badge: "Live",
        text: "A/B test variant B winning by 22% — pausing variant A",
        time: "2 days ago, 2:30 PM",
        color: "var(--color-primary)",
      },
    ],
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

export default function HowItWorks() {
  return (
    <section
      className="py-20 md:py-28"
      id="how-it-works"
      style={{ background: "var(--color-surface)" }}
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
          HOW IT WORKS
        </motion.p>
        <motion.h2
          className="section-heading text-3xl md:text-4xl mb-4"
          style={{ color: "var(--color-on-surface)", lineHeight: 1.3 }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          Your existing workflow, with one difference — clients see what matters
          without touching your tools.
        </motion.h2>
        <motion.p
          className="text-base mb-14 max-w-2xl"
          style={{ color: "var(--color-on-surface-variant)", lineHeight: 1.6 }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          Klaroh sits on top of Smartlead, Instantly, or any other sending
          infrastructure you already use. No migration. No disruption. Just a
          client-facing layer that replaces shared logins and manual updates.
        </motion.p>

        <div className="space-y-8">
          {/* Feature 1: Live Dashboard */}
          <motion.div
            className="card"
            custom={0}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
          >
            <div className="grid md:grid-cols-5 gap-6 items-center">
              <div className="md:col-span-2">
                <h3
                  className="text-xl md:text-2xl mb-3"
                  style={{ color: "var(--color-on-surface)", lineHeight: 1.3 }}
                >
                  {features[0].title}
                </h3>
                <p
                  style={{
                    fontFamily: "Inter",
                    fontSize: "14px",
                    lineHeight: 1.6,
                    color: "var(--color-on-surface-variant)",
                  }}
                >
                  {features[0].description}
                </p>
              </div>
              <div className="md:col-span-3">
                <div
                  className="card card-stat p-4"
                  style={{ background: "var(--color-surface-container-lowest)" }}
                >
                  <div className="grid grid-cols-4 gap-3 text-center">
                    {features[0].stats!.map((s) => (
                      <div key={s.label}>
                        <div
                          className="type-stat text-xl"
                          style={{ color: "var(--color-primary)" }}
                        >
                          {s.value}
                        </div>
                        <p
                          className="eyebrow text-[10px]"
                          style={{ color: "var(--color-on-surface-variant)" }}
                        >
                          {s.label}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Feature 2: Automated Updates */}
          <motion.div
            className="card"
            custom={1}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
          >
            <div className="grid md:grid-cols-5 gap-6 items-center">
              <div className="md:col-span-2">
                <h3
                  className="text-xl md:text-2xl mb-3"
                  style={{ color: "var(--color-on-surface)", lineHeight: 1.3 }}
                >
                  {features[1].title}
                </h3>
                <p
                  style={{
                    fontFamily: "Inter",
                    fontSize: "14px",
                    lineHeight: 1.6,
                    color: "var(--color-on-surface-variant)",
                  }}
                >
                  {features[1].description}
                </p>
              </div>
              <div className="md:col-span-3">
                <div
                  className="card p-4 space-y-3"
                  style={{ background: "var(--color-surface-container-lowest)" }}
                >
                  {/* Post form mockup */}
                  <div
                    className="flex gap-3 items-center pb-3"
                    style={{
                      borderBottom: "1px solid rgba(191,201,193,0.3)",
                    }}
                  >
                    <span className="badge badge-success text-[10px]">
                      Live
                    </span>
                    <span
                      className="text-sm"
                      style={{
                        fontFamily: "Inter",
                        color: "var(--color-on-surface-variant)",
                      }}
                    >
                      Campaign running — steady reply rate
                    </span>
                  </div>
                  {/* Timeline entries */}
                  {features[1].timeline!.slice(1).map((entry, i) => (
                    <div key={i} className="flex items-start gap-3 py-2">
                      <div
                        className="w-2 h-2 rounded-full mt-1.5"
                        style={{ background: "var(--color-primary)" }}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`badge ${
                              entry.warning ? "badge-warning" : "badge-success"
                            }`}
                          >
                            {entry.badge}
                          </span>
                          <span
                            className="text-xs"
                            style={{
                              fontFamily: "Inter",
                              color: "var(--color-outline)",
                            }}
                          >
                            {entry.time}
                          </span>
                        </div>
                        <p
                          className="text-sm mt-1"
                          style={{
                            fontFamily: "Inter",
                            color: "var(--color-on-surface-variant)",
                          }}
                        >
                          {entry.text}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Feature 3: Activity Timeline */}
          <motion.div
            className="card"
            custom={2}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
          >
            <div className="grid md:grid-cols-5 gap-6 items-center">
              <div className="md:col-span-2">
                <h3
                  className="text-xl md:text-2xl mb-3"
                  style={{ color: "var(--color-on-surface)", lineHeight: 1.3 }}
                >
                  {features[2].title}
                </h3>
                <p
                  style={{
                    fontFamily: "Inter",
                    fontSize: "14px",
                    lineHeight: 1.6,
                    color: "var(--color-on-surface-variant)",
                  }}
                >
                  {features[2].description}
                </p>
              </div>
              <div className="md:col-span-3">
                <div
                  className="card p-4 space-y-3"
                  style={{ background: "var(--color-surface-container-lowest)" }}
                >
                  <div
                    className="flex items-center gap-3 pb-2"
                    style={{
                      borderBottom: "1px solid rgba(191,201,193,0.3)",
                    }}
                  >
                    <span
                      className="type-stat text-lg"
                      style={{ color: "var(--color-primary)" }}
                    >
                      Activity
                    </span>
                    <span
                      className="text-xs ml-auto"
                      style={{
                        fontFamily: "Inter",
                        color: "var(--color-outline)",
                      }}
                    >
                      Past 7 days
                    </span>
                  </div>
                  {features[2].activityTimeline!.map((entry, i) => (
                    <div key={i} className="flex items-start gap-3 py-2">
                      <div
                        className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                        style={{ background: entry.color }}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`badge ${
                              entry.warning
                                ? "badge-warning"
                                : "badge-success"
                            }`}
                          >
                            {entry.badge}
                          </span>
                          <span
                            className="text-xs"
                            style={{
                              fontFamily: "Inter",
                              color: "var(--color-outline)",
                            }}
                          >
                            {entry.time}
                          </span>
                        </div>
                        <p
                          className="text-sm mt-0.5"
                          style={{
                            fontFamily: "Inter",
                            color: "var(--color-on-surface-variant)",
                          }}
                        >
                          {entry.text}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
