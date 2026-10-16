"use client";

export function PrintButton() {
  return (
    <button className="btn-base btn-ghost" onClick={() => window.print()}>
      Print or save as PDF
    </button>
  );
}
