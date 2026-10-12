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

// 신고 접수 한도
export type ReportLimits = {
  minutes: number; // 최근 몇 분을 볼지
  maxPerRequester: number; // 그 시간 동안 한 곳에서 보낼 수 있는 수
  maxRecent: number; // 그 시간 동안 전체가 보낼 수 있는 수
  maxPending: number; // 대기 신고가 이만큼 쌓이면 받지 않음
};

// 접수 자리를 잡은 결과
//   ok: 접수해도 됨 / too_many: 같은 곳에서 너무 많이 보냄 / busy: 전체 신고가 너무 많음
//   backlog: 대기 신고가 너무 많이 쌓임 / error: 확인하지 못함
export type SlotResult = "ok" | "too_many" | "busy" | "backlog" | "error";

// 신고를 받아도 되는지 확인하고, 되면 시도를 기록한다. (DESIGN.md 2.2)
// AI를 부르기 전에 부른다. 확인과 기록은 데이터 저장소의 claim_report_slot 함수가 한 묶음으로 처리하므로,
// 같은 순간에 몰려온 요청도 한도를 넘지 못하고, AI가 실패해 저장되지 않은 호출도 센다.
// 확인하지 못하면 "error"를 돌려주며, 이때는 신고를 받지 않는다.
export async function claimReportSlot(requester: string, limits: ReportLimits): Promise<SlotResult> {
  const supabase = getSupabase();
  if (!supabase) return "error";

  const { data, error } = await supabase.rpc("claim_report_slot", {
    p_requester: requester,
    p_minutes: limits.minutes,
    p_max_per_requester: limits.maxPerRequester,
    p_max_recent: limits.maxRecent,
    p_max_pending: limits.maxPending,
  });

  if (error) {
    console.error("신고 접수 한도를 확인하지 못했습니다:", error.message);
    return "error";
  }
  return data === "ok" || data === "too_many" || data === "busy" || data === "backlog" ? data : "error";
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
