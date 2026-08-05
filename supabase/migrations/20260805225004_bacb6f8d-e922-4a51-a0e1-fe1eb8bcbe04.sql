REVOKE EXECUTE ON FUNCTION public.trending_overview(integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.search_hashtags(text, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.hashtag_posts(text, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.sync_hashtags(text, uuid, uuid, text) FROM anon, public, authenticated;
GRANT EXECUTE ON FUNCTION public.trending_overview(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_hashtags(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hashtag_posts(text, integer) TO authenticated;