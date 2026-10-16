import { after, NextResponse, type NextRequest } from "next/server";
import { providers } from "@/lib/adapters";
import { handlePaymentWebhook } from "@/lib/services/payments";
import { kickQueue } from "@/lib/jobs";

export async function POST(req: NextRequest) {
  // Mock payments are confirmed through /pay/mock, never through this public endpoint.
  if (providers().payments.name !== "razorpay") return new NextResponse("Not found", { status: 404 });
  const raw = await req.text();
  if (raw.length > 1_000_000) return new NextResponse("Too large", { status: 413 });
  const outcome = await handlePaymentWebhook(raw, req.headers);
  if (outcome === "invalid") return new NextResponse("Invalid signature", { status: 400 });
  after(() => kickQueue());
  // 200 for duplicates too, so the provider stops retrying.
  return NextResponse.json({ ok: true, outcome });
}
