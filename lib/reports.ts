import type { CheckedReport } from "@/lib/report-rules";
import { getSupabase } from "@/lib/supabase";

// 신고 표를 읽고 쓰는 코드 (DESIGN.md 2.1)

// 신고 표의 한 줄 가운데 승인 화면에 필요한 항목
export type PendingReport = {
  id: number; // 신고 번호
  reporter: string; // 신고자
  original_text: string; // 원문
  equipment_serial: string | null; // 장비 (정하지 못했으면 null)
  candidate_serials: string[]; // 후보 장비 (0~3대)
  change_type: string; // 변동 종류
  old_location: string; // 이전 위치
  new_location: string; // 새 위치
  user_name: string; // 사용자
  reported_at: string; // 신고 시각
};

// 대기 중인 신고를 읽은 결과. 실패하면 화면에 보여 줄 안내 문구를 담는다.
export type PendingResult =
  | { ok: true; items: PendingReport[] }
  | { ok: false; message: string };

// "대기" 상태인 신고를 먼저 들어온 순서대로 읽는다. (DESIGN.md 1.4)
export async function listPendingReports(): Promise<PendingResult> {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      ok: false,
      message:
        "데이터 저장소 접속 값이 없습니다. .env 파일에 SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 넣어 주세요.",
    };
  }

  const { data, error } = await supabase
    .from("reports")
    .select(
      "id, reporter, original_text, equipment_serial, candidate_serials, change_type, old_location, new_location, user_name, reported_at",
    )
    .eq("status", "대기")
    .order("reported_at");

  if (error) {
    // 자세한 오류는 서버 기록에만 남기고, 화면에는 짧은 안내만 보여 준다.
    console.error("대기 중인 신고를 읽지 못했습니다:", error.message);
    return { ok: false, message: "대기 중인 신고를 읽지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }

  return { ok: true, items: data };
}

// 신고가 몰려 있는지 센다: 대기 중인 신고 수와, 최근 몇 분 동안 들어온 신고 수.
// 누군가 신고 접수를 반복해서 불러 AI 요금과 대기 목록을 불리는 것을 막는 데 쓴다.
// 세지 못하면 null을 돌려준다.
export async function countReportLoad(recentMinutes: number): Promise<{ pending: number; recent: number } | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const since = new Date(Date.now() - recentMinutes * 60 * 1000).toISOString();
  const [pending, recent] = await Promise.all([
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "대기"),
    supabase.from("reports").select("id", { count: "exact", head: true }).gte("reported_at", since),
  ]);

  if (pending.error || recent.error) {
    console.error("신고 건수를 세지 못했습니다:", (pending.error ?? recent.error)?.message);
    return null;
  }
  return { pending: pending.count ?? 0, recent: recent.count ?? 0 };
}

// 저장 결과. 실패하면 화면에 보여 줄 안내 문구를 담는다.
export type SaveResult = { ok: true; id: number } | { ok: false; message: string };

// 검사를 마친 신고를 "대기" 상태로 저장한다. (DESIGN.md 2.2 처리 5)
// 상태와 신고 시각은 데이터 저장소가 기본값("대기", 지금 시각)으로 채운다.
export async function saveReport(reporter: string, text: string, report: CheckedReport): Promise<SaveResult> {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      ok: false,
      message:
        "데이터 저장소 접속 값이 없습니다. .env 파일에 SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 넣어 주세요.",
    };
  }

  const { data, error } = await supabase
    .from("reports")
    .insert({
      reporter,
      original_text: text,
      equipment_serial: report.equipmentSerial,
      candidate_serials: report.candidateSerials,
      change_type: report.changeType,
      old_location: report.oldLocation,
      new_location: report.newLocation,
      user_name: report.userName,
    })
    .select("id")
    .single();

  if (error) {
    // 자세한 오류는 서버 기록에만 남기고, 화면에는 짧은 안내만 보여 준다.
    console.error("신고를 저장하지 못했습니다:", error.message);
    return { ok: false, message: "신고를 저장하지 못했습니다. 다시 시도해 주세요." };
  }

  return { ok: true, id: data.id };
}
