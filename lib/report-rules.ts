import type { Equipment } from "@/lib/equipment";

// AI가 정리한 답을 서버에서 한 번 더 검사해 PRD 5번의 규칙을 지키게 한다. (DESIGN.md 2.2 처리 3~4, 4번)
// AI에게 부탁만 하지 않고, 여기서 규칙에 어긋난 부분을 걸러 낸다.

// 변동 종류는 이 4가지 중 하나로만 분류한다.
export const CHANGE_TYPES = ["자리 이동", "교체", "고장", "기타"] as const;

// 신고 글에 없는 내용을 채우는 말
export const NEEDS_CHECK = "확인 필요";

// 후보 장비는 최대 3대까지만 보여 준다.
export const MAX_CANDIDATES = 3;

// 위치·사용자 칸에 들어갈 수 있는 최대 글자 수
const MAX_FIELD_LENGTH = 30;

// AI가 정리해 돌려준 내용 (검사 전)
export type OrganizedReport = {
  candidateSerials: string[]; // 해당할 수 있는 장비의 시리얼번호
  changeType: string; // 변동 종류
  oldLocation: string; // 이전 위치
  newLocation: string; // 새 위치
  userName: string; // 사용자 (변동 후 그 장비를 쓰는 사람)
};

// 검사를 마친 정리 결과
export type CheckedReport = {
  equipmentSerial: string | null; // 1대로 정해진 장비. 정하지 못했으면 null ("확인 필요")
  candidateSerials: string[]; // 후보 장비 (0~3대). 1대로 정해졌으면 비어 있다.
  changeType: string; // 4가지 중 하나 또는 "확인 필요"
  oldLocation: string;
  newLocation: string;
  userName: string;
};

// 비교하기 쉽게 글자를 다듬는다: 영문은 소문자로, 띄어쓰기는 없앤다.
function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "");
}

// 이름이 신고 글에 그대로 적혀 있는지 본다.
function nameAppearsIn(text: string, name: string): boolean {
  return normalize(text).includes(normalize(name));
}

// 위치가 신고 글에 근거가 있는지 본다.
// 위치를 이루는 숫자·영문·한글 조각("3층", "A", "12")이 모두 글에 나와야 한다.
// AI가 "3층 a12"를 "3층 A-12"로 다듬은 것은 통과시키고, 글에 없는 위치를 지어낸 것은 걸러 낸다.
function locationAppearsIn(text: string, location: string): boolean {
  const pieces = normalize(location).match(/[0-9]+[가-힣]*|[a-z]+|[가-힣]+/g) ?? [];
  if (pieces.length === 0) return false;
  const source = normalize(text);
  return pieces.every((piece) => source.includes(piece));
}

// 칸 하나를 검사한다. 비었거나, 너무 길거나, 신고 글에 근거가 없으면 "확인 필요"로 바꾼다.
function checkField(value: unknown, isSupported: (cleaned: string) => boolean): string {
  if (typeof value !== "string") return NEEDS_CHECK;
  const cleaned = value.trim();
  if (cleaned === "" || cleaned === NEEDS_CHECK) return NEEDS_CHECK;
  if (Array.from(cleaned).length > MAX_FIELD_LENGTH) return NEEDS_CHECK;
  return isSupported(cleaned) ? cleaned : NEEDS_CHECK;
}

// AI의 답을 검사해 규칙에 맞는 정리 결과로 바꾼다.
export function applyRules(report: OrganizedReport, equipment: Equipment[], text: string): CheckedReport {
  // 규칙 1) 변동 종류는 4가지 중 하나여야 한다. 아니면 "확인 필요".
  const changeType = (CHANGE_TYPES as readonly string[]).includes(report.changeType)
    ? report.changeType
    : NEEDS_CHECK;

  // 규칙 2) 목록에 실제로 있는 장비만 남긴다. 같은 장비가 두 번 나오면 한 번만 센다.
  const known = new Map(equipment.map((item) => [item.serial.toUpperCase(), item.serial]));
  const valid: string[] = [];
  for (const raw of Array.isArray(report.candidateSerials) ? report.candidateSerials : []) {
    if (typeof raw !== "string") continue;
    const serial = known.get(raw.trim().toUpperCase());
    if (serial && !valid.includes(serial)) valid.push(serial);
  }

  // 규칙 3) 1대면 그 장비로 정하고, 여러 대면 임의로 고르지 않고 후보로 돌린다(최대 3대).
  //         0대면 장비도 후보도 비워 두고 관리자가 전체 목록에서 고르게 한다.
  const equipmentSerial = valid.length === 1 ? valid[0] : null;
  const candidateSerials = valid.length > 1 ? valid.slice(0, MAX_CANDIDATES) : [];

  // 규칙 4) 신고 글에 없는 내용은 "확인 필요"로 남긴다.
  //         위치와 사용자는 신고 글에 근거가 있을 때만 받아들인다.
  return {
    equipmentSerial,
    candidateSerials,
    changeType,
    oldLocation: checkField(report.oldLocation, (value) => locationAppearsIn(text, value)),
    newLocation: checkField(report.newLocation, (value) => locationAppearsIn(text, value)),
    userName: checkField(report.userName, (value) => nameAppearsIn(text, value)),
  };
}
