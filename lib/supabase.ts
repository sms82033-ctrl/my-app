import "server-only"; // 화면(브라우저) 쪽 코드에서 실수로 불러 쓰면 빌드가 막아 준다.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// 데이터 저장소(Supabase) 연결 도구를 만든다.
// 서버용 열쇠를 쓰므로 반드시 서버 쪽 코드에서만 불러 쓴다. (DESIGN.md 3.4, 5)
// .env에 접속 값이 없으면 null을 돌려주고, 부르는 쪽에서 안내 문구를 보여 준다.
export function getSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  return createClient(url, key, {
    // 서버에서만 쓰므로 브라우저용 로그인 기능은 끈다.
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
