-- Add onboarding fields to profiles for new-user flow
-- Safe-guard: create table only if exists assumed; we only alter here

-- Ensure extension for gen_random_uuid exists (if not already present)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add columns to profiles if they do not exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'onboarding_completed'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN onboarding_completed boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'onboarding_step'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN onboarding_step integer NOT NULL DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'first_form_name'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN first_form_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'lead_scoring'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN lead_scoring jsonb NOT NULL DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'crm_provider'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN crm_provider text CHECK (crm_provider IN ('hubspot','salesforce'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'crm_connected'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN crm_connected boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Index for querying by user_id (assuming user_id column exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_profiles_user_id'
  ) THEN
    CREATE INDEX idx_profiles_user_id ON public.profiles (user_id);
  END IF;
END $$;

-- RLS: ensure users can update their own onboarding fields (if policy not present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Users can update their own profile'
  ) THEN
    CREATE POLICY "Users can update their own profile"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = user_id);
  END IF;
END $$;