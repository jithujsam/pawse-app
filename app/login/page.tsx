import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { config } from "@/lib/config";
import { LoginForm } from "./LoginForm";

export const metadata = { title: `Sign in · ${BRAND.name}` };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-16" style={{ background: "var(--color-surface)" }}>
      <div className="w-full max-w-md">
        <Link href="/" className="heading-serif text-2xl block text-center mb-8" style={{ color: "var(--color-primary)" }}>
          {BRAND.name}
        </Link>
        <div className="card">
          <h1 className="text-3xl mb-2">Sign in or sign up</h1>
          <p className="text-sm mb-6" style={{ color: "var(--color-on-surface-variant)" }}>
            We&apos;ll email you a sign-in link. No password needed.
          </p>
          {error && (
            <p className="text-sm mb-4" style={{ color: "var(--color-error)" }} role="alert">
              {error === "expired" ? "That link has expired or was already used. Request a new one." : "Something went wrong. Try again."}
            </p>
          )}
          <LoginForm />
        </div>
        {config().DEMO_MODE && (
          <form action="/api/demo" method="post" className="mt-6 text-center">
            <button className="text-sm underline" style={{ color: "var(--color-primary)" }}>
              Just looking? Open the demo workspace
            </button>
          </form>
        )}
        <p className="text-xs text-center mt-6" style={{ color: "var(--color-on-surface-variant)" }}>
          By continuing you agree to our <Link href="/legal/terms" className="underline">Terms</Link> and{" "}
          <Link href="/legal/privacy" className="underline">Privacy Policy</Link>.
        </p>
      </div>
    </main>
  );
}
