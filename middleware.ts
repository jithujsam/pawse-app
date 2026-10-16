import { NextResponse, type NextRequest } from "next/server";

// Cheap gate only: pages re-check the session against the database.
export function middleware(req: NextRequest) {
  if (!req.cookies.get("pr_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/app/:path*", "/ops/:path*", "/pay/:path*"] };
