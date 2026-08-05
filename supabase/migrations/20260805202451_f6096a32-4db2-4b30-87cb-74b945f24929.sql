-- groups: rules + permissions
alter table public.groups
  add column if not exists rules text,
  add column if not exists who_can_send text not null default 'all',
  add column if not exists who_can_edit_info text not null default 'admins',
  add column if not exists who_can_invite text not null default 'all';

-- members: mute + presence
alter table public.group_members
  add column if not exists notifications_muted boolean not null default false,
  add column if not exists last_seen_at timestamptz not null default now();

-- messages: rich features
alter table public.group_messages
  add column if not exists reply_to_id uuid references public.group_messages(id) on delete set null,
  add column if not exists mentions uuid[] not null default '{}',
  add column if not exists pinned boolean not null default false,
  add column if not exists is_announcement boolean not null default false,
  add column if not exists forwarded boolean not null default false,
  add column if not exists deleted_at timestamptz;

create index if not exists group_messages_group_created_idx on public.group_messages(group_id, created_at desc);

-- reactions
create table if not exists public.group_message_reactions (
  message_id uuid not null references public.group_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null default '❤️',
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);
grant select, insert, delete on public.group_message_reactions to authenticated;
grant all on public.group_message_reactions to service_role;
alter table public.group_message_reactions enable row level security;
create policy "members read reactions" on public.group_message_reactions for select to authenticated
  using (exists (select 1 from public.group_messages m where m.id = message_id and public.is_group_member(m.group_id, auth.uid())));
create policy "members react" on public.group_message_reactions for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.group_messages m where m.id = message_id and public.is_group_member(m.group_id, auth.uid())));
create policy "members unreact" on public.group_message_reactions for delete to authenticated
  using (user_id = auth.uid());

-- join requests
create table if not exists public.group_join_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique (group_id, user_id)
);
grant select, insert, update, delete on public.group_join_requests to authenticated;
grant all on public.group_join_requests to service_role;
alter table public.group_join_requests enable row level security;
create policy "see own or admin requests" on public.group_join_requests for select to authenticated
  using (user_id = auth.uid() or public.is_group_admin(group_id, auth.uid()));
create policy "request to join" on public.group_join_requests for insert to authenticated
  with check (user_id = auth.uid());
create policy "admins moderate requests" on public.group_join_requests for update to authenticated
  using (public.is_group_admin(group_id, auth.uid()));
create policy "cancel request" on public.group_join_requests for delete to authenticated
  using (user_id = auth.uid() or public.is_group_admin(group_id, auth.uid()));

-- admins may add members (invite / accept), and remove members
drop policy if exists "admins manage members" on public.group_members;
create policy "admins manage members" on public.group_members for insert to authenticated
  with check (public.is_group_admin(group_id, auth.uid()));
drop policy if exists "admins remove members" on public.group_members;
create policy "admins remove members" on public.group_members for delete to authenticated
  using (public.is_group_admin(group_id, auth.uid()) or user_id = auth.uid());
drop policy if exists "members update own row" on public.group_members;
create policy "members update own row" on public.group_members for update to authenticated
  using (user_id = auth.uid() or public.is_group_admin(group_id, auth.uid()))
  with check (user_id = auth.uid() or public.is_group_admin(group_id, auth.uid()));

-- allow message updates (pin, edit, delete-for-all)
drop policy if exists "author or admin updates message" on public.group_messages;
create policy "author or admin updates message" on public.group_messages for update to authenticated
  using (sender_id = auth.uid() or public.is_group_admin(group_id, auth.uid()))
  with check (sender_id = auth.uid() or public.is_group_admin(group_id, auth.uid()));

alter publication supabase_realtime add table public.group_message_reactions;
alter publication supabase_realtime add table public.group_join_requests;