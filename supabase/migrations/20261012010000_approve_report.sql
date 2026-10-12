-- 신고 승인을 한 묶음으로 처리하는 함수 (DESIGN.md 2.3)
-- 장비 표 수정과 신고 상태 변경을 한 번에 처리한다. 중간에 실패하면 둘 다 취소된다.
-- 결과는 글자로 돌려준다:
--   ok               승인 완료
--   not_found        그런 신고가 없음
--   not_pending      이미 승인 또는 반려된 신고 (버튼을 두 번 눌러도 한 번만 처리된다)
--   bad_change_type  변동 종류가 4가지 중 하나가 아님
--   bad_equipment    목록에 없는 장비
--   missing_location 자리 이동인데 새 위치가 없음

create function public.approve_report(
  p_report_id    bigint,  -- 신고 번호
  p_serial       text,    -- 관리자가 확인한 장비
  p_change_type  text,    -- 관리자가 확인한 변동 종류
  p_new_location text,    -- 관리자가 확인한 새 위치 (없으면 '확인 필요')
  p_user_name    text     -- 관리자가 확인한 사용자 (없으면 '확인 필요')
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_status text;
begin
  -- 같은 신고를 동시에 두 번 처리하지 못하도록 그 줄을 잠근다.
  select status into v_status from public.reports where id = p_report_id for update;
  if not found then
    return 'not_found';
  end if;
  if v_status <> '대기' then
    return 'not_pending';
  end if;

  if p_change_type not in ('자리 이동', '교체', '고장', '기타') then
    return 'bad_change_type';
  end if;

  if not exists (select 1 from public.equipment where serial = p_serial) then
    return 'bad_equipment';
  end if;

  -- 변동 종류별 반영 규칙: 자리 이동만 장비 표를 고친다.
  -- 교체·고장·기타는 장비 표에 고칠 칸이 없으므로 그대로 둔다.
  if p_change_type = '자리 이동' then
    if coalesce(btrim(p_new_location), '') in ('', '확인 필요') then
      return 'missing_location';
    end if;

    update public.equipment
       set location  = btrim(p_new_location),
           -- 사용자 칸에 이름이 있으면 사용자도 바꾸고, 없으면 기존 사용자를 그대로 둔다.
           user_name = case
                         when coalesce(btrim(p_user_name), '') in ('', '확인 필요') then user_name
                         else btrim(p_user_name)
                       end
     where serial = p_serial;
  end if;

  -- 관리자가 확인한 내용으로 신고를 고치고 "승인"으로 바꾼다.
  update public.reports
     set equipment_serial = p_serial,
         change_type      = p_change_type,
         new_location     = case when coalesce(btrim(p_new_location), '') = '' then '확인 필요' else btrim(p_new_location) end,
         user_name        = case when coalesce(btrim(p_user_name), '') = '' then '확인 필요' else btrim(p_user_name) end,
         status           = '승인',
         processed_at     = now()
   where id = p_report_id;

  return 'ok';
end;
$$;

comment on function public.approve_report is '신고 승인: 장비 표 반영과 상태 변경을 한 묶음으로 처리';

-- 공개 접근 막기: 서버용 열쇠(service role)를 가진 우리 서버만 이 함수를 부를 수 있다.
revoke execute on function public.approve_report(bigint, text, text, text, text) from public, anon, authenticated;
grant execute on function public.approve_report(bigint, text, text, text, text) to service_role;
