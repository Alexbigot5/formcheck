-- Email templates table for follow-up emails per lead segment
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  segment text NOT NULL CHECK (segment IN ('high','medium','low')),
  subject text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_email_templates_profiles FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- Uniqueness per user & segment
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'uq_email_templates_user_segment'
  ) THEN
    CREATE UNIQUE INDEX uq_email_templates_user_segment ON public.email_templates(user_id, segment);
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='email_templates' AND policyname='Users can select their own templates'
  ) THEN
    CREATE POLICY "Users can select their own templates"
    ON public.email_templates FOR SELECT
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='email_templates' AND policyname='Users can insert their own templates'
  ) THEN
    CREATE POLICY "Users can insert their own templates"
    ON public.email_templates FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='email_templates' AND policyname='Users can update their own templates'
  ) THEN
    CREATE POLICY "Users can update their own templates"
    ON public.email_templates FOR UPDATE
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='email_templates' AND policyname='Users can delete their own templates'
  ) THEN
    CREATE POLICY "Users can delete their own templates"
    ON public.email_templates FOR DELETE
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- updated_at trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_email_templates_updated_at'
  ) THEN
    CREATE TRIGGER update_email_templates_updated_at
    BEFORE UPDATE ON public.email_templates
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_updated_at_column();
  END IF;
END $$;