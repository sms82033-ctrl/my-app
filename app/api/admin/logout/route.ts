import { cookies } from "next/headers";
import { crossSiteResponse, isCrossSite } from "@/lib/input-check";
import { SESSION_COOKIE } from "@/lib/session-token";

// 관리자 로그아웃 서버 경로 (DESIGN.md 2.5)
// 로그인 표시(쿠키)를 지우고 로그인 화면으로 돌려보낸다.

export async function POST(request: Request): Promise<Response> {
  // 다른 사이트의 화면에서 몰래 보낸 요청은 받지 않는다.
  if (isCrossSite(request)) return crossSiteResponse();

  (await cookies()).delete(SESSION_COOKIE);
  // 303: 보내기(POST)가 끝난 뒤 로그인 화면을 새로 열라는 뜻이다.
  return Response.redirect(new URL("/admin/login", request.url), 303);
}
