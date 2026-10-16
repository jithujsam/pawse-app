import { NextResponse } from "next/server";
import { getSystemStatus } from "@/lib/services/status";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSystemStatus();
  return NextResponse.json(s, { status: s.database ? 200 : 503 });
}
