import { organizeReport } from "@/lib/ai";
import { listEquipment } from "@/lib/equipment";
import { crossSiteResponse, findTextProblem, isCrossSite } from "@/lib/input-check";
import { applyRules } from "@/lib/report-rules";
import { countReportLoad, saveReport } from "@/lib/reports";

// 신고 접수 서버 경로 (DESIGN.md 2.2)
// 신고 글을 AI로 정리하고, 규칙대로 검사한 뒤, "대기" 상태로 저장하고 정리 결과를 돌려준다.

const MAX_TEXT_LENGTH = 500; // 신고 글 길이 제한
const MAX_NAME_LENGTH = 20; // 신고자 이름 길이 제한

// 정리 결과는 5초 이내에 보여 줘야 한다. (PRD 5번)
// 저장과 응답에 걸리는 시간을 남겨 두려고, AI 정리와 검사는 4.5초 안에 끝나야 한다.
// 그 안에 끝나지 않으면 저장하지 않고 "다시 시도"를 안내한다.
const ORGANIZE_DEADLINE_MS = 4500;

const TIMEOUT_MESSAGE = "AI 정리에 시간이 너무 오래 걸렸습니다. 다시 시도해 주세요.";
const UNAVAILABLE_MESSAGE = "지금은 신고를 접수할 수 없습니다. 잠시 후 다시 시도해 주세요.";

// 누군가 신고 접수를 반복해서 불러 AI 요금과 대기 목록을 불리는 것을 막는 한도.
// 한도를 넘으면 AI를 부르지 않고 "잠시 후 다시"를 안내한다.
const MAX_PENDING = 50; // 승인을 기다리는 신고가 이만큼 쌓이면 새 신고를 받지 않는다.
const RECENT_MINUTES = 10;
const MAX_RECENT = 30; // 최근 10분 동안 받는 신고 수

// 글자 수를 센다. 이모지 같은 글자도 1글자로 센다.
function countChars(text: string): number {
  return Array.from(text).length;
}

// 잘못된 요청에 돌려주는 답
function badRequest(message: string): Response {
  return Response.json({ ok: false, message }, { status: 400 });
}

// 실패했을 때 돌려주는 답. 실패한 신고는 저장하지 않는다.
function failed(message: string, status: number): Response {
  return Response.json({ ok: false, message }, { status });
}

export async function POST(request: Request): Promise<Response> {
  const startedAt = Date.now();

  // 다른 사이트의 화면에서 몰래 보낸 요청은 받지 않는다.
  if (isCrossSite(request)) return crossSiteResponse();

  // 1) 보낸 내용을 읽고 확인한다.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("보낸 내용을 읽을 수 없습니다.");
  }

  const input = (body ?? {}) as { reporter?: unknown; text?: unknown };
  if (typeof input.reporter !== "string" || input.reporter.trim() === "") {
    return badRequest("신고자 이름을 적어 주세요.");
  }
  if (countChars(input.reporter.trim()) > MAX_NAME_LENGTH) {
    return badRequest(`신고자 이름은 ${MAX_NAME_LENGTH}자까지 적을 수 있습니다.`);
  }
  if (typeof input.text !== "string" || input.text.trim() === "") {
    return badRequest("변동 내용을 적어 주세요.");
  }
  if (countChars(input.text.trim()) > MAX_TEXT_LENGTH) {
    return badRequest(`변동 내용은 ${MAX_TEXT_LENGTH}자까지 적을 수 있습니다.`);
  }
  const reporter = input.reporter.trim();
  const text = input.text.trim();

  // 개인정보나 쓸 수 없는 글자가 있으면 저장하거나 AI에 보내기 전에 거절한다.
  const problem = findTextProblem(reporter) ?? findTextProblem(text);
  if (problem) {
    return badRequest(problem);
  }

  // 2) 신고가 몰려 있으면 받지 않는다. 동시에 데이터 저장소에서 장비 목록을 읽는다.
  const [load, equipment] = await Promise.all([countReportLoad(RECENT_MINUTES), listEquipment()]);
  if (!load || !equipment.ok) {
    // 로그인 없이 쓰는 화면이므로 자세한 원인은 서버 기록에만 남긴다.
    if (!equipment.ok) console.error("신고 접수 실패:", equipment.message);
    return failed(UNAVAILABLE_MESSAGE, 500);
  }
  if (load.pending >= MAX_PENDING || load.recent >= MAX_RECENT) {
    console.warn(`신고가 몰려 접수를 잠시 멈췄습니다: 대기 ${load.pending}건, 최근 ${RECENT_MINUTES}분 ${load.recent}건`);
    return failed("지금은 접수된 신고가 많습니다. 잠시 후 다시 보내 주세요.", 429);
  }

  // 3) 신고 글과 장비 목록을 AI에 보내 정리한다. 남은 시간만큼만 기다린다.
  const timeLeft = ORGANIZE_DEADLINE_MS - (Date.now() - startedAt);
  if (timeLeft <= 0) {
    return failed(TIMEOUT_MESSAGE, 504);
  }
  const organized = await organizeReport(text, equipment.items, timeLeft);
  if (!organized.ok) {
    return failed(organized.message, organized.timedOut ? 504 : 502);
  }

  // 4) AI의 답을 규칙대로 한 번 더 검사한다.
  const checked = applyRules(organized.report, equipment.items, text);

  // 5) 시간이 넘었으면 저장하지 않는다.
  if (Date.now() - startedAt > ORGANIZE_DEADLINE_MS) {
    return failed(TIMEOUT_MESSAGE, 504);
  }

  // 6) 정리 결과를 "대기" 상태로 저장한다.
  const saved = await saveReport(reporter, text, checked);
  if (!saved.ok) {
    return failed(saved.message, 500);
  }

  // 7) 직원 화면에 보여 줄 내용만 골라 돌려준다.
  //    로그인 없이 쓰는 화면이므로 장비는 종류·모델명·시리얼번호 끝 4자리만 보여 주고,
  //    다른 사람의 이름과 자리 위치는 보내지 않는다. (DESIGN.md 1.2)
  const bySerial = new Map(equipment.items.map((item) => [item.serial, item]));
  const toSummary = (serial: string) => {
    const item = bySerial.get(serial)!;
    return { type: item.type, model: item.model, serialTail: item.serial.slice(-4) };
  };

  return Response.json({
    ok: true,
    report: {
      equipment: checked.equipmentSerial ? toSummary(checked.equipmentSerial) : null,
      candidates: checked.candidateSerials.map(toSummary),
      changeType: checked.changeType,
      oldLocation: checked.oldLocation,
      newLocation: checked.newLocation,
      userName: checked.userName,
    },
  });
}
