CREATE TABLE public.news_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text,
  content text,
  image_url text,
  source text not null default 'PONZO',
  source_url text unique,
  category text not null default 'Général',
  country text,
  published_at timestamptz not null default now(),
  relevance integer not null default 0,
  is_important boolean not null default false,
  view_count integer not null default 0,
  share_count integer not null default 0,
  repost_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT ON public.news_articles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.news_articles TO authenticated;
GRANT ALL ON public.news_articles TO service_role;
ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "news readable by all" ON public.news_articles FOR SELECT USING (true);
CREATE POLICY "staff manage news" ON public.news_articles FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE INDEX news_articles_published_idx ON public.news_articles (published_at DESC);
CREATE INDEX news_articles_category_idx ON public.news_articles (category);
CREATE TRIGGER news_articles_set_updated_at BEFORE UPDATE ON public.news_articles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.news_likes (
  article_id uuid not null references public.news_articles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (article_id, user_id)
);
GRANT SELECT ON public.news_likes TO anon;
GRANT SELECT, INSERT, DELETE ON public.news_likes TO authenticated;
GRANT ALL ON public.news_likes TO service_role;
ALTER TABLE public.news_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "news likes readable" ON public.news_likes FOR SELECT USING (true);
CREATE POLICY "own news like insert" ON public.news_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own news like delete" ON public.news_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.news_saves (
  article_id uuid not null references public.news_articles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (article_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.news_saves TO authenticated;
GRANT ALL ON public.news_saves TO service_role;
ALTER TABLE public.news_saves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own news saves" ON public.news_saves FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own news save insert" ON public.news_saves FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own news save delete" ON public.news_saves FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.news_comments (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.news_articles(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.news_comments(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT ON public.news_comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.news_comments TO authenticated;
GRANT ALL ON public.news_comments TO service_role;
ALTER TABLE public.news_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "news comments readable" ON public.news_comments FOR SELECT USING (true);
CREATE POLICY "own news comment insert" ON public.news_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "own news comment update" ON public.news_comments FOR UPDATE TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
CREATE POLICY "own news comment delete" ON public.news_comments FOR DELETE TO authenticated USING (auth.uid() = author_id OR public.is_staff(auth.uid()));
CREATE INDEX news_comments_article_idx ON public.news_comments (article_id, created_at);
CREATE TRIGGER news_comments_set_updated_at BEFORE UPDATE ON public.news_comments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.increment_news_counter(_article_id uuid, _field text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare c integer;
begin
  if _field = 'view' then
    update public.news_articles set view_count = view_count + 1 where id = _article_id returning view_count into c;
  elsif _field = 'share' then
    update public.news_articles set share_count = share_count + 1 where id = _article_id returning share_count into c;
  elsif _field = 'repost' then
    update public.news_articles set repost_count = repost_count + 1 where id = _article_id returning repost_count into c;
  else
    raise exception 'invalid field';
  end if;
  return coalesce(c, 0);
end; $$;

CREATE OR REPLACE FUNCTION public.notify_important_news()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if new.is_important then
    insert into public.notifications (user_id, kind, body, entity_id)
    select p.id, 'news', left(new.title, 180), new.id from public.profiles p;
  end if;
  return new;
end; $$;
CREATE TRIGGER news_articles_notify AFTER INSERT ON public.news_articles FOR EACH ROW EXECUTE FUNCTION public.notify_important_news();

ALTER PUBLICATION supabase_realtime ADD TABLE public.news_articles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.news_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.news_comments;