-- Add credentials column to store provider-specific secrets per user
ALTER TABLE public.crm_settings
ADD COLUMN IF NOT EXISTS credentials jsonb NOT NULL DEFAULT '{}'::jsonb;