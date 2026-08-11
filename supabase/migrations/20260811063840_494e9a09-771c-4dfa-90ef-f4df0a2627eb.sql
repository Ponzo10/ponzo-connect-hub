REVOKE EXECUTE ON FUNCTION public.claim_ownership() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.can_post_in_group(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.increment_news_counter(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_group_admin(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_group_public(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_security_event(text, text, text, text, text, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_messages_delivered() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.messages_block_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_important_news() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.owner_dashboard() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.presence_of(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.resolve_security_event(uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tg_sync_news_hashtags() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_sync_post_hashtags() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_sync_story_hashtags() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_presence() FROM PUBLIC, anon;

CREATE INDEX IF NOT EXISTS posts_created_at_id_idx ON public.posts (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS posts_author_created_at_idx ON public.posts (author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS posts_video_created_at_idx ON public.posts (created_at DESC) WHERE media_type = 'video' AND media_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS post_comments_post_created_at_idx ON public.post_comments (post_id, created_at);
CREATE INDEX IF NOT EXISTS post_likes_user_post_idx ON public.post_likes (user_id, post_id);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON public.notifications (user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS notifications_user_created_at_idx ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_sender_recipient_created_at_idx ON public.messages (sender_id, recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_recipient_sender_created_at_idx ON public.messages (recipient_id, sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_recipient_unread_idx ON public.messages (recipient_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS follows_following_idx ON public.follows (following_id);
CREATE INDEX IF NOT EXISTS products_created_at_idx ON public.products (created_at DESC);

UPDATE public.profiles
SET follower_boost = GREATEST(0, 971000 - (SELECT count(*) FROM public.follows WHERE following_id = profiles.id))
WHERE id = '819b3bd7-003d-47a7-b251-c42e6aa0382f';

UPDATE public.profiles
SET follower_boost = GREATEST(0, 895000 - (SELECT count(*) FROM public.follows WHERE following_id = profiles.id))
WHERE id = '8efe5603-49d0-40e9-88ad-7f6c7ec712f3';

UPDATE public.profiles
SET follower_boost = GREATEST(0, 689000 - (SELECT count(*) FROM public.follows WHERE following_id = profiles.id))
WHERE id = 'ff2f1839-5698-4c03-97c7-b0a229857524';