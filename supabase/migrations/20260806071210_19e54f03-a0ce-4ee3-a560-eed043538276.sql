-- 1) Colonnes messages
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS forwarded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_for uuid[] NOT NULL DEFAULT '{}';

-- 2) Réactions
CREATE TABLE IF NOT EXISTS public.message_reactions (
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);
GRANT SELECT, INSERT, DELETE ON public.message_reactions TO authenticated;
GRANT ALL ON public.message_reactions TO service_role;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view message reactions"
ON public.message_reactions FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.messages m
  WHERE m.id = message_id AND (m.sender_id = auth.uid() OR m.recipient_id = auth.uid())
));

CREATE POLICY "Participants can react"
ON public.message_reactions FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND EXISTS (
  SELECT 1 FROM public.messages m
  WHERE m.id = message_id AND (m.sender_id = auth.uid() OR m.recipient_id = auth.uid())
));

CREATE POLICY "Users can remove their own reactions"
ON public.message_reactions FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- 3) Réglages de conversation (épinglé / archivé)
CREATE TABLE IF NOT EXISTS public.conversation_settings (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  peer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pinned boolean NOT NULL DEFAULT false,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, peer_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_settings TO authenticated;
GRANT ALL ON public.conversation_settings TO service_role;
ALTER TABLE public.conversation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own conversation settings"
ON public.conversation_settings FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER conversation_settings_set_updated_at
BEFORE UPDATE ON public.conversation_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Blocages
CREATE TABLE IF NOT EXISTS public.blocked_users (
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);
GRANT SELECT, INSERT, DELETE ON public.blocked_users TO authenticated;
GRANT ALL ON public.blocked_users TO service_role;
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view blocks involving them"
ON public.blocked_users FOR SELECT TO authenticated
USING (blocker_id = auth.uid() OR blocked_id = auth.uid());

CREATE POLICY "Users can block others"
ON public.blocked_users FOR INSERT TO authenticated
WITH CHECK (blocker_id = auth.uid() AND blocked_id <> auth.uid());

CREATE POLICY "Users can unblock"
ON public.blocked_users FOR DELETE TO authenticated
USING (blocker_id = auth.uid());

-- 5) Empêcher l'envoi vers/depuis un membre bloqué
CREATE OR REPLACE FUNCTION public.messages_block_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.blocked_users b
    WHERE (b.blocker_id = NEW.recipient_id AND b.blocked_id = NEW.sender_id)
       OR (b.blocker_id = NEW.sender_id AND b.blocked_id = NEW.recipient_id)
  ) THEN
    RAISE EXCEPTION 'conversation blocked';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS messages_block_guard ON public.messages;
CREATE TRIGGER messages_block_guard
BEFORE INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.messages_block_guard();

-- 6) Temps réel
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;