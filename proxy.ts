import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Izinkan semua file asset statis gambar / font di public
  if (
    pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ico|bmp|woff|woff2|ttf|eot)$/i)
  ) {
    return NextResponse.next();
  }

  // Halaman publik / webhook yang tidak perlu session login
  const publicPaths = [
    "/login",
    "/unauthorized",
    "/api/auth",
    "/api/productivity/auto-upload",
    "/api/closing/auto-upload",
    "/api/ocr/warmup",
  ];
  const isPublic = publicPaths.some((p) => pathname.startsWith(p));

  if (isPublic) {
    return NextResponse.next();
  }

  // Belum login → redirect ke login
  if (!session?.user) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const user = session.user as typeof session.user & {
    isAuthorized?: boolean;
    isExpired?: boolean;
  };

  // Sesi telah berakhir (> 24 jam) → redirect ke login ulang
  if (user.isExpired) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Sudah login tapi email tidak terdaftar di USER_MAPPING → unauthorized
  if (!user.isAuthorized) {
    return NextResponse.redirect(new URL("/unauthorized", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
