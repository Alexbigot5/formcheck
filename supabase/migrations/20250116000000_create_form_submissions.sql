-- Create form_submissions table to store form submission data
CREATE TABLE IF NOT EXISTS public.form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL,
  user_id uuid NOT NULL,
  submission_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  lead_score integer DEFAULT NULL,
  ip_address inet DEFAULT NULL,
  user_agent text DEFAULT NULL,
  referrer text DEFAULT NULL,
  utm_source text DEFAULT NULL,
  utm_medium text DEFAULT NULL,
  utm_campaign text DEFAULT NULL,
  utm_term text DEFAULT NULL,
  utm_content text DEFAULT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz DEFAULT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'error')),
  error_message text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_form_submissions_forms FOREIGN KEY (form_id) REFERENCES public.forms(id) ON DELETE CASCADE,
  CONSTRAINT fk_form_submissions_users FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

-- Policies for form_submissions
DO $$
BEGIN
  -- Users can select submissions for their own forms
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='form_submissions' AND policyname='Users can select their own form submissions'
  ) THEN
    CREATE POLICY "Users can select their own form submissions"
    ON public.form_submissions FOR SELECT
    USING (auth.uid() = user_id);
  END IF;

  -- Users can insert submissions for their own forms
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='form_submissions' AND policyname='Users can insert their own form submissions'
  ) THEN
    CREATE POLICY "Users can insert their own form submissions"
    ON public.form_submissions FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Users can update submissions for their own forms
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='form_submissions' AND policyname='Users can update their own form submissions'
  ) THEN
    CREATE POLICY "Users can update their own form submissions"
    ON public.form_submissions FOR UPDATE
    USING (auth.uid() = user_id);
  END IF;

  -- Users can delete submissions for their own forms
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='form_submissions' AND policyname='Users can delete their own form submissions'
  ) THEN
    CREATE POLICY "Users can delete their own form submissions"
    ON public.form_submissions FOR DELETE
    USING (auth.uid() = user_id);
  END IF;

  -- Allow anonymous users to insert submissions (for public forms)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='form_submissions' AND policyname='Anonymous users can submit to public forms'
  ) THEN
    CREATE POLICY "Anonymous users can submit to public forms"
    ON public.form_submissions FOR INSERT
    TO anon
    WITH CHECK (true); -- We'll validate form ownership in the application layer
  END IF;
END $$;

-- Trigger for updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_form_submissions_updated_at'
  ) THEN
    CREATE TRIGGER update_form_submissions_updated_at
    BEFORE UPDATE ON public.form_submissions
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_updated_at_column();
  END IF;
END $$;

-- Indexes for better query performance
DO $$
BEGIN
  -- Index for form_id filtering
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_form_submissions_form_id'
  ) THEN
    CREATE INDEX idx_form_submissions_form_id ON public.form_submissions(form_id);
  END IF;

  -- Index for user_id filtering
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_form_submissions_user_id'
  ) THEN
    CREATE INDEX idx_form_submissions_user_id ON public.form_submissions(user_id);
  END IF;

  -- Index for submitted_at (for time-based queries)
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_form_submissions_submitted_at'
  ) THEN
    CREATE INDEX idx_form_submissions_submitted_at ON public.form_submissions(submitted_at DESC);
  END IF;

  -- Index for status filtering
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_form_submissions_status'
  ) THEN
    CREATE INDEX idx_form_submissions_status ON public.form_submissions(status);
  END IF;

  -- Composite index for form_id + submitted_at (common query pattern)
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_form_submissions_form_submitted'
  ) THEN
    CREATE INDEX idx_form_submissions_form_submitted ON public.form_submissions(form_id, submitted_at DESC);
  END IF;
END $$;

-- Add a function to automatically calculate lead score on submission
CREATE OR REPLACE FUNCTION public.calculate_lead_score_for_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  calculated_score integer := 50; -- Default score
  form_data jsonb;
  email_value text;
  company_value text;
  budget_value text;
BEGIN
  -- Extract common form fields for scoring
  form_data := NEW.submission_data;
  
  -- Basic scoring logic (can be enhanced)
  calculated_score := 50; -- Base score
  
  -- Email presence (+10)
  email_value := form_data ->> 'email';
  IF email_value IS NOT NULL AND email_value != '' THEN
    calculated_score := calculated_score + 10;
    
    -- Business email domains (+15)
    IF email_value !~ '(gmail|yahoo|hotmail|outlook)\.com$' THEN
      calculated_score := calculated_score + 15;
    END IF;
  END IF;
  
  -- Company presence (+10)
  company_value := form_data ->> 'company';
  IF company_value IS NOT NULL AND company_value != '' THEN
    calculated_score := calculated_score + 10;
  END IF;
  
  -- Budget/revenue indicators (+20)
  budget_value := COALESCE(form_data ->> 'budget', form_data ->> 'revenue', form_data ->> 'company_size');
  IF budget_value IS NOT NULL AND budget_value != '' THEN
    calculated_score := calculated_score + 20;
  END IF;
  
  -- UTM source scoring
  IF NEW.utm_source = 'linkedin' THEN
    calculated_score := calculated_score + 5;
  ELSIF NEW.utm_source = 'google' THEN
    calculated_score := calculated_score + 3;
  END IF;
  
  -- Cap the score at 100
  calculated_score := LEAST(calculated_score, 100);
  
  -- Set the calculated score
  NEW.lead_score := calculated_score;
  
  RETURN NEW;
END;
$$;

-- Create trigger for automatic lead scoring
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'calculate_lead_score_trigger'
  ) THEN
    CREATE TRIGGER calculate_lead_score_trigger
    BEFORE INSERT ON public.form_submissions
    FOR EACH ROW
    EXECUTE FUNCTION public.calculate_lead_score_for_submission();
  END IF;
END $$;

-- Create a view for form submission analytics
CREATE OR REPLACE VIEW public.form_submission_analytics AS
SELECT 
  f.id as form_id,
  f.name as form_name,
  f.user_id,
  COUNT(fs.id) as total_submissions,
  COUNT(fs.id) FILTER (WHERE fs.submitted_at >= NOW() - INTERVAL '7 days') as submissions_last_7_days,
  COUNT(fs.id) FILTER (WHERE fs.submitted_at >= NOW() - INTERVAL '30 days') as submissions_last_30_days,
  AVG(fs.lead_score) as avg_lead_score,
  MAX(fs.submitted_at) as last_submission_at,
  COUNT(fs.id) FILTER (WHERE fs.status = 'processed') as processed_count,
  COUNT(fs.id) FILTER (WHERE fs.status = 'error') as error_count
FROM public.forms f
LEFT JOIN public.form_submissions fs ON f.id = fs.form_id
GROUP BY f.id, f.name, f.user_id;

-- Grant permissions on the view
GRANT SELECT ON public.form_submission_analytics TO authenticated;
GRANT SELECT ON public.form_submission_analytics TO anon;
