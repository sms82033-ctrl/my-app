-- 관리자가 장비를 직접 고치고 지우는 기능 (PRD must 3, DESIGN.md 2.6)

-- 1) 변경 이력의 신고 번호를 비울 수 있게 한다.
--    관리자 직접 수정은 신고에서 나온 이력이 아니므로 신고 번호가 없다.
--    신고 1건당 이력 1건이라는 규칙은 그대로다(비어 있는 값끼리는 겹친 것으로 보지 않는다).
alter table public.change_history alter column report_id drop not null;

-- 2) 장비 수정: 장비 표 수정과 변경 이력 기록을 한 묶음으로 처리한다.
--    결과: ok(고침), not_found(그런 장비 없음), no_change(바뀐 칸이 없어 아무것도 하지 않음)
create function public.update_equipment(
  p_serial       text,  -- 고칠 장비 (시리얼번호 자체는 고칠 수 없다)
  p_type         text,
  p_model        text,
  p_user_name    text,
  p_location     text,
  p_purchased_on date
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_old   public.equipment%rowtype;
  v_parts text[] := '{}';  -- 바뀐 칸을 "칸 이름 이전 값 → 새 값"으로 모은다
begin
  -- 동시에 두 번 고치지 못하도록 그 줄을 잠근다.
  select * into v_old from public.equipment where serial = p_serial for update;
  if not found then
    return 'not_found';
  end if;

  if v_old.type <> p_type then
    v_parts := v_parts || ('종류 ' || v_old.type || ' → ' || p_type);
  end if;
  if v_old.model <> p_model then
    v_parts := v_parts || ('모델명 ' || v_old.model || ' → ' || p_model);
  end if;
  if v_old.user_name <> p_user_name then
    v_parts := v_parts || ('사용자 ' || v_old.user_name || ' → ' || p_user_name);
  end if;
  if v_old.location <> p_location then
    v_parts := v_parts || ('위치 ' || v_old.location || ' → ' || p_location);
  end if;
  if v_old.purchased_on <> p_purchased_on then
    v_parts := v_parts || ('구입일 ' || v_old.purchased_on::text || ' → ' || p_purchased_on::text);
  end if;

  -- 바뀐 칸이 없으면 이력을 남기지 않는다.
  if cardinality(v_parts) = 0 then
    return 'no_change';
  end if;

  update public.equipment
     set type = p_type, model = p_model, user_name = p_user_name,
         location = p_location, purchased_on = p_purchased_on
   where serial = p_serial;

  -- 누가 = 관리자, 무엇을 = 장비, 어떻게 = 바뀐 칸과 값
  insert into public.change_history (report_id, equipment_serial, who, what, how)
  values (null, p_serial, '관리자', p_type || ' ' || p_serial,
          '관리자 직접 수정: ' || array_to_string(v_parts, ', '));

  return 'ok';
end;
$$;

comment on function public.update_equipment is '관리자 직접 수정: 장비 표 수정과 변경 이력 기록을 한 묶음으로 처리';

-- 3) 장비 삭제: 신고나 변경 이력이 있는 장비는 지우지 않는다.
--    결과: ok(지움), not_found(그런 장비 없음), has_records(기록이 있어 지울 수 없음)
create function public.delete_equipment(p_serial text)
returns text
language plpgsql
set search_path = ''
as $$
begin
  perform 1 from public.equipment where serial = p_serial for update;
  if not found then
    return 'not_found';
  end if;

  -- 신고의 장비 칸이나 후보 장비에 들어 있거나, 변경 이력이 있으면 기록이 있는 것이다.
  if exists (select 1 from public.reports
              where equipment_serial = p_serial or p_serial = any (candidate_serials))
     or exists (select 1 from public.change_history where equipment_serial = p_serial) then
    return 'has_records';
  end if;

  delete from public.equipment where serial = p_serial;
  return 'ok';
end;
$$;

comment on function public.delete_equipment is '관리자 직접 삭제: 신고나 변경 이력이 없는 장비만 지운다';

-- 공개 접근 막기: 서버용 열쇠(service role)를 가진 우리 서버만 이 함수들을 부를 수 있다.
revoke execute on function public.update_equipment(text, text, text, text, text, date) from public, anon, authenticated;
grant execute on function public.update_equipment(text, text, text, text, text, date) to service_role;
revoke execute on function public.delete_equipment(text) from public, anon, authenticated;
grant execute on function public.delete_equipment(text) to service_role;
