import type { Equipment } from "@/lib/equipment";
import { getSupabase } from "@/lib/supabase";

// 관리자가 장비를 직접 등록·수정·삭제하는 코드 (PRD must 3, DESIGN.md 2.6)
// AI를 쓰지 않는다. 부르는 쪽에서 로그인 여부를 먼저 확인해야 한다.

const NO_STORE_MESSAGE =
  "데이터 저장소 접속 값이 없습니다. .env 파일에 SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 넣어 주세요.";

// 처리 결과. 실패하면 화면에 보여 줄 안내 문구와 응답 번호를 담는다.
export type ManageResult = { ok: true } | { ok: false; message: string; status: number };

// 칸마다 넣을 수 있는 최대 글자 수
const LIMITS = { serial: 20, type: 20, model: 50, user_name: 30, location: 30 } as const;
const LABELS = { serial: "시리얼번호", type: "종류", model: "모델명", user_name: "사용자", location: "위치" } as const;

// 글자가 아니면 빈 글자로 바꾸고, 앞뒤 빈칸을 없앤다.
function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// 날짜가 "2022-03-10" 형식이고 실제로 있는 날짜인지 본다.
function isRealDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

// 보낸 내용을 검사해 장비 1대의 정보로 정리한다. 문제가 있으면 안내 문구를 돌려준다.
export function readEquipmentInput(input: Record<string, unknown>): { ok: true; item: Equipment } | { ok: false; message: string } {
  const item: Equipment = {
    serial: clean(input.serial).toUpperCase(),
    type: clean(input.type),
    model: clean(input.model),
    user_name: clean(input.user_name),
    location: clean(input.location),
    purchased_on: clean(input.purchased_on),
  };

  for (const key of ["serial", "type", "model", "user_name", "location"] as const) {
    if (item[key] === "") return { ok: false, message: `${LABELS[key]} 칸을 채워 주세요.` };
    if (Array.from(item[key]).length > LIMITS[key]) {
      return { ok: false, message: `${LABELS[key]} 칸은 ${LIMITS[key]}자까지 적을 수 있습니다.` };
    }
  }
  if (!/^[A-Z0-9-]+$/.test(item.serial)) {
    return { ok: false, message: "시리얼번호는 영문, 숫자, -(빼기 기호)만 쓸 수 있습니다. (예: MN-0013)" };
  }
  if (!isRealDate(item.purchased_on)) {
    return { ok: false, message: "구입일을 골라 주세요. (예: 2022-03-10)" };
  }
  return { ok: true, item };
}

// 새 장비를 등록한다. 시리얼번호가 이미 있으면 거부한다.
export async function createEquipment(item: Equipment): Promise<ManageResult> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, message: NO_STORE_MESSAGE, status: 500 };

  const { error } = await supabase.from("equipment").insert(item);
  if (error) {
    // 23505: 겹치면 안 되는 값(시리얼번호)이 이미 있다는 뜻이다.
    if (error.code === "23505") {
      return { ok: false, message: `이미 등록된 시리얼번호입니다: ${item.serial}`, status: 409 };
    }
    console.error("장비를 등록하지 못했습니다:", error.message);
    return { ok: false, message: "장비를 등록하지 못했습니다. 다시 시도해 주세요.", status: 500 };
  }
  return { ok: true };
}

// 장비 정보를 고친다. 고친 내용은 데이터 저장소의 update_equipment 함수가 변경 이력과 한 묶음으로 처리한다.
export async function updateEquipment(item: Equipment): Promise<ManageResult> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, message: NO_STORE_MESSAGE, status: 500 };

  const { data, error } = await supabase.rpc("update_equipment", {
    p_serial: item.serial,
    p_type: item.type,
    p_model: item.model,
    p_user_name: item.user_name,
    p_location: item.location,
    p_purchased_on: item.purchased_on,
  });
  if (error) {
    console.error("장비를 고치지 못했습니다:", error.message);
    return { ok: false, message: "장비를 고치지 못했습니다. 다시 시도해 주세요.", status: 500 };
  }

  switch (data) {
    case "ok":
      return { ok: true };
    case "no_change":
      return { ok: false, message: "바뀐 내용이 없습니다.", status: 400 };
    case "not_found":
      return { ok: false, message: "그런 장비가 없습니다. 화면을 새로 고쳐 주세요.", status: 404 };
    default:
      return { ok: false, message: "장비를 고치지 못했습니다. 다시 시도해 주세요.", status: 500 };
  }
}

// 장비를 지운다. 신고나 변경 이력이 있는 장비는 데이터 저장소의 delete_equipment 함수가 막는다.
export async function deleteEquipment(serial: string): Promise<ManageResult> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, message: NO_STORE_MESSAGE, status: 500 };

  const { data, error } = await supabase.rpc("delete_equipment", { p_serial: serial });
  if (error) {
    console.error("장비를 지우지 못했습니다:", error.message);
    return { ok: false, message: "장비를 지우지 못했습니다. 다시 시도해 주세요.", status: 500 };
  }

  switch (data) {
    case "ok":
      return { ok: true };
    case "has_records":
      return { ok: false, message: "신고나 변경 이력이 있는 장비는 지울 수 없습니다.", status: 409 };
    case "not_found":
      return { ok: false, message: "그런 장비가 없습니다. 화면을 새로 고쳐 주세요.", status: 404 };
    default:
      return { ok: false, message: "장비를 지우지 못했습니다. 다시 시도해 주세요.", status: 500 };
  }
}
