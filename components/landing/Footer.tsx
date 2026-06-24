"use client";

export default function Footer() {
  return (
    <footer
      style={{
        background: "var(--color-surface-container-lowest)",
        borderTop: "1px solid rgba(191,201,193,0.2)",
      }}
    >
      <div className="max-w-6xl mx-auto px-5 py-10">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          {/* Left */}
          <div>
            <p
              style={{
                fontFamily: "Inter",
                fontWeight: 600,
                fontSize: "16px",
                color: "var(--color-on-surface)",
                letterSpacing: "-0.01em",
              }}
            >
              Klaroh
            </p>
            <p
              className="text-sm mt-1"
              style={{
                fontFamily: "Inter",
                color: "var(--color-on-surface-variant)",
              }}
            >
              Client visibility for cold email &amp; outbound agencies.
            </p>
          </div>

          {/* Right */}
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-8">
            {["Features", "How It Works", "Pricing"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(/\s+/g, "-")}`}
                className="text-sm"
                style={{
                  fontFamily: "Inter",
                  color: "var(--color-on-surface-variant)",
                }}
              >
                {item}
              </a>
            ))}
            <span
              className="text-sm"
              style={{ fontFamily: "Inter", color: "var(--color-outline)" }}
            >
              Privacy
            </span>
            <span
              className="text-sm"
              style={{ fontFamily: "Inter", color: "var(--color-outline)" }}
            >
              Terms
            </span>

            {/* Status indicator */}
            <div
              className="flex items-center gap-2 text-xs"
              style={{
                fontFamily: "Inter",
                color: "var(--color-on-surface-variant)",
              }}
            >
              <span className="status-dot" />
              System Operational
            </div>
          </div>
        </div>

        <div
          className="mt-8 pt-6 text-center text-xs"
          style={{
            borderTop: "1px solid rgba(191,201,193,0.2)",
            fontFamily: "Inter",
            color: "var(--color-outline)",
          }}
        >
          &copy; 2026 Klaroh. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
