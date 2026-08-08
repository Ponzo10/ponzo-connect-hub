CREATE TABLE public.recovery_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX recovery_codes_user_idx ON public.recovery_codes(user_id);
CREATE UNIQUE INDEX recovery_codes_hash_idx ON public.recovery_codes(code_hash);
GRANT SELECT ON public.recovery_codes TO authenticated;
GRANT ALL ON public.recovery_codes TO service_role;
ALTER TABLE public.recovery_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own recovery codes" ON public.recovery_codes FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.ai_scans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  trigger text NOT NULL DEFAULT 'manual',
  model text,
  summary text NOT NULL DEFAULT '',
  health_score integer NOT NULL DEFAULT 100,
  findings_count integer NOT NULL DEFAULT 0,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_scans_created_idx ON public.ai_scans(created_at DESC);
GRANT SELECT ON public.ai_scans TO authenticated;
GRANT ALL ON public.ai_scans TO service_role;
ALTER TABLE public.ai_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read scans" ON public.ai_scans FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE TABLE public.ai_findings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_id uuid REFERENCES public.ai_scans(id) ON DELETE CASCADE,
  area text NOT NULL DEFAULT 'general',
  title text NOT NULL,
  cause text NOT NULL DEFAULT '',
  impact text NOT NULL DEFAULT '',
  priority text NOT NULL DEFAULT 'medium',
  recommendation text NOT NULL DEFAULT '',
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'new',
  authorized_at timestamptz,
  authorized_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_findings_status_idx ON public.ai_findings(status, created_at DESC);
GRANT SELECT, UPDATE ON public.ai_findings TO authenticated;
GRANT ALL ON public.ai_findings TO service_role;
ALTER TABLE public.ai_findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read findings" ON public.ai_findings FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff update findings" ON public.ai_findings FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER ai_findings_set_updated_at BEFORE UPDATE ON public.ai_findings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();