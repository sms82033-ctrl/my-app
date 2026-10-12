-- 신고 승인 함수에 변경 이력 기록을 더한다 (DESIGN.md 2.1, 2.3)
-- 장비 표 수정, 변경 이력 추가, 신고 상태 변경을 한 묶음으로 처리한다. 중간에 실패하면 셋 다 취소된다.
-- 승인 1건마다 이력 1건을 남긴다:
--   누가   신고자 이름 (승인한 사람은 비밀번호 1개를 함께 쓰므로 따로 적지 않는다)
--   언제   승인한 시각
--   무엇을 장비 종류와 시리얼번호 (예: 모니터 MN-0012)
--   어떻게 변동 종류와 바뀐 내용 (예: 자리 이동: 3층 A-12 → 5층 B-03)
-- 결과로 돌려주는 글자는 이전과 같다 (ok, not_found, not_pending, bad_change_type, bad_equipment, missing_location).

create or replace function public.approve_report(
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
  v_status       text;
  v_reporter     text;
  v_type         text;  -- 장비 종류
  v_old_location text;  -- 승인 전 장비 위치
  v_old_user     text;  -- 승인 전 장비 사용자
  v_new_location text;
  v_new_user     text;
  v_how          text;
begin
  -- 같은 신고를 동시에 두 번 처리하지 못하도록 그 줄을 잠근다.
  select status, reporter into v_status, v_reporter
    from public.reports where id = p_report_id for update;
  if not found then
    return 'not_found';
  end if;
  if v_status <> '대기' then
    return 'not_pending';
  end if;

  if p_change_type not in ('자리 이동', '교체', '고장', '기타') then
    return 'bad_change_type';
  end if;

  -- 장비의 지금 상태를 읽어 둔다. 이력의 "바뀌기 전 값"으로 쓴다.
  select type, location, user_name into v_type, v_old_location, v_old_user
    from public.equipment where serial = p_serial for update;
  if not found then
    return 'bad_equipment';
  end if;

  -- 변동 종류별 반영 규칙: 자리 이동만 장비 표를 고친다.
  -- 교체·고장·기타는 장비 표에 고칠 칸이 없으므로 그대로 두고 이력만 남긴다.
  if p_change_type = '자리 이동' then
    if coalesce(btrim(p_new_location), '') in ('', '확인 필요') then
      return 'missing_location';
    end if;

    v_new_location := btrim(p_new_location);
    -- 사용자 칸에 이름이 있으면 사용자도 바꾸고, 없으면 기존 사용자를 그대로 둔다.
    v_new_user := case
                    when coalesce(btrim(p_user_name), '') in ('', '확인 필요') then v_old_user
                    else btrim(p_user_name)
                  end;

    update public.equipment
       set location = v_new_location, user_name = v_new_user
     where serial = p_serial;

    v_how := '자리 이동: ' || v_old_location || ' → ' || v_new_location;
    if v_new_user <> v_old_user then
      v_how := v_how || ', 사용자: ' || v_old_user || ' → ' || v_new_user;
    end if;
  else
    v_how := p_change_type || ' (장비 목록은 바뀌지 않음)';
  end if;

  -- 변경 이력을 남긴다. 신고 1건당 이력은 1건뿐이다(표의 규칙으로도 막혀 있다).
  insert into public.change_history (report_id, equipment_serial, who, what, how)
  values (p_report_id, p_serial, v_reporter, v_type || ' ' || p_serial, v_how);

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

comment on function public.approve_report is '신고 승인: 장비 표 반영, 변경 이력 기록, 상태 변경을 한 묶음으로 처리';

-- 공개 접근 막기: 서버용 열쇠(service role)를 가진 우리 서버만 이 함수를 부를 수 있다.
revoke execute on function public.approve_report(bigint, text, text, text, text) from public, anon, authenticated;
grant execute on function public.approve_report(bigint, text, text, text, text) to service_role;
