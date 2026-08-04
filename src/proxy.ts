import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "./lib/session";

export async function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(request, response, sessionOptions);
  const { pathname } = request.nextUrl;

  const isLoginPage = pathname === "/login";
  const isApiRoute = pathname.startsWith("/api/");
  const isAuthRoute = pathname.startsWith("/api/auth/");

  if (!session.userId && !isLoginPage && !isAuthRoute) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (session.userId && isLoginPage) {
    const redirectTo = session.role === "KASIR" ? "/penjualan" : "/dashboard";
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons).*)"],
};
