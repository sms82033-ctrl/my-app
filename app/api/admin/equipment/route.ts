import {
  createEquipment,
  deleteEquipment,
  readEquipmentInput,
  updateEquipment,
} from "@/lib/equipment-admin";
import { isAdmin } from "@/lib/session";

// 장비 직접 관리 서버 경로: 입력·수정·삭제 (PRD must 3, DESIGN.md 2.6)
// 관리자용이다. 로그인하지 않은 요청은 거부한다.

// 잘못된 요청에 돌려주는 답
function badRequest(message: string): Response {
  return Response.json({ ok: false, message }, { status: 400 });
}

export async function POST(request: Request): Promise<Response> {
  // 로그인한 관리자만 장비를 직접 고칠 수 있다.
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

  let result;
  if (input.action === "create" || input.action === "update") {
    const read = readEquipmentInput(input);
    if (!read.ok) return badRequest(read.message);
    result = input.action === "create" ? await createEquipment(read.item) : await updateEquipment(read.item);
  } else if (input.action === "delete") {
    const serial = typeof input.serial === "string" ? input.serial.trim() : "";
    if (serial === "") return badRequest("지울 장비를 골라 주세요.");
    result = await deleteEquipment(serial);
  } else {
    return badRequest("입력, 수정, 삭제 중 하나를 골라 주세요.");
  }

  if (!result.ok) {
    return Response.json({ ok: false, message: result.message }, { status: result.status });
  }
  return Response.json({ ok: true });
}
