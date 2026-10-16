import type { Metadata } from "next";
import { Instrument_Serif, Inter } from "next/font/google";
import "./globals.css";
import { BRAND } from "@/lib/brand";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: `${BRAND.name}: ${BRAND.tagline}`,
  description:
    "Screen job candidates on WhatsApp by text or voice note and get a ranked shortlist. Priced per job in rupees, paid by UPI. Built for Indian recruiters and staffing agencies.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN" className={`${instrumentSerif.variable} ${inter.variable}`}>
      <body
        className="font-[family-name:var(--font-inter)] text-[--color-on-surface] bg-[--color-surface] antialiased"
      >
        {children}
      </body>
    </html>
  );
}
