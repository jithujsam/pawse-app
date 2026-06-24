"use client";

import { useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Menu, X } from "lucide-react";

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { scrollY } = useScroll();
  const bg = useTransform(
    scrollY,
    [0, 60],
    ["rgba(248,249,255,0)", "rgba(248,249,255,0.8)"]
  );
  const blur = useTransform(scrollY, [0, 60], ["blur(0px)", "blur(20px)"]);

  return (
    <>
      {/* Mobile overlay */}
      {menuOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-55"
          style={{ background: "rgba(11,28,48,0.3)" }}
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Mobile menu */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: menuOpen ? 0 : "100%" }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="fixed top-0 right-0 bottom-0 w-[280px] z-60 p-8 border-l"
        style={{
          background: "#FFFFFF",
          borderColor: "rgba(191,201,193,0.5)",
        }}
      >
        <button
          className="absolute top-6 right-6"
          style={{ color: "var(--color-on-surface)" }}
          onClick={() => setMenuOpen(false)}
          aria-label="Close menu"
        >
          <X size={24} />
        </button>
        <nav className="flex flex-col gap-6 mt-12">
          {["Features", "How It Works", "Pricing"].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase().replace(/\s+/g, "-")}`}
              className="transition-colors"
              style={{
                fontFamily: "Inter",
                fontWeight: 500,
                fontSize: "15px",
                color: "var(--color-on-surface-variant)",
              }}
              onClick={() => setMenuOpen(false)}
            >
              {item}
            </a>
          ))}
          <a
            href="https://app.klaroh.online"
            className="btn-primary btn-base mt-4 w-full text-center"
          >
            Book Your Demo Call
          </a>
        </nav>
      </motion.div>

      {/* Navbar */}
      <motion.header
        className="fixed top-0 left-0 right-0 z-50"
        style={{ background: bg, backdropFilter: blur, WebkitBackdropFilter: blur }}
      >
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <a
            href="#"
            className="text-lg"
            style={{
              fontFamily: "Inter",
              fontWeight: 600,
              color: "var(--color-on-surface)",
              letterSpacing: "-0.01em",
            }}
          >
            Klaroh
          </a>

          <nav className="hidden md:flex items-center gap-8">
            {["Features", "How It Works", "Pricing"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(/\s+/g, "-")}`}
                className="text-sm transition-colors"
                style={{
                  fontFamily: "Inter",
                  fontWeight: 500,
                  color: "var(--color-on-surface-variant)",
                }}
              >
                {item}
              </a>
            ))}
          </nav>

          <a
            href="https://app.klaroh.online"
            className="btn-primary btn-base hidden md:inline-flex"
          >
            Book Your Demo Call
          </a>

          <button
            className="md:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            style={{ color: "var(--color-on-surface)" }}
          >
            <Menu size={24} />
          </button>
        </div>
      </motion.header>
    </>
  );
}
