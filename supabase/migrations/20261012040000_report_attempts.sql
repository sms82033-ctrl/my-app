-- 신고 접수 한도 (PRD 7번 보안, DESIGN.md 2.2)
-- 누군가 신고 접수를 반복해서 불러 AI 요금과 대기 목록을 불리는 것을 막는다.
-- AI를 부르기 "전에" 시도를 먼저 기록하므로, AI가 실패하거나 시간이 넘어 저장되지 않은 호출도 센다.
-- 세기와 기록을 한 묶음으로 처리하므로, 같은 순간에 몰려온 요청도 한도를 넘지 못한다.

-- 1) 접수 시도 기록 표
create table public.report_attempts (
  id           bigint generated always as identity primary key,
  attempted_at timestamptz not null default now(),  -- 시도한 시각
  requester    text not null                        -- 보낸 곳을 알아볼 수 없게 바꾼 값 (IP 주소를 그대로 두지 않는다)
);

comment on table public.report_attempts is '신고 접수 시도 기록 (접수 한도 계산용)';

create index report_attempts_time_idx on public.report_attempts (attempted_at);

-- 공개 접근 막기
alter table public.report_attempts enable row level security;

-- 2) 접수 자리 잡기: 한도 안이면 시도를 기록하고 ok를, 넘으면 이유를 돌려준다.
--    ok         접수해도 됨 (시도 1건 기록함)
--    too_many   같은 곳에서 최근에 너무 많이 보냄
--    busy       최근에 전체 신고가 너무 많음
--    backlog    승인을 기다리는 신고가 너무 많이 쌓임
create function public.claim_report_slot(
  p_requester         text,     -- 보낸 곳 (알 수 없으면 빈 글자)
  p_minutes           integer,  -- 최근 몇 분을 볼지
  p_max_per_requester integer,  -- 그 시간 동안 한 곳에서 보낼 수 있는 수
  p_max_recent        integer,  -- 그 시간 동안 전체가 보낼 수 있는 수
  p_max_pending       integer   -- 대기 신고가 이만큼 쌓이면 받지 않음
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_since timestamptz := now() - make_interval(mins => p_minutes);
begin
  -- 한 번에 한 요청만 세고 기록하게 줄을 세운다. 이 묶음이 끝나면 자동으로 풀린다.
  perform pg_advisory_xact_lock(hashtext('public.report_attempts'));

  -- 하루가 지난 기록은 더 볼 일이 없으므로 치운다.
  delete from public.report_attempts where attempted_at < now() - interval '1 day';

  -- 보낸 곳을 알 때만 한 곳당 한도를 적용한다.
  if p_requester <> '' and
     (select count(*) from public.report_attempts
       where requester = p_requester and attempted_at >= v_since) >= p_max_per_requester then
    return 'too_many';
  end if;

  if (select count(*) from public.report_attempts where attempted_at >= v_since) >= p_max_recent then
    return 'busy';
  end if;

  if (select count(*) from public.reports where status = '대기') >= p_max_pending then
    return 'backlog';
  end if;

  insert into public.report_attempts (requester) values (p_requester);
  return 'ok';
end;
$$;

comment on function public.claim_report_slot is '신고 접수 한도 확인과 시도 기록을 한 묶음으로 처리';

-- 공개 접근 막기: 서버용 열쇠(service role)를 가진 우리 서버만 이 함수를 부를 수 있다.
revoke execute on function public.claim_report_slot(text, integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_report_slot(text, integer, integer, integer, integer) to service_role;
