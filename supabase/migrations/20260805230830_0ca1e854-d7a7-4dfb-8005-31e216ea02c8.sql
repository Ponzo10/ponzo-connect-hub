ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'fr',
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS show_online boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_last_seen boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS messages_recipient_delivered_idx ON public.messages (recipient_id) WHERE delivered_at IS NULL;

CREATE OR REPLACE FUNCTION public.mark_messages_delivered()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 0; END IF;
  UPDATE public.messages
    SET delivered_at = now()
    WHERE recipient_id = auth.uid() AND delivered_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END; $$;

CREATE OR REPLACE FUNCTION public.touch_presence()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  UPDATE public.profiles SET last_seen_at = now() WHERE id = auth.uid();
END; $$;

CREATE OR REPLACE FUNCTION public.presence_of(_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN jsonb_build_object('online', false, 'last_seen', NULL)
    ELSE (
      SELECT jsonb_build_object(
        'online', p.show_online AND p.last_seen_at IS NOT NULL AND p.last_seen_at > now() - interval '2 minutes',
        'last_seen', CASE WHEN p.show_last_seen THEN p.last_seen_at ELSE NULL END
      )
      FROM public.profiles p WHERE p.id = _user_id
    )
  END
$$;