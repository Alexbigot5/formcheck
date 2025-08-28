-- CRM settings storage per user/provider
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.crm_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('hubspot','salesforce')),
  connected boolean NOT NULL DEFAULT false,
  field_mappings jsonb NOT NULL DEFAULT '{}'::jsonb,
  routing_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

ALTER TABLE public.crm_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='crm_settings' AND policyname='Users can select their own crm settings'
  ) THEN
    CREATE POLICY "Users can select their own crm settings"
    ON public.crm_settings FOR SELECT
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='crm_settings' AND policyname='Users can upsert their own crm settings'
  ) THEN
    CREATE POLICY "Users can upsert their own crm settings"
    ON public.crm_settings FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='crm_settings' AND policyname='Users can update their own crm settings'
  ) THEN
    CREATE POLICY "Users can update their own crm settings"
    ON public.crm_settings FOR UPDATE
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='crm_settings' AND policyname='Users can delete their own crm settings'
  ) THEN
    CREATE POLICY "Users can delete their own crm settings"
    ON public.crm_settings FOR DELETE
    USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_crm_settings_updated_at'
  ) THEN
    CREATE TRIGGER update_crm_settings_updated_at
    BEFORE UPDATE ON public.crm_settings
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_updated_at_column();
  END IF;
END $$;