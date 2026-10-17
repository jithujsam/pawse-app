import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { Uploader } from "./uploader";

export default async function UploadPage() {
  const { workspace } = await requireUser();
  if (!workspace) redirect("/app");
  if (workspace.role === "viewer") redirect("/app");

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Upload a sheet</h1>
      <Uploader workspaceId={workspace.id} defaultCountry={workspace.country} />
    </main>
  );
}
