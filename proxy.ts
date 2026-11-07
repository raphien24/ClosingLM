import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Halaman publik / webhook yang tidak perlu session login
  const publicPaths = [
    "/login",
    "/unauthorized",
    "/api/auth",
    "/api/productivity/auto-upload",
    "/api/closing/auto-upload",
  ];
  const isPublic = publicPaths.some((p) => pathname.startsWith(p));

  if (isPublic) {
    return NextResponse.next();
  }

  // Belum login → redirect ke login
  if (!session) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Sudah login tapi email tidak terdaftar di USER_MAPPING → unauthorized
  const user = session.user as typeof session.user & { isAuthorized: boolean };
  if (!user.isAuthorized) {
    return NextResponse.redirect(new URL("/unauthorized", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};
