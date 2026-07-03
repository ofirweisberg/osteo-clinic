import { NextResponse, type NextRequest } from "next/server";
import { verifyToken, SESSION_COOKIE } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Canonical host: bare doclinics.net -> www.doclinics.net
  const host = request.headers.get("host") ?? "";
  if (host === "doclinics.net") {
    const url = request.nextUrl.clone();
    url.host = "www.doclinics.net";
    url.protocol = "https";
    url.port = "";
    return NextResponse.redirect(url, 301);
  }
  const authed = await verifyToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname.startsWith("/dashboard") && !authed) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if ((pathname === "/login" || pathname === "/") && authed) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
