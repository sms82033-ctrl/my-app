import { cookies } from "next/headers";
import { crossSiteResponse, isCrossSite } from "@/lib/input-check";
import {
  createSessionToken,
  passwordMatches,
  SESSION_COOKIE,
  SESSION_SECONDS,
} from "@/lib/session-token";

// 관리자 로그인 서버 경로 (DESIGN.md 2.5)
// 비밀번호가 맞으면 브라우저에 8시간짜리 로그인 표시(쿠키)를 남긴다.

export async function POST(request: Request): Promise<Response> {
  // 다른 사이트의 화면에서 몰래 보낸 요청은 받지 않는다.
  if (isCrossSite(request)) return crossSiteResponse();

  const expected = process.env.ADMIN_PASSWORD;
  const secret = process.env.SESSION_SECRET;
  if (!expected || !secret) {
    // 누구나 볼 수 있는 화면이므로 자세한 원인은 서버 기록에만 남긴다.
    console.error("관리자 로그인이 설정되지 않았습니다. .env 파일에 ADMIN_PASSWORD와 SESSION_SECRET을 넣어 주세요.");
    return Response.json(
      { ok: false, message: "지금은 로그인할 수 없습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, message: "보낸 내용을 읽을 수 없습니다." }, { status: 400 });
  }

  const password = (body as { password?: unknown } | null)?.password;
  if (typeof password !== "string" || !passwordMatches(password, expected)) {
    // 누군가 비밀번호를 여러 번 넣어 보는지 나중에 알 수 있게 기록한다. 입력한 값은 남기지 않는다.
    console.warn("관리자 로그인 실패");
    return Response.json({ ok: false, message: "비밀번호가 맞지 않습니다." }, { status: 401 });
  }

  (await cookies()).set(SESSION_COOKIE, createSessionToken(secret), {
    httpOnly: true, // 화면의 코드(자바스크립트)에서는 읽을 수 없고 서버만 읽는다.
    sameSite: "lax", // 다른 사이트에서 몰래 보낸 요청에는 실려 가지 않는다.
    secure: process.env.NODE_ENV === "production", // 배포한 뒤에는 https에서만 보낸다.
    path: "/",
    maxAge: SESSION_SECONDS,
  });

  return Response.json({ ok: true });
}
