// 바깥에서 들어온 요청과 글을 받기 전에 걸러 내는 검사 (PRD 7번 보안·개인정보)

// 글자 사이에 숨겨 넣을 수 있는 제어 문자 (줄바꿈과 탭은 허용한다)
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

// 화면에 보이지 않거나 글자 순서를 뒤집어 보이게 하는 문자.
// 관리자 화면에서 신고 원문이 실제와 다르게 보이도록 속이는 데 쓰일 수 있다.
const INVISIBLE_CHARS = /[​-‏‪-‮⁠-⁩﻿]/;

// 짝이 맞지 않아 깨진 글자. 저장하거나 다른 곳으로 보낼 때 오류를 일으킨다.
const BROKEN_CHARS = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

// 개인정보처럼 생긴 글자 모양.
// 실수로 적은 흔한 모양을 걸러 내는 용도다. 일부러 피해서 적은 것까지 모두 막지는 못한다.
const PERSONAL_INFO = [
  // 주민등록번호·외국인등록번호 (예: 900101-1234567, 900101.1234567)
  /\d{6}\s*[-./]?\s*[1-8]\d{6}/,
  // 휴대전화 번호 (예: 010-1234-5678, 010 - 1234 - 5678, 010)1234-5678, +82 10-1234-5678)
  /(?:\+82[-\s.]?|0)1[016-9]\)?\s*[-.]?\s*\d{3,4}\s*[-.]?\s*\d{4}/,
  // 일반 전화 번호 (예: 02-123-4567, 031)123-4567)
  /0\d{1,2}\s*[-).]\s*\d{3,4}\s*[-.]\s*\d{4}/,
  // 이메일 주소
  /[^\s@]+@[^\s@]+\.[^\s@]+/,
];

// 사용자가 쓴 글에 받으면 안 되는 내용이 있는지 본다. 있으면 안내 문구를, 없으면 null을 돌려준다.
// 개인정보가 데이터 저장소와 AI 서비스로 넘어가지 않도록, 저장하거나 AI에 보내기 전에 부른다.
export function findTextProblem(text: string): string | null {
  if (CONTROL_CHARS.test(text) || INVISIBLE_CHARS.test(text) || BROKEN_CHARS.test(text)) {
    return "쓸 수 없는 글자가 들어 있습니다. 다시 적어 주세요.";
  }
  // "０１０"처럼 폭이 넓은 숫자·기호로 적어도 걸리도록, 보통 글자로 바꿔서 본다.
  const plain = text.normalize("NFKC");
  if (PERSONAL_INFO.some((pattern) => pattern.test(plain))) {
    return "주민등록번호, 전화번호, 이메일처럼 보이는 내용이 있습니다. 개인정보는 지우고 다시 보내 주세요.";
  }
  return null;
}

// 다른 사이트의 화면에서 몰래 보낸 요청인지 본다.
// 브라우저는 요청을 보낸 화면의 주소(origin)를 함께 알려 주므로, 그 주소가 우리 주소와 다르면 받지 않는다.
// 브라우저가 아닌 곳에서 보내 origin이 없는 요청은 여기서 막지 않고, 로그인 확인 등 다른 검사에 맡긴다.
export function isCrossSite(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== request.headers.get("host");
  } catch {
    return true; // 주소로 읽을 수 없는 값이면 받지 않는다.
  }
}

// 다른 사이트에서 온 요청에 돌려주는 답
export function crossSiteResponse(): Response {
  return Response.json({ ok: false, message: "이 화면에서 보낸 요청이 아닙니다." }, { status: 403 });
}
