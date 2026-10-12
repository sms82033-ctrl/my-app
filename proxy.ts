import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session-token";

// 관리자용 주소로 오는 요청을 화면이나 서버 코드에 닿기 전에 먼저 걸러 낸다. (DESIGN.md 2.5)
// 로그인하지 않았으면 화면은 로그인 화면으로 보내고, 서버 경로는 거부한다.
// 여기서 한 번 막고, 각 화면과 서버 코드에서도 한 번 더 확인한다.

// 로그인 없이 열 수 있어야 하는 주소
const OPEN_PATHS = ["/admin/login", "/api/admin/login"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (OPEN_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (verifySessionToken(token, process.env.SESSION_SECRET)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { ok: false, message: "관리자 로그인이 필요합니다." },
      { status: 401 },
    );
  }
  return NextResponse.redirect(new URL("/admin/login", request.url));
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
