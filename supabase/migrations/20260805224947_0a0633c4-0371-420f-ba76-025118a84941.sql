-- Hashtags
CREATE TABLE public.hashtags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag text NOT NULL UNIQUE,
  usage_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.hashtags TO authenticated;
GRANT ALL ON public.hashtags TO service_role;
ALTER TABLE public.hashtags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hashtags visibles" ON public.hashtags FOR SELECT TO authenticated USING (true);

CREATE TABLE public.content_hashtags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hashtag_id uuid NOT NULL REFERENCES public.hashtags(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  author_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hashtag_id, entity_type, entity_id)
);
GRANT SELECT ON public.content_hashtags TO authenticated;
GRANT ALL ON public.content_hashtags TO service_role;
ALTER TABLE public.content_hashtags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Liens hashtags visibles" ON public.content_hashtags FOR SELECT TO authenticated USING (true);

CREATE INDEX idx_content_hashtags_tag ON public.content_hashtags(hashtag_id, created_at DESC);
CREATE INDEX idx_content_hashtags_entity ON public.content_hashtags(entity_type, entity_id);
CREATE INDEX idx_hashtags_usage ON public.hashtags(usage_count DESC);

CREATE TRIGGER hashtags_set_updated_at BEFORE UPDATE ON public.hashtags
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Réglage de confidentialité vidéo
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS allow_video_download boolean NOT NULL DEFAULT true;

-- Extraction + synchronisation des hashtags
CREATE OR REPLACE FUNCTION public.sync_hashtags(_entity_type text, _entity_id uuid, _author_id uuid, _text text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  tags text[];
  t text;
  hid uuid;
  keep uuid[] := '{}';
BEGIN
  SELECT coalesce(array_agg(DISTINCT lower(m[1])), '{}')
    INTO tags
    FROM regexp_matches(coalesce(_text, ''), '#([A-Za-z0-9_À-ÿ]{2,50})', 'g') AS m;

  FOREACH t IN ARRAY tags LOOP
    INSERT INTO public.hashtags (tag) VALUES (t)
      ON CONFLICT (tag) DO UPDATE SET tag = excluded.tag
      RETURNING id INTO hid;
    keep := keep || hid;
    INSERT INTO public.content_hashtags (hashtag_id, entity_type, entity_id, author_id)
      VALUES (hid, _entity_type, _entity_id, _author_id)
      ON CONFLICT (hashtag_id, entity_type, entity_id) DO NOTHING;
  END LOOP;

  DELETE FROM public.content_hashtags
    WHERE entity_type = _entity_type AND entity_id = _entity_id
      AND NOT (hashtag_id = ANY (keep));

  UPDATE public.hashtags h
    SET usage_count = (SELECT count(*) FROM public.content_hashtags c WHERE c.hashtag_id = h.id)
    WHERE h.id = ANY (keep) OR h.usage_count <> (SELECT count(*) FROM public.content_hashtags c WHERE c.hashtag_id = h.id);
END; $$;

CREATE OR REPLACE FUNCTION public.tg_sync_post_hashtags()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.sync_hashtags('post', NEW.id, NEW.author_id, NEW.body);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.tg_sync_story_hashtags()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.sync_hashtags('story', NEW.id, NEW.author_id, NEW.caption);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.tg_sync_news_hashtags()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.sync_hashtags('news', NEW.id, NULL, coalesce(NEW.title,'') || ' ' || coalesce(NEW.summary,'') || ' ' || coalesce(NEW.content,''));
  RETURN NEW;
END; $$;

CREATE TRIGGER posts_sync_hashtags AFTER INSERT OR UPDATE OF body ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.tg_sync_post_hashtags();
CREATE TRIGGER stories_sync_hashtags AFTER INSERT OR UPDATE OF caption ON public.stories
FOR EACH ROW EXECUTE FUNCTION public.tg_sync_story_hashtags();
CREATE TRIGGER news_sync_hashtags AFTER INSERT OR UPDATE OF title, summary, content ON public.news_articles
FOR EACH ROW EXECUTE FUNCTION public.tg_sync_news_hashtags();

-- Backfill du contenu existant
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id, author_id, body FROM public.posts LOOP
    PERFORM public.sync_hashtags('post', r.id, r.author_id, r.body);
  END LOOP;
  FOR r IN SELECT id, author_id, caption FROM public.stories LOOP
    PERFORM public.sync_hashtags('story', r.id, r.author_id, r.caption);
  END LOOP;
  FOR r IN SELECT id, title, summary, content FROM public.news_articles LOOP
    PERFORM public.sync_hashtags('news', r.id, NULL, coalesce(r.title,'') || ' ' || coalesce(r.summary,'') || ' ' || coalesce(r.content,''));
  END LOOP;
END $$;

-- Recherche de hashtags
CREATE OR REPLACE FUNCTION public.search_hashtags(_term text DEFAULT '', _limit integer DEFAULT 30)
RETURNS TABLE (id uuid, tag text, usage_count integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT h.id, h.tag, h.usage_count
  FROM public.hashtags h
  WHERE auth.uid() IS NOT NULL
    AND (coalesce(_term,'') = '' OR h.tag ILIKE '%' || replace(coalesce(_term,''), '#', '') || '%')
  ORDER BY h.usage_count DESC, h.tag ASC
  LIMIT least(coalesce(_limit, 30), 100)
$$;

-- Tendances
CREATE OR REPLACE FUNCTION public.trending_overview(_limit integer DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE result jsonb; lim integer := least(coalesce(_limit, 10), 30);
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authorized'; END IF;

  WITH post_stats AS (
    SELECT p.id, p.body, p.media_url, p.media_type, p.author_id, p.created_at,
           p.view_count, p.share_count,
           (SELECT count(*) FROM public.post_likes l WHERE l.post_id = p.id) AS like_count,
           (SELECT count(*) FROM public.post_comments c WHERE c.post_id = p.id) AS comment_count,
           (SELECT count(*) FROM public.post_saves s WHERE s.post_id = p.id) AS save_count
    FROM public.posts p
    WHERE p.created_at > now() - interval '90 days'
  ), scored AS (
    SELECT s.*, (s.view_count + s.like_count * 3 + s.comment_count * 4 + s.share_count * 5 + s.save_count * 4) AS score
    FROM post_stats s
  )
  SELECT jsonb_build_object(
    'hashtags', (
      SELECT coalesce(jsonb_agg(t), '[]'::jsonb) FROM (
        SELECT h.id, h.tag, h.usage_count,
               (SELECT count(*) FROM public.content_hashtags c WHERE c.hashtag_id = h.id AND c.created_at > now() - interval '7 days') AS recent_count
        FROM public.hashtags h
        ORDER BY (SELECT count(*) FROM public.content_hashtags c WHERE c.hashtag_id = h.id AND c.created_at > now() - interval '7 days') DESC,
                 h.usage_count DESC LIMIT lim) t
    ),
    'videos', (
      SELECT coalesce(jsonb_agg(t), '[]'::jsonb) FROM (
        SELECT s.id, s.body, s.media_url, s.media_type, s.created_at, s.score,
               s.view_count, s.like_count, s.comment_count, s.share_count, s.save_count,
               pr.full_name AS author_name, pr.avatar_url AS author_avatar, pr.id AS author_id,
               coalesce(pr.allow_video_download, true) AS allow_download
        FROM scored s LEFT JOIN public.profiles pr ON pr.id = s.author_id
        WHERE s.media_type = 'video' AND s.media_url IS NOT NULL
        ORDER BY s.score DESC, s.created_at DESC LIMIT lim) t
    ),
    'posts', (
      SELECT coalesce(jsonb_agg(t), '[]'::jsonb) FROM (
        SELECT s.id, s.body, s.media_url, s.media_type, s.created_at, s.score,
               s.view_count, s.like_count, s.comment_count, s.share_count, s.save_count,
               pr.full_name AS author_name, pr.avatar_url AS author_avatar, pr.id AS author_id
        FROM scored s LEFT JOIN public.profiles pr ON pr.id = s.author_id
        ORDER BY s.score DESC, s.created_at DESC LIMIT lim) t
    ),
    'products', (
      SELECT coalesce(jsonb_agg(t), '[]'::jsonb) FROM (
        SELECT pd.id, pd.title, pd.price, pd.currency, pd.image_url, pd.city, pd.shop_id,
               pr.full_name AS seller_name
        FROM public.products pd LEFT JOIN public.profiles pr ON pr.id = pd.seller_id
        ORDER BY pd.created_at DESC LIMIT lim) t
    ),
    'shops', (
      SELECT coalesce(jsonb_agg(t), '[]'::jsonb) FROM (
        SELECT sh.id, sh.name, sh.logo_url, sh.city,
               (SELECT count(*) FROM public.products p2 WHERE p2.shop_id = sh.id) AS product_count
        FROM public.shops sh
        ORDER BY (SELECT count(*) FROM public.products p2 WHERE p2.shop_id = sh.id) DESC, sh.created_at DESC
        LIMIT lim) t
    ),
    'creators', (
      SELECT coalesce(jsonb_agg(t), '[]'::jsonb) FROM (
        SELECT pr.id, pr.full_name, pr.handle, pr.avatar_url, pr.verified, pr.badge, pr.role,
               (SELECT count(*) FROM public.follows f WHERE f.following_id = pr.id) AS followers,
               (SELECT count(*) FROM public.follows f WHERE f.following_id = pr.id AND f.created_at > now() - interval '7 days') AS new_followers,
               coalesce((SELECT sum(sc.score) FROM scored sc WHERE sc.author_id = pr.id), 0) AS engagement
        FROM public.profiles pr
        ORDER BY coalesce((SELECT sum(sc.score) FROM scored sc WHERE sc.author_id = pr.id), 0) DESC,
                 (SELECT count(*) FROM public.follows f WHERE f.following_id = pr.id) DESC
        LIMIT lim) t
    ),
    'generated_at', now()
  ) INTO result;
  RETURN result;
END; $$;

-- Publications par hashtag
CREATE OR REPLACE FUNCTION public.hashtag_posts(_tag text, _limit integer DEFAULT 50)
RETURNS SETOF public.posts
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT p.* FROM public.posts p
  JOIN public.content_hashtags c ON c.entity_id = p.id AND c.entity_type = 'post'
  JOIN public.hashtags h ON h.id = c.hashtag_id
  WHERE auth.uid() IS NOT NULL AND h.tag = lower(replace(coalesce(_tag,''), '#', ''))
  ORDER BY p.created_at DESC
  LIMIT least(coalesce(_limit, 50), 100)
$$;