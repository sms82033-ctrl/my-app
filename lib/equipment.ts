import { getSupabase } from "@/lib/supabase";

// 장비 표의 한 줄 (DESIGN.md 2.1)
export type Equipment = {
  serial: string; // 시리얼번호 (장비를 구분하는 고유값)
  type: string; // 종류
  model: string; // 모델명
  user_name: string; // 사용자
  location: string; // 위치
  purchased_on: string; // 구입일 (예: 2022-03-10)
};

// 장비 목록을 읽은 결과. 실패하면 화면에 보여 줄 안내 문구를 담는다.
export type EquipmentResult =
  | { ok: true; items: Equipment[] }
  | { ok: false; message: string };

// 데이터 저장소에서 장비 목록 전체를 시리얼번호 순으로 읽는다.
export async function listEquipment(): Promise<EquipmentResult> {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      ok: false,
      message:
        "데이터 저장소 접속 값이 없습니다. .env 파일에 SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 넣어 주세요.",
    };
  }

  const { data, error } = await supabase
    .from("equipment")
    .select("serial, type, model, user_name, location, purchased_on")
    .order("serial");

  if (error) {
    // 자세한 오류는 서버 기록에만 남기고, 화면에는 짧은 안내만 보여 준다.
    console.error("장비 목록을 읽지 못했습니다:", error.message);
    return {
      ok: false,
      message: "장비 목록을 읽지 못했습니다. 잠시 후 다시 시도해 주세요.",
    };
  }

  return { ok: true, items: data };
}

// 비교하기 쉽게 글자를 다듬는다: 영문은 소문자로, 띄어쓰기는 없앤다.
// 그래서 "mn-0012"로도, "3층A-12"로도 찾을 수 있다.
function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "");
}

// 사용자 이름·위치·시리얼번호 중 하나라도 검색어가 들어 있는 장비만 골라낸다. (DESIGN.md 2.4)
// 검색어가 비어 있으면 전체를 돌려준다.
// AI를 쓰지 않고 저장소에서 읽은 목록 안에서만 찾으므로, 목록에 없는 장비는 결과로 나올 수 없다.
export function filterEquipment(items: Equipment[], query: string): Equipment[] {
  const keyword = normalize(query);
  if (keyword === "") return items;

  return items.filter((item) =>
    [item.user_name, item.location, item.serial].some((value) =>
      normalize(value).includes(keyword),
    ),
  );
}
