import { after, NextResponse, type NextRequest } from "next/server";
import { config } from "@/lib/config";
import { safeEqual } from "@/lib/crypto";
import { providers } from "@/lib/adapters";
import { receiveWhatsAppWebhook } from "@/lib/services/outreach";
import { kickQueue } from "@/lib/jobs";

/** Meta's one-time subscription check. */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const expected = config().WHATSAPP_VERIFY_TOKEN;
  if (p.get("hub.mode") === "subscribe" && expected && safeEqual(p.get("hub.verify_token") ?? "", expected)) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

/** Inbound messages. Verified, queued and acknowledged fast; processing happens in the queue. */
export async function POST(req: NextRequest) {
  // The public endpoint only accepts the configured live provider. Simulated
  // messages go through the in-app simulator instead.
  if (providers().whatsapp.name !== "cloud") return new NextResponse("Not found", { status: 404 });
  const raw = await req.text();
  if (raw.length > 1_000_000) return new NextResponse("Too large", { status: 413 });
  const ok = await receiveWhatsAppWebhook(raw, req.headers);
  if (!ok) return new NextResponse("Invalid signature", { status: 401 });
  after(() => kickQueue());
  return NextResponse.json({ ok: true });
}
