import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// 관리자 로그인 표시(쿠키)를 만들고 확인하는 코드 (DESIGN.md 2.5)
// 로그인 표시는 "만료 시각.서명" 형태다. 서명은 .env의 SESSION_SECRET으로 만들기 때문에,
// 비밀값을 모르는 사람은 표시를 흉내 내거나 만료 시각을 고칠 수 없다.

// 로그인 표시를 담는 쿠키 이름
export const SESSION_COOKIE = "admin_session";

// 로그인 유효 시간: 8시간 (초 단위)
export const SESSION_SECONDS = 8 * 60 * 60;

// 만료 시각에 대한 서명을 만든다.
function sign(expiresAt: number, secret: string): string {
  return createHmac("sha256", secret).update(`admin:${expiresAt}`).digest("hex");
}

// 두 글자를 비교한다. 걸리는 시간으로 내용을 짐작할 수 없도록 길이를 맞춘 뒤 비교한다.
function safeEqual(a: string, b: string): boolean {
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}

// 지금부터 8시간 동안 유효한 로그인 표시를 만든다.
export function createSessionToken(secret: string, now: number = Date.now()): string {
  const expiresAt = now + SESSION_SECONDS * 1000;
  return `${expiresAt}.${sign(expiresAt, secret)}`;
}

// 로그인 표시가 진짜이고 아직 유효한지 확인한다.
export function verifySessionToken(
  token: string | undefined,
  secret: string | undefined,
  now: number = Date.now(),
): boolean {
  if (!token || !secret) return false;

  const [expiresText, signature, ...rest] = token.split(".");
  if (!expiresText || !signature || rest.length > 0) return false;

  const expiresAt = Number(expiresText);
  if (!Number.isSafeInteger(expiresAt)) return false;

  // 서명이 맞지 않으면 누군가 만들어 낸 표시다.
  if (!safeEqual(signature, sign(expiresAt, secret))) return false;

  // 유효 시간이 지났으면 다시 로그인해야 한다.
  return now < expiresAt;
}

// 입력한 비밀번호가 .env의 관리자 비밀번호와 같은지 확인한다.
export function passwordMatches(input: string, expected: string | undefined): boolean {
  if (!expected) return false;
  return safeEqual(input, expected);
}
