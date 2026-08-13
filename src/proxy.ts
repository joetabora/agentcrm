import { NextRequest, NextResponse } from "next/server"
import { getSessionCookie } from "better-auth/cookies"

export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request)
  const { pathname } = request.nextUrl

  const isAuthPage =
    pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up")
  const isPublic =
    isAuthPage ||
    pathname.startsWith("/api/auth") ||
    pathname === "/" ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"

  if (!sessionCookie && !isPublic && pathname.startsWith("/app")) {
    return NextResponse.redirect(new URL("/sign-in", request.url))
  }

  if (sessionCookie && isAuthPage) {
    return NextResponse.redirect(new URL("/app", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/app/:path*", "/sign-in", "/sign-up", "/onboarding"],
}
