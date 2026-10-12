import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session-token";

// 지금 요청을 보낸 사람이 관리자로 로그인했는지 확인하는 코드 (DESIGN.md 2.5)
// 관리자용 화면과 관리자용 서버 코드는 모두 이 확인을 먼저 거친다.

// 관리자 로그인 화면 주소
export const LOGIN_PATH = "/admin/login";

// 로그인되어 있으면 true를 돌려준다.
export async function isAdmin(): Promise<boolean> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionToken(token, process.env.SESSION_SECRET);
}

// 로그인되어 있지 않으면 로그인 화면으로 보낸다. 관리자용 화면에서 쓴다.
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) {
    redirect(LOGIN_PATH);
  }
}
