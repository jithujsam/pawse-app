import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { DatasetView } from "./dataset-view";

export default async function DatasetPage({ params }: PageProps<"/app/datasets/[id]">) {
  const { id } = await params;
  const { supabase, workspace } = await requireUser();
  if (!workspace) redirect("/app");

  const { data: dataset } = await supabase.from("datasets").select("id, name, row_count").eq("id", id).maybeSingle();
  if (!dataset) notFound();

  return (
    <main className="flex w-full flex-1 flex-col gap-4 px-6 py-6">
      <div className="flex items-center gap-3">
        <Link href="/app" className="text-sm text-slate-500 hover:text-slate-900">
          ← Maps
        </Link>
        <h1 className="text-xl font-semibold">{dataset.name}</h1>
      </div>
      <DatasetView datasetId={dataset.id} canEdit={workspace.role !== "viewer"} />
    </main>
  );
}
