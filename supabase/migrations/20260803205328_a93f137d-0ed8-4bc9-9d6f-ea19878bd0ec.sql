-- ROLES
create type public.app_role as enum ('owner','admin','moderator','user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role in ('owner','admin','moderator'))
$$;

create policy user_roles_read_own on public.user_roles for select to authenticated
  using (auth.uid() = user_id or public.is_staff(auth.uid()));

-- PROFILES additions
alter table public.profiles
  add column if not exists badge text not null default 'none',
  add column if not exists phone text,
  add column if not exists follower_boost integer not null default 0,
  add column if not exists title text;

-- POSTS additions
alter table public.posts
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists share_count integer not null default 0;

create or replace function public.update_updated_at_column()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

create trigger posts_set_updated_at before update on public.posts
for each row execute function public.update_updated_at_column();

-- staff moderation on posts
create policy posts_staff_delete on public.posts for delete to authenticated
  using (public.is_staff(auth.uid()));

-- SAVED POSTS
create table public.post_saves (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
grant select, insert, delete on public.post_saves to authenticated;
grant all on public.post_saves to service_role;
alter table public.post_saves enable row level security;
create policy saves_read_own on public.post_saves for select to authenticated using (auth.uid() = user_id);
create policy saves_insert_own on public.post_saves for insert to authenticated with check (auth.uid() = user_id);
create policy saves_delete_own on public.post_saves for delete to authenticated using (auth.uid() = user_id);

-- COMMENTS: replies + edit
alter table public.post_comments
  add column if not exists parent_id uuid references public.post_comments(id) on delete cascade,
  add column if not exists updated_at timestamptz not null default now();

create trigger comments_set_updated_at before update on public.post_comments
for each row execute function public.update_updated_at_column();

create policy comments_update_own on public.post_comments for update to authenticated
  using (auth.uid() = author_id) with check (auth.uid() = author_id);
create policy comments_staff_delete on public.post_comments for delete to authenticated
  using (public.is_staff(auth.uid()));

-- MESSAGES: media
alter table public.messages
  add column if not exists media_url text,
  add column if not exists media_type text;

-- SHOPS
create table public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  logo_url text,
  cover_url text,
  phone text,
  address text,
  city text,
  latitude double precision,
  longitude double precision,
  hours text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.shops to anon;
grant select, insert, update, delete on public.shops to authenticated;
grant all on public.shops to service_role;
alter table public.shops enable row level security;
create policy shops_public_read on public.shops for select using (true);
create policy shops_insert_own on public.shops for insert to authenticated with check (auth.uid() = owner_id);
create policy shops_update_own on public.shops for update to authenticated
  using (auth.uid() = owner_id or public.is_staff(auth.uid())) with check (auth.uid() = owner_id or public.is_staff(auth.uid()));
create policy shops_delete_own on public.shops for delete to authenticated
  using (auth.uid() = owner_id or public.is_staff(auth.uid()));
create trigger shops_set_updated_at before update on public.shops
for each row execute function public.update_updated_at_column();

alter table public.products
  add column if not exists shop_id uuid references public.shops(id) on delete set null,
  add column if not exists stock integer;
create policy products_staff_delete on public.products for delete to authenticated
  using (public.is_staff(auth.uid()));

-- REPORTS
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  reason text not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.reports to authenticated;
grant all on public.reports to service_role;
alter table public.reports enable row level security;
create policy reports_insert_own on public.reports for insert to authenticated with check (auth.uid() = reporter_id);
create policy reports_read_own_or_staff on public.reports for select to authenticated
  using (auth.uid() = reporter_id or public.is_staff(auth.uid()));
create policy reports_update_staff on public.reports for update to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create trigger reports_set_updated_at before update on public.reports
for each row execute function public.update_updated_at_column();

-- ACTIVITY LOG
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);
grant insert on public.activity_log to authenticated;
grant select on public.activity_log to authenticated;
grant all on public.activity_log to service_role;
alter table public.activity_log enable row level security;
create policy activity_insert_self on public.activity_log for insert to authenticated with check (auth.uid() = user_id);
create policy activity_read_staff on public.activity_log for select to authenticated using (public.is_staff(auth.uid()));

-- ADMIN global notifications + profile moderation
create policy notifications_insert_staff on public.notifications for insert to authenticated
  with check (public.is_staff(auth.uid()));
create policy profiles_update_staff on public.profiles for update to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- REALTIME
alter table public.messages replica identity full;
alter table public.notifications replica identity full;
alter table public.posts replica identity full;
alter table public.post_likes replica identity full;
alter table public.post_comments replica identity full;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.posts;
alter publication supabase_realtime add table public.post_likes;
alter publication supabase_realtime add table public.post_comments;