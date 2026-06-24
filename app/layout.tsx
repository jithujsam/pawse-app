import type { Metadata } from "next";
import { Instrument_Serif, Inter } from "next/font/google";
import "./globals.css";

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
  title: "Klaroh — Client visibility for cold email agencies",
  description:
    "Replace shared tool logins and manual screenshots with a live, no-login client dashboard. Built for cold email and outbound agencies.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${instrumentSerif.variable} ${inter.variable}`}>
      <body
        className="font-[family-name:var(--font-inter)] text-[--color-on-surface] bg-[--color-surface] antialiased"
      >
        {children}
      </body>
    </html>
  );
}
