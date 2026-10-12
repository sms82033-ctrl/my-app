import { CHANGE_TYPES, NEEDS_CHECK } from "@/lib/report-rules";
import { getSupabase } from "@/lib/supabase";

// 신고를 승인하거나 반려하는 코드 (DESIGN.md 2.3)
// AI는 여기에 관여하지 않는다. 장비 목록을 고치는 것은 관리자의 승인뿐이다.

// 위치·사용자 칸의 글자 수 제한
const MAX_FIELD_LENGTH = 30;

const NO_STORE_MESSAGE =
  "데이터 저장소 접속 값이 없습니다. .env 파일에 SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 넣어 주세요.";
const ALREADY_DONE_MESSAGE = "이미 처리된 신고입니다. 화면을 새로 고쳐 주세요.";

// 처리 결과. 실패하면 화면에 보여 줄 안내 문구와 응답 번호를 담는다.
export type DecisionResult = { ok: true } | { ok: false; message: string; status: number };

// 관리자가 확인해 보낸 승인 내용
export type ApprovalInput = {
  reportId: number;
  serial: string;
  changeType: string;
  newLocation: string;
  userName: string;
};

// 빈 칸은 "확인 필요"로 바꾼다.
function orNeedsCheck(value: string): string {
  const cleaned = value.trim();
  return cleaned === "" ? NEEDS_CHECK : cleaned;
}

// 승인에 꼭 필요한 칸이 채워졌는지 확인한다. 문제가 있으면 안내 문구를, 없으면 null을 돌려준다.
// 꼭 필요한 칸: 장비와 변동 종류는 항상, 새 위치는 자리 이동일 때. (DESIGN.md 2.3)
export function findMissing(input: ApprovalInput): string | null {
  if (input.serial.trim() === "") return "장비를 골라 주세요.";
  if (!(CHANGE_TYPES as readonly string[]).includes(input.changeType)) return "변동 종류를 골라 주세요.";
  if (input.changeType === "자리 이동" && orNeedsCheck(input.newLocation) === NEEDS_CHECK) {
    return "자리 이동은 새 위치를 적어야 승인할 수 있습니다.";
  }
  if (Array.from(input.newLocation.trim()).length > MAX_FIELD_LENGTH) {
    return `새 위치는 ${MAX_FIELD_LENGTH}자까지 적을 수 있습니다.`;
  }
  if (Array.from(input.userName.trim()).length > MAX_FIELD_LENGTH) {
    return `사용자는 ${MAX_FIELD_LENGTH}자까지 적을 수 있습니다.`;
  }
  return null;
}

// 신고를 승인한다. 장비 표 반영과 상태 변경은 데이터 저장소의 approve_report 함수가 한 묶음으로 처리한다.
export async function approveReport(input: ApprovalInput): Promise<DecisionResult> {
  const missing = findMissing(input);
  if (missing) return { ok: false, message: missing, status: 400 };

  const supabase = getSupabase();
  if (!supabase) return { ok: false, message: NO_STORE_MESSAGE, status: 500 };

  const { data, error } = await supabase.rpc("approve_report", {
    p_report_id: input.reportId,
    p_serial: input.serial.trim(),
    p_change_type: input.changeType,
    p_new_location: orNeedsCheck(input.newLocation),
    p_user_name: orNeedsCheck(input.userName),
  });

  if (error) {
    // 자세한 오류는 서버 기록에만 남기고, 화면에는 짧은 안내만 보여 준다.
    console.error("신고를 승인하지 못했습니다:", error.message);
    return { ok: false, message: "신고를 승인하지 못했습니다. 다시 시도해 주세요.", status: 500 };
  }

  switch (data) {
    case "ok":
      return { ok: true };
    case "not_found":
      return { ok: false, message: "그런 신고가 없습니다. 화면을 새로 고쳐 주세요.", status: 404 };
    case "not_pending":
      return { ok: false, message: ALREADY_DONE_MESSAGE, status: 409 };
    case "bad_equipment":
      return { ok: false, message: "목록에 없는 장비입니다. 장비를 다시 골라 주세요.", status: 400 };
    case "bad_change_type":
      return { ok: false, message: "변동 종류를 골라 주세요.", status: 400 };
    case "missing_location":
      return { ok: false, message: "자리 이동은 새 위치를 적어야 승인할 수 있습니다.", status: 400 };
    default:
      return { ok: false, message: "신고를 승인하지 못했습니다. 다시 시도해 주세요.", status: 500 };
  }
}

// 신고를 반려한다. 신고 상태만 "반려"로 바꾸고, 장비 표와 변경 이력은 건드리지 않는다.
export async function rejectReport(reportId: number): Promise<DecisionResult> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, message: NO_STORE_MESSAGE, status: 500 };

  // "대기" 상태일 때만 바꾼다. 이미 처리된 신고는 바뀌지 않는다.
  const { data, error } = await supabase
    .from("reports")
    .update({ status: "반려", processed_at: new Date().toISOString() })
    .eq("id", reportId)
    .eq("status", "대기")
    .select("id");

  if (error) {
    console.error("신고를 반려하지 못했습니다:", error.message);
    return { ok: false, message: "신고를 반려하지 못했습니다. 다시 시도해 주세요.", status: 500 };
  }
  if (data.length === 0) {
    return { ok: false, message: ALREADY_DONE_MESSAGE, status: 409 };
  }
  return { ok: true };
}
