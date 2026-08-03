create or replace function public.claim_ownership()
returns boolean language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return false; end if;
  if exists (select 1 from public.user_roles where role = 'owner') then return false; end if;
  insert into public.user_roles (user_id, role) values (uid, 'owner'), (uid, 'admin')
    on conflict do nothing;
  update public.profiles
    set verified = true, badge = 'crown', title = 'Propriétaire de PONZO', follower_boost = 10000000
    where id = uid;
  insert into public.activity_log (user_id, action, entity_type, entity_id)
    values (uid, 'claim_ownership', 'user', uid);
  return true;
end; $$;
revoke all on function public.claim_ownership() from public, anon;
grant execute on function public.claim_ownership() to authenticated;

create or replace function public.set_user_role(_user_id uuid, _role app_role, _grant boolean)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not (public.has_role(auth.uid(), 'owner') or public.has_role(auth.uid(), 'admin')) then
    raise exception 'not authorized';
  end if;
  if _role = 'owner' and not public.has_role(auth.uid(), 'owner') then
    raise exception 'not authorized';
  end if;
  if _grant then
    insert into public.user_roles (user_id, role) values (_user_id, _role) on conflict do nothing;
  else
    delete from public.user_roles where user_id = _user_id and role = _role;
  end if;
  insert into public.activity_log (user_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), case when _grant then 'grant_role' else 'revoke_role' end, 'user', _user_id, jsonb_build_object('role', _role));
  return true;
end; $$;
revoke all on function public.set_user_role(uuid, app_role, boolean) from public, anon;
grant execute on function public.set_user_role(uuid, app_role, boolean) to authenticated;