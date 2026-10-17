import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { WorkspaceForm } from "./workspace-form";

export default async function AppHome() {
  const { supabase, workspace } = await requireUser();

  if (!workspace) {
    return (
      <main className="mx-auto w-full max-w-md px-6 py-16">
        <h1 className="mb-6 text-2xl font-semibold">Set up your workspace</h1>
        <WorkspaceForm />
      </main>
    );
  }

  const { data: datasets } = await supabase
    .from("datasets")
    .select("id, name, row_count, created_at")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your maps</h1>
        {workspace.role !== "viewer" && (
          <Link href="/app/upload" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
            Upload a sheet
          </Link>
        )}
      </div>
      {!datasets?.length ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600">
          <p className="mb-2 font-medium text-slate-900">No maps yet</p>
          <p>Upload a CSV or Excel file of customers, dealers or stores to see them on a map.</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {datasets.map((d) => (
            <li key={d.id}>
              <Link href={`/app/datasets/${d.id}`} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50">
                <span className="font-medium">{d.name}</span>
                <span className="text-sm text-slate-500">
                  {d.row_count.toLocaleString()} rows · {new Date(d.created_at).toLocaleDateString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
