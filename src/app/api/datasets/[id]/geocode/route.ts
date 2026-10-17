import { NextResponse } from "next/server";
import type { Country } from "@/lib/geo/postcode";
import { censusBatchGeocode } from "@/lib/geocode/census";
import { geocodeBatch, type GeocodeProviders } from "@/lib/geocode/cascade";
import { lookupOutcodes, lookupPostcodes } from "@/lib/geocode/postcodesio";
import { lookupZipCentroids } from "@/lib/geocode/zcta";
import { createClient } from "@/lib/supabase/server";

// Geocodes the next batch of pending rows in a dataset. The browser calls this repeatedly until
// `remaining` reaches 0, which keeps each request well inside serverless time limits.
export const maxDuration = 60;

const BATCH_SIZE = 250;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: datasetId } = await params;
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  // RLS hides datasets from non-members; editing rights are checked explicitly.
  const { data: dataset } = await supabase.from("datasets").select("id, workspace_id").eq("id", datasetId).maybeSingle();
  if (!dataset) return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("workspace_id", dataset.workspace_id)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!membership || membership.role === "viewer") {
    return NextResponse.json({ error: "Only editors can locate rows" }, { status: 403 });
  }

  const { data: pending, error: pendingError } = await supabase
    .from("records")
    .select("id, address, city, region, postcode, country")
    .eq("dataset_id", datasetId)
    .eq("geocode_status", "pending")
    .order("id")
    .limit(BATCH_SIZE);
  if (pendingError) return NextResponse.json({ error: pendingError.message }, { status: 500 });

  if (pending.length > 0) {
    const providers: GeocodeProviders = {
      census: (addresses) => censusBatchGeocode(addresses),
      zipCentroids: lookupZipCentroids,
      ukPostcodes: (postcodes) => lookupPostcodes(postcodes),
      ukOutcodes: (outcodes) => lookupOutcodes(outcodes),
    };

    let results;
    try {
      results = await geocodeBatch(pending.map((r) => ({ ...r, country: r.country as Country })), providers);
    } catch (e) {
      // A provider outage leaves rows pending so the next attempt can pick them up.
      const message = e instanceof Error ? e.message : "Geocoding failed";
      return NextResponse.json({ error: `Location lookup is unavailable right now (${message}). Try again shortly.` }, { status: 502 });
    }

    const { error: applyError } = await supabase.rpc("apply_geocodes", { results });
    if (applyError) return NextResponse.json({ error: applyError.message }, { status: 500 });

    await supabase.from("usage_events").insert({ workspace_id: dataset.workspace_id, meter: "geocode", quantity: pending.length });
  }

  const { count } = await supabase
    .from("records")
    .select("id", { count: "exact", head: true })
    .eq("dataset_id", datasetId)
    .eq("geocode_status", "pending");

  return NextResponse.json({ processed: pending.length, remaining: count ?? 0 });
}
