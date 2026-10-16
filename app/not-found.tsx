import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-5" style={{ background: "var(--color-surface)" }}>
      <div className="card max-w-md text-center">
        <h1 className="text-3xl mb-2">Page not found</h1>
        <p className="text-sm mb-6" style={{ color: "var(--color-on-surface-variant)" }}>
          The link may be old, or you may not have access to it.
        </p>
        <Link href="/" className="btn-base btn-primary">
          Go home
        </Link>
      </div>
    </main>
  );
}
