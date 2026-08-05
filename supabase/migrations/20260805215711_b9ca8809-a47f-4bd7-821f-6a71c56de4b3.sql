
-- =============== app_events ===============
CREATE TABLE public.app_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text,
  kind text NOT NULL DEFAULT 'page_view',
  name text NOT NULL,
  path text,
  duration_ms integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.app_events TO authenticated;
GRANT ALL ON public.app_events TO service_role;
ALTER TABLE public.app_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "insert own events" ON public.app_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "staff read events" ON public.app_events FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE INDEX app_events_created_idx ON public.app_events (created_at DESC);
CREATE INDEX app_events_kind_idx ON public.app_events (kind, created_at DESC);
CREATE INDEX app_events_user_idx ON public.app_events (user_id, created_at DESC);

-- =============== security_events ===============
CREATE TABLE public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  detail text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  subject text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.security_events TO authenticated;
GRANT ALL ON public.security_events TO service_role;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read security" ON public.security_events FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff update security" ON public.security_events FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE INDEX security_events_created_idx ON public.security_events (created_at DESC);

-- =============== logging function (callable by anyone, sanitized) ===============
CREATE OR REPLACE FUNCTION public.log_security_event(
  _kind text, _severity text, _title text, _detail text DEFAULT NULL,
  _subject text DEFAULT NULL, _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid; recent int;
BEGIN
  IF _severity NOT IN ('info','warning','critical') THEN _severity := 'info'; END IF;
  INSERT INTO public.security_events (kind, severity, title, detail, user_id, subject, metadata)
  VALUES (left(_kind, 60), _severity, left(_title, 200), left(coalesce(_detail,''), 1000), auth.uid(), left(coalesce(_subject,''), 200), coalesce(_metadata, '{}'::jsonb))
  RETURNING id INTO new_id;

  IF _kind = 'auth_failure' AND _subject IS NOT NULL THEN
    SELECT count(*) INTO recent FROM public.security_events
      WHERE kind = 'auth_failure' AND subject = _subject AND created_at > now() - interval '15 minutes';
    IF recent >= 5 THEN
      INSERT INTO public.security_events (kind, severity, title, detail, subject, metadata)
      VALUES ('brute_force', 'critical', 'Tentatives de connexion répétées',
              recent || ' échecs de connexion en 15 minutes sur le même compte.', _subject,
              jsonb_build_object('attempts', recent));
    END IF;
  END IF;
  RETURN new_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.log_security_event(text,text,text,text,text,jsonb) TO anon, authenticated;

-- =============== owner dashboard aggregate ===============
CREATE OR REPLACE FUNCTION public.owner_dashboard()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;

  SELECT jsonb_build_object(
    'users', jsonb_build_object(
      'total', (SELECT count(*) FROM public.profiles),
      'today', (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '1 day'),
      'week', (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '7 days'),
      'month', (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '30 days'),
      'year', (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '365 days'),
      'online', (SELECT count(DISTINCT user_id) FROM public.app_events WHERE created_at > now() - interval '5 minutes'),
      'active_24h', (SELECT count(DISTINCT user_id) FROM public.app_events WHERE created_at > now() - interval '1 day'),
      'active_7d', (SELECT count(DISTINCT user_id) FROM public.app_events WHERE created_at > now() - interval '7 days')
    ),
    'content', jsonb_build_object(
      'posts', (SELECT count(*) FROM public.posts),
      'photos', (SELECT count(*) FROM public.posts WHERE media_type = 'image'),
      'videos', (SELECT count(*) FROM public.posts WHERE media_type = 'video'),
      'stories', (SELECT count(*) FROM public.stories),
      'stories_active', (SELECT count(*) FROM public.stories WHERE expires_at > now()),
      'comments', (SELECT count(*) FROM public.post_comments) + (SELECT count(*) FROM public.news_comments) + (SELECT count(*) FROM public.story_comments),
      'likes', (SELECT count(*) FROM public.post_likes) + (SELECT count(*) FROM public.news_likes) + (SELECT count(*) FROM public.story_likes),
      'shares', (SELECT coalesce(sum(share_count),0) FROM public.posts) + (SELECT coalesce(sum(share_count),0) FROM public.news_articles),
      'views', (SELECT coalesce(sum(view_count),0) FROM public.posts) + (SELECT coalesce(sum(view_count),0) FROM public.news_articles),
      'messages', (SELECT count(*) FROM public.messages),
      'group_messages', (SELECT count(*) FROM public.group_messages),
      'groups', (SELECT count(*) FROM public.groups),
      'follows', (SELECT count(*) FROM public.follows),
      'saves', (SELECT count(*) FROM public.post_saves) + (SELECT count(*) FROM public.news_saves)
    ),
    'marketplace', jsonb_build_object(
      'products', (SELECT count(*) FROM public.products),
      'shops', (SELECT count(*) FROM public.shops),
      'new_products_7d', (SELECT count(*) FROM public.products WHERE created_at > now() - interval '7 days'),
      'avg_price', (SELECT coalesce(round(avg(price)::numeric, 0), 0) FROM public.products)
    ),
    'news', jsonb_build_object(
      'articles', (SELECT count(*) FROM public.news_articles),
      'important', (SELECT count(*) FROM public.news_articles WHERE is_important),
      'views', (SELECT coalesce(sum(view_count),0) FROM public.news_articles),
      'reposts', (SELECT coalesce(sum(repost_count),0) FROM public.news_articles),
      'new_7d', (SELECT count(*) FROM public.news_articles WHERE published_at > now() - interval '7 days')
    ),
    'moderation', jsonb_build_object(
      'reports_open', (SELECT count(*) FROM public.reports WHERE status = 'pending'),
      'reports_total', (SELECT count(*) FROM public.reports)
    ),
    'signups_daily', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'count', c.n) ORDER BY d.day), '[]'::jsonb)
      FROM generate_series((current_date - interval '29 days')::date, current_date, interval '1 day') AS d(day)
      LEFT JOIN LATERAL (SELECT count(*) AS n FROM public.profiles p WHERE p.created_at::date = d.day::date) c ON true
    ),
    'activity_daily', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'posts', p.n, 'events', e.n, 'users', e.u) ORDER BY d.day), '[]'::jsonb)
      FROM generate_series((current_date - interval '13 days')::date, current_date, interval '1 day') AS d(day)
      LEFT JOIN LATERAL (SELECT count(*) AS n FROM public.posts x WHERE x.created_at::date = d.day::date) p ON true
      LEFT JOIN LATERAL (SELECT count(*) AS n, count(DISTINCT user_id) AS u FROM public.app_events x WHERE x.created_at::date = d.day::date) e ON true
    ),
    'top_pages', (
      SELECT coalesce(jsonb_agg(t), '[]'::jsonb) FROM (
        SELECT coalesce(path, name) AS path, count(*) AS visits, count(DISTINCT user_id) AS users
        FROM public.app_events WHERE kind = 'page_view' AND created_at > now() - interval '30 days'
        GROUP BY 1 ORDER BY visits DESC LIMIT 12) t
    ),
    'features', (
      SELECT coalesce(jsonb_agg(t), '[]'::jsonb) FROM (
        SELECT name, count(*) AS uses, count(DISTINCT user_id) AS users
        FROM public.app_events WHERE kind = 'feature' AND created_at > now() - interval '30 days'
        GROUP BY 1 ORDER BY uses DESC) t
    ),
    'errors', (
      SELECT coalesce(jsonb_agg(t), '[]'::jsonb) FROM (
        SELECT name, count(*) AS occurrences, max(created_at) AS last_seen,
               (array_agg(metadata->>'message' ORDER BY created_at DESC))[1] AS message
        FROM public.app_events WHERE kind = 'error' AND created_at > now() - interval '7 days'
        GROUP BY 1 ORDER BY occurrences DESC LIMIT 15) t
    ),
    'performance', jsonb_build_object(
      'avg_load_ms', (SELECT coalesce(round(avg(duration_ms)), 0) FROM public.app_events WHERE kind = 'perf' AND created_at > now() - interval '7 days'),
      'p95_load_ms', (SELECT coalesce(round(percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms)), 0) FROM public.app_events WHERE kind = 'perf' AND created_at > now() - interval '7 days'),
      'slow_pages', (SELECT coalesce(jsonb_agg(t), '[]'::jsonb) FROM (
          SELECT coalesce(path, name) AS path, round(avg(duration_ms)) AS avg_ms, count(*) AS samples
          FROM public.app_events WHERE kind = 'perf' AND created_at > now() - interval '7 days'
          GROUP BY 1 HAVING count(*) > 2 ORDER BY avg_ms DESC LIMIT 8) t),
      'avg_session_ms', (SELECT coalesce(round(avg(duration_ms)), 0) FROM public.app_events WHERE kind = 'session' AND created_at > now() - interval '30 days'),
      'sessions_30d', (SELECT count(*) FROM public.app_events WHERE kind = 'session' AND created_at > now() - interval '30 days'),
      'errors_24h', (SELECT count(*) FROM public.app_events WHERE kind = 'error' AND created_at > now() - interval '1 day')
    ),
    'security', jsonb_build_object(
      'open_alerts', (SELECT count(*) FROM public.security_events WHERE NOT resolved),
      'critical_alerts', (SELECT count(*) FROM public.security_events WHERE NOT resolved AND severity = 'critical'),
      'auth_failures_24h', (SELECT count(*) FROM public.security_events WHERE kind = 'auth_failure' AND created_at > now() - interval '1 day'),
      'events_7d', (SELECT count(*) FROM public.security_events WHERE created_at > now() - interval '7 days')
    ),
    'generated_at', now()
  ) INTO result;
  RETURN result;
END; $$;
GRANT EXECUTE ON FUNCTION public.owner_dashboard() TO authenticated;

-- =============== resolve alert ===============
CREATE OR REPLACE FUNCTION public.resolve_security_event(_id uuid, _resolved boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  UPDATE public.security_events
    SET resolved = _resolved, resolved_at = CASE WHEN _resolved THEN now() ELSE NULL END
    WHERE id = _id;
  RETURN true;
END; $$;
GRANT EXECUTE ON FUNCTION public.resolve_security_event(uuid, boolean) TO authenticated;
