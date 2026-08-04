-- ---------- STORIES ----------
CREATE TABLE public.stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_url text NOT NULL,
  media_type text NOT NULL DEFAULT 'image',
  caption text,
  allow_share boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);
ALTER TABLE public.stories ADD CONSTRAINT stories_author_profile_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
CREATE INDEX stories_expires_idx ON public.stories (expires_at DESC);
CREATE INDEX stories_author_idx ON public.stories (author_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stories TO authenticated;
GRANT ALL ON public.stories TO service_role;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY stories_read_active ON public.stories FOR SELECT TO authenticated USING (expires_at > now());
CREATE POLICY stories_insert_own ON public.stories FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY stories_update_own ON public.stories FOR UPDATE TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
CREATE POLICY stories_delete_own ON public.stories FOR DELETE TO authenticated USING (auth.uid() = author_id OR public.is_staff(auth.uid()));

-- ---------- VUES ----------
CREATE TABLE public.story_views (
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, viewer_id)
);
ALTER TABLE public.story_views ADD CONSTRAINT story_views_viewer_profile_fkey FOREIGN KEY (viewer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

GRANT SELECT, INSERT ON public.story_views TO authenticated;
GRANT ALL ON public.story_views TO service_role;
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY story_views_read_owner ON public.story_views FOR SELECT TO authenticated
  USING (auth.uid() = viewer_id OR EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.author_id = auth.uid()));
CREATE POLICY story_views_insert_own ON public.story_views FOR INSERT TO authenticated WITH CHECK (auth.uid() = viewer_id);

-- ---------- LIKES ----------
CREATE TABLE public.story_likes (
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.story_likes TO authenticated;
GRANT ALL ON public.story_likes TO service_role;
ALTER TABLE public.story_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY story_likes_read ON public.story_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY story_likes_insert_own ON public.story_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY story_likes_delete_own ON public.story_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ---------- COMMENTAIRES ----------
CREATE TABLE public.story_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.story_comments(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.story_comments ADD CONSTRAINT story_comments_author_profile_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
CREATE INDEX story_comments_story_idx ON public.story_comments (story_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.story_comments TO authenticated;
GRANT ALL ON public.story_comments TO service_role;
ALTER TABLE public.story_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY story_comments_read ON public.story_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY story_comments_insert_own ON public.story_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY story_comments_update_own ON public.story_comments FOR UPDATE TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
CREATE POLICY story_comments_delete_own ON public.story_comments FOR DELETE TO authenticated USING (auth.uid() = author_id OR public.is_staff(auth.uid()));

CREATE TRIGGER story_comments_set_updated_at BEFORE UPDATE ON public.story_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- VUES DES PUBLICATIONS ----------
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.increment_view(_post_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare c integer;
begin
  if auth.uid() is null then raise exception 'not authorized'; end if;
  update public.posts set view_count = view_count + 1 where id = _post_id returning view_count into c;
  return coalesce(c, 0);
end; $$;

-- ---------- REALTIME ----------
ALTER PUBLICATION supabase_realtime ADD TABLE public.stories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.story_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.story_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.story_views;