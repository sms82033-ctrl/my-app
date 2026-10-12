# 전산장비 관리 프로그램

사무실 전산장비(본체, 모니터, 프린터, 스캐너, 복합기) 목록이 실제와 어긋나는 문제를 풀기 위한 실습 프로젝트입니다.

직원이 평소 말투로 변동을 신고하면 AI가 항목별로 정리하고, 관리자가 승인한 것만 장비 목록에 반영합니다. 목록이 바뀔 때마다 변경 이력이 남습니다.

> 실습용 프로젝트입니다. 데이터는 가짜 이름을 쓴 예시 장비 30대만 사용합니다.

## 주요 기능

| 기능 | 설명 |
|---|---|
| 변동 신고 AI 정리 | 직원이 "3층 A-12 직원A 모니터를 5층 B-03으로 옮겼어요"처럼 쓰면, AI가 장비·변동 종류·이전 위치·새 위치·사용자로 정리합니다. |
| 관리자 승인 | 관리자가 원문과 AI 정리 결과를 함께 보고, 필요하면 고친 뒤 승인하거나 반려합니다. 승인한 신고만 목록에 반영됩니다. |
| 장비 조회와 변경 이력 | 사용자·위치·시리얼번호로 장비를 찾고, 장비마다 최근 변경 이력을 10건까지 봅니다. |
| 장비 직접 관리 | 관리자가 장비를 직접 등록·수정·삭제합니다. 직접 고친 내용도 변경 이력에 남습니다. |
| 관리자 로그인 | 관리자용 화면은 비밀번호로 잠겨 있습니다. |

### AI가 지키는 규칙

AI의 답을 그대로 믿지 않고, 서버에서 한 번 더 검사합니다.

- 변동 종류는 "자리 이동 / 교체 / 고장 / 기타" 4가지 중 하나로만 분류합니다.
- 신고 글에 없는 내용은 지어내지 않고 "확인 필요"로 남깁니다.
- 장비를 1대로 특정할 수 없으면 임의로 고르지 않고 후보를 최대 3대까지 보여 줍니다.
- AI는 장비 목록을 직접 고치지 않습니다. 목록을 바꾸는 것은 관리자뿐입니다.
- 정리 결과는 5초 이내에 보여 주고, 넘기면 저장하지 않고 다시 시도를 안내합니다.

## 화면

| 주소 | 화면 | 누가 쓰나 |
|---|---|---|
| `/` | 첫 화면 | 모두 |
| `/report` | 변동 신고 | 직원 (로그인 없음) |
| `/admin/login` | 관리자 로그인 | 관리자 |
| `/admin/reports` | 신고 승인 | 관리자 |
| `/admin/equipment` | 장비 조회, 변경 이력, 수정·삭제 | 관리자 |
| `/admin/equipment/new` | 장비 입력 | 관리자 |

## 사용 기술

- [Next.js](https://nextjs.org) 16 (App Router), React 19, TypeScript, Tailwind CSS 4
- [Supabase](https://supabase.com) — 장비·신고·변경 이력을 보관하는 데이터 저장소
- [OpenAI API](https://platform.openai.com) — 신고 글을 정리하는 AI (`gpt-4.1-mini`)

## 실행 방법

Node.js와 Supabase 프로젝트, OpenAI API 키가 필요합니다.

### 1. 내려받고 설치하기

```bash
git clone https://github.com/sms82033-ctrl/my-app.git
cd my-app
npm install
```

### 2. `.env` 파일 만들기

프로젝트 폴더에 `.env` 파일을 만들고 아래 다섯 줄을 채웁니다. 이 파일은 `.gitignore`에 등록되어 있어 GitHub에 올라가지 않습니다.

```
OPENAI_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_PASSWORD=
SESSION_SECRET=
```

| 이름 | 넣을 값 |
|---|---|
| `OPENAI_API_KEY` | OpenAI API 키 |
| `SUPABASE_URL` | Supabase 프로젝트 주소 (`https://....supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase의 `service_role` 열쇠 |
| `ADMIN_PASSWORD` | 관리자 로그인에 쓸 비밀번호 (직접 정함) |
| `SESSION_SECRET` | 로그인 표시 서명용 비밀값 (길고 무작위인 글자) |

모든 값은 서버에서만 사용합니다. 채팅이나 코드, 공개된 곳에 붙여 넣지 마세요.

### 3. 데이터 저장소 준비하기

`supabase/migrations`의 표와 함수, `supabase/seed.sql`의 예시 장비 30대를 Supabase 프로젝트에 적용합니다.

```bash
npx supabase login
npx supabase link --project-ref <프로젝트 ID>
npx supabase db push --include-seed
```

### 4. 실행하기

```bash
npm run dev
```

브라우저에서 http://localhost:3000 을 엽니다. 관리자 화면은 `.env`의 `ADMIN_PASSWORD`로 로그인합니다.

### 그 밖의 명령

| 명령 | 하는 일 |
|---|---|
| `npm run lint` | 코드 검사 |
| `npm run build` | 배포용 빌드 |

## 폴더 구조

| 위치 | 내용 |
|---|---|
| `app/` | 화면과 서버 경로 |
| `app/api/` | 신고 접수, 승인·반려, 장비 관리, 로그인 서버 경로 |
| `lib/` | 데이터 저장소 연결, AI 호출과 규칙 검사, 로그인 확인 |
| `proxy.ts` | 관리자용 주소로 오는 요청을 먼저 걸러 내는 코드 |
| `supabase/` | 표와 함수를 만드는 SQL, 예시 장비 데이터 |
| `docs/sample-reports.md` | 점검용 신고 글 10건과 기대 결과표 |

## 문서

| 문서 | 내용 |
|---|---|
| [PRD.md](PRD.md) | 기획서: 문제 정의, 목표, 기능, 범위, 보안 |
| [PLAN.md](PLAN.md) | 개발 계획: 성공 기준과 작업 목록 |
| [DESIGN.md](DESIGN.md) | 설계서: 화면 구성, 데이터 흐름, 기술 선택 |
| [CLAUDE.md](CLAUDE.md) | AI 코딩 도구와 함께 일할 때의 프로젝트 규칙 |

## 알아둘 점

- 직원용 신고 화면은 로그인 없이 쓰므로, 다른 사람의 이름과 자리 위치를 보여 주지 않습니다.
- 신고 글과 장비 목록은 정리를 위해 OpenAI 서버로 전송됩니다. 신고 글에 개인정보를 적지 마세요.
- 관리자는 비밀번호 1개를 함께 씁니다. 직원별 계정, 로그인 시도 횟수 제한은 없습니다.
- 한 번이라도 신고나 변경 이력이 생긴 장비는 지울 수 없습니다.
