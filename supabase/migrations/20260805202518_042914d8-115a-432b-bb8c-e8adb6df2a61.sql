create or replace function public.can_post_in_group(_group_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_group_member(_group_id, _user_id)
    and (
      coalesce((select who_can_send from public.groups where id = _group_id), 'all') = 'all'
      or public.is_group_admin(_group_id, _user_id)
    )
$$;

drop policy if exists "members send messages" on public.group_messages;
create policy "members send messages" on public.group_messages for insert to authenticated
  with check (sender_id = auth.uid() and public.can_post_in_group(group_id, auth.uid()));