CREATE POLICY "messages_update_sender"
ON public.messages FOR UPDATE TO authenticated
USING (auth.uid() = sender_id)
WITH CHECK (auth.uid() = sender_id);