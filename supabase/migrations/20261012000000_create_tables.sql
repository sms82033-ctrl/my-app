-- 전산장비 관리 프로그램의 표 3개를 만든다 (DESIGN.md 2.1)
-- 장비(equipment), 신고(reports), 변경 이력(change_history)

-- 1) 장비 표: 예시 장비 30대를 담는다
create table public.equipment (
  serial       text primary key,   -- 시리얼번호 (장비를 구분하는 고유값)
  type         text not null,      -- 종류 (본체, 모니터, 프린터 등)
  model        text not null,      -- 모델명
  user_name    text not null,      -- 사용자 (실습에서는 가짜 이름)
  location     text not null,      -- 위치 ("층 + 자리 번호", 예: 3층 A-12)
  purchased_on date not null       -- 구입일
);

comment on table public.equipment is '장비 목록';

-- 2) 신고 표: 직원이 보낸 신고와 AI 정리 결과를 담는다
create table public.reports (
  id                bigint generated always as identity primary key,  -- 신고 번호
  reporter          text not null,                                    -- 신고자
  original_text     text not null
                    check (char_length(original_text) <= 500),        -- 원문 (500자 제한)
  equipment_serial  text references public.equipment (serial),        -- 장비 (특정하지 못하면 비워 둔다)
  candidate_serials text[] not null default '{}'
                    check (cardinality(candidate_serials) <= 3),      -- 후보 장비 (0~3대)
  change_type       text not null
                    check (change_type in ('자리 이동', '교체', '고장', '기타', '확인 필요')),  -- 변동 종류
  old_location      text not null default '확인 필요',                -- 이전 위치
  new_location      text not null default '확인 필요',                -- 새 위치
  user_name         text not null default '확인 필요',                -- 사용자 (변동 후 장비를 쓰는 사람)
  status            text not null default '대기'
                    check (status in ('대기', '승인', '반려')),       -- 상태
  reported_at       timestamptz not null default now(),               -- 신고 시각
  processed_at      timestamptz                                       -- 처리 시각 (승인·반려한 때)
);

comment on table public.reports is '변동 신고와 AI 정리 결과';

-- 대기 중인 신고를 빨리 찾기 위한 색인
create index reports_status_idx on public.reports (status, reported_at);

-- 3) 변경 이력 표: 승인된 변동의 기록을 담는다
create table public.change_history (
  id               bigint generated always as identity primary key,
  report_id        bigint not null unique references public.reports (id),  -- 신고 번호 (신고 1건당 이력 1건만 남긴다)
  equipment_serial text not null references public.equipment (serial),     -- 어떤 장비의 이력인지 찾는 데 쓴다
  who              text not null,                                          -- 누가 (신고자)
  changed_at       timestamptz not null default now(),                     -- 언제 (승인한 시각)
  what             text not null,                                          -- 무엇을 (장비 종류와 시리얼번호)
  how              text not null                                           -- 어떻게 (변동 종류와 바뀐 내용)
);

comment on table public.change_history is '승인된 변동의 변경 이력';

-- 장비별 최근 이력을 빨리 찾기 위한 색인
create index change_history_equipment_idx on public.change_history (equipment_serial, changed_at desc);

-- 공개 접근 막기: 행 수준 보안을 켜고 허용 규칙을 하나도 두지 않는다.
-- 이렇게 하면 서버용 열쇠(service role)를 가진 우리 서버만 읽고 쓸 수 있다.
alter table public.equipment      enable row level security;
alter table public.reports        enable row level security;
alter table public.change_history enable row level security;
