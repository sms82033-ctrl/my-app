import { approveReport, rejectReport } from "@/lib/approval";
import { crossSiteResponse, isCrossSite } from "@/lib/input-check";
import { isAdmin } from "@/lib/session";

// 신고 승인·반려 서버 경로 (DESIGN.md 2.3)
// 관리자용이다. 로그인하지 않은 요청은 거부한다.

// 잘못된 요청에 돌려주는 답
function badRequest(message: string): Response {
  return Response.json({ ok: false, message }, { status: 400 });
}

// 글자가 아니면 빈 글자로 바꾼다.
function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export async function POST(request: Request): Promise<Response> {
  // 다른 사이트의 화면에서 몰래 보낸 요청은 받지 않는다.
  if (isCrossSite(request)) return crossSiteResponse();

  // 로그인한 관리자만 승인·반려할 수 있다.
  if (!(await isAdmin())) {
    return Response.json({ ok: false, message: "관리자 로그인이 필요합니다." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("보낸 내용을 읽을 수 없습니다.");
  }

  const input = (body ?? {}) as Record<string, unknown>;
  const reportId = input.reportId;
  if (typeof reportId !== "number" || !Number.isInteger(reportId) || reportId <= 0) {
    return badRequest("신고 번호가 올바르지 않습니다.");
  }

  let result;
  if (input.action === "approve") {
    result = await approveReport({
      reportId,
      serial: asText(input.serial),
      changeType: asText(input.changeType),
      newLocation: asText(input.newLocation),
      userName: asText(input.userName),
    });
  } else if (input.action === "reject") {
    result = await rejectReport(reportId);
  } else {
    return badRequest("승인 또는 반려 중 하나를 골라 주세요.");
  }

  if (!result.ok) {
    return Response.json({ ok: false, message: result.message }, { status: result.status });
  }
  return Response.json({ ok: true });
}
