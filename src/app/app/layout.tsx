import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { signOut } from "./actions";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const { user, workspace } = await requireUser();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex items-center gap-4">
          <Link href="/app" className="font-semibold text-emerald-700">
            Beatmap
          </Link>
          {workspace && <span className="text-sm text-slate-500">{workspace.name}</span>}
        </div>
        <form action={signOut} className="flex items-center gap-3 text-sm text-slate-500">
          <span>{user.email}</span>
          <button type="submit" className="underline hover:text-slate-900">
            Sign out
          </button>
        </form>
      </header>
      {children}
    </div>
  );
}
