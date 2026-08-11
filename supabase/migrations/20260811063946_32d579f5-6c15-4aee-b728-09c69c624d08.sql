REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_hashtags(text, uuid, uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.messages_block_guard() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_important_news() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_sync_news_hashtags() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_sync_post_hashtags() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_sync_story_hashtags() FROM authenticated;