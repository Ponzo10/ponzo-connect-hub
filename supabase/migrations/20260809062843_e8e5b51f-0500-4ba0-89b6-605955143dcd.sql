ALTER TABLE public.ai_findings
  ADD COLUMN IF NOT EXISTS action_key text,
  ADD COLUMN IF NOT EXISTS sensitive boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.ai_remediations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id uuid REFERENCES public.ai_findings(id) ON DELETE SET NULL,
  action_key text NOT NULL,
  authorized_by uuid REFERENCES auth.users(id),
  authorized_at timestamptz NOT NULL DEFAULT now(),
  confirmed_sensitive boolean NOT NULL DEFAULT false,
  problem text NOT NULL DEFAULT '',
  cause text NOT NULL DEFAULT '',
  applied text NOT NULL DEFAULT '',
  targets text NOT NULL DEFAULT '',
  tests jsonb NOT NULL DEFAULT '[]'::jsonb,
  outcome text NOT NULL DEFAULT 'unresolved',
  detail text NOT NULL DEFAULT '',
  recommendations text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_remediations TO authenticated;
GRANT ALL ON public.ai_remediations TO service_role;

ALTER TABLE public.ai_remediations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read remediations"
  ON public.ai_remediations FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));