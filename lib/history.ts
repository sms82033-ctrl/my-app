import { getSupabase } from "@/lib/supabase";

// 변경 이력 표를 읽는 코드 (DESIGN.md 2.1, 2.4)

// 한 장비의 이력은 최근 것부터 이만큼만 보여 준다. (PRD 5번)
export const MAX_HISTORY = 10;

// 변경 이력의 한 줄
export type HistoryEntry = {
  id: number;
  report_id: number | null; // 신고 번호 (관리자 직접 수정이면 비어 있음)
  who: string; // 누가 (신고자, 직접 수정이면 "관리자")
  changed_at: string; // 언제 (승인한 시각)
  what: string; // 무엇을 (장비 종류와 시리얼번호)
  how: string; // 어떻게 (변동 종류와 바뀐 내용)
};

// 이력을 읽은 결과. 실패하면 화면에 보여 줄 안내 문구를 담는다.
export type HistoryResult =
  | { ok: true; items: HistoryEntry[] }
  | { ok: false; message: string };

// 한 장비의 변경 이력을 최근 것부터 최대 10건까지 읽는다.
export async function listHistory(serial: string): Promise<HistoryResult> {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      ok: false,
      message:
        "데이터 저장소 접속 값이 없습니다. .env 파일에 SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 넣어 주세요.",
    };
  }

  const { data, error } = await supabase
    .from("change_history")
    .select("id, report_id, who, changed_at, what, how")
    .eq("equipment_serial", serial)
    .order("changed_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(MAX_HISTORY);

  if (error) {
    // 자세한 오류는 서버 기록에만 남기고, 화면에는 짧은 안내만 보여 준다.
    console.error("변경 이력을 읽지 못했습니다:", error.message);
    return { ok: false, message: "변경 이력을 읽지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }

  return { ok: true, items: data };
}
