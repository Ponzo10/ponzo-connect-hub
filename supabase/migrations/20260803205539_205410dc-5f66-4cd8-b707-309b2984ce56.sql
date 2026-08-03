create or replace function public.increment_share(_post_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare c integer;
begin
  if auth.uid() is null then raise exception 'not authorized'; end if;
  update public.posts set share_count = share_count + 1 where id = _post_id returning share_count into c;
  return coalesce(c, 0);
end; $$;
revoke all on function public.increment_share(uuid) from public, anon;
grant execute on function public.increment_share(uuid) to authenticated;