import { NextResponse, type NextRequest } from "next/server";
import { signOut } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  await signOut();
  return NextResponse.redirect(new URL("/", req.url), 303);
}
