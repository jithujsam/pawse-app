"use client";

import Link from "next/link";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-5" style={{ background: "var(--color-surface)" }}>
      <div className="card max-w-md text-center">
        <h1 className="text-3xl mb-2">Something went wrong</h1>
        <p className="text-sm mb-6" style={{ color: "var(--color-on-surface-variant)" }}>
          We&apos;ve logged the problem. Try again, or check the status page if it keeps happening.
          {error.digest && <span className="block mt-2 text-xs">Reference: {error.digest}</span>}
        </p>
        <div className="flex justify-center gap-2">
          <button className="btn-base btn-primary" onClick={reset}>
            Try again
          </button>
          <Link href="/status" className="btn-base btn-ghost">
            Status
          </Link>
        </div>
      </div>
    </main>
  );
}
