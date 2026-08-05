create table public.groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  photo_url text,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text,
  media_url text,
  media_type text,
  created_at timestamptz not null default now()
);

create index group_messages_group_created_idx on public.group_messages (group_id, created_at desc);
create index group_members_user_idx on public.group_members (user_id);

grant select, insert, update, delete on public.groups to authenticated;
grant all on public.groups to service_role;
grant select, insert, update, delete on public.group_members to authenticated;
grant all on public.group_members to service_role;
grant select, insert, delete on public.group_messages to authenticated;
grant all on public.group_messages to service_role;

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_messages enable row level security;

create or replace function public.is_group_member(_group_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.group_members where group_id = _group_id and user_id = _user_id)
$$;

create or replace function public.is_group_admin(_group_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.group_members where group_id = _group_id and user_id = _user_id and role in ('owner','admin'))
$$;

create or replace function public.is_group_public(_group_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_public from public.groups where id = _group_id), false)
$$;

create policy "groups_select" on public.groups for select to authenticated
  using (is_public or public.is_group_member(id, auth.uid()));
create policy "groups_insert" on public.groups for insert to authenticated
  with check (owner_id = auth.uid());
create policy "groups_update" on public.groups for update to authenticated
  using (owner_id = auth.uid() or public.is_group_admin(id, auth.uid()))
  with check (owner_id = auth.uid() or public.is_group_admin(id, auth.uid()));
create policy "groups_delete" on public.groups for delete to authenticated
  using (owner_id = auth.uid());

create policy "group_members_select" on public.group_members for select to authenticated
  using (public.is_group_public(group_id) or public.is_group_member(group_id, auth.uid()));
create policy "group_members_insert" on public.group_members for insert to authenticated
  with check (
    (user_id = auth.uid() and (public.is_group_public(group_id) or exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid())))
    or public.is_group_admin(group_id, auth.uid())
  );
create policy "group_members_update" on public.group_members for update to authenticated
  using (public.is_group_admin(group_id, auth.uid()))
  with check (public.is_group_admin(group_id, auth.uid()));
create policy "group_members_delete" on public.group_members for delete to authenticated
  using (user_id = auth.uid() or public.is_group_admin(group_id, auth.uid()));

create policy "group_messages_select" on public.group_messages for select to authenticated
  using (public.is_group_member(group_id, auth.uid()));
create policy "group_messages_insert" on public.group_messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_group_member(group_id, auth.uid()));
create policy "group_messages_delete" on public.group_messages for delete to authenticated
  using (sender_id = auth.uid() or public.is_group_admin(group_id, auth.uid()));

create trigger groups_set_updated_at before update on public.groups
  for each row execute function public.update_updated_at_column();

alter publication supabase_realtime add table public.group_messages;
alter publication supabase_realtime add table public.group_members;