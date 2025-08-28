-- Add unique constraints for integrations and credentials
-- This ensures one integration per provider per team and one credential per provider per team

-- Add unique constraint for integrations (teamId, kind)
ALTER TABLE public.integrations 
ADD CONSTRAINT integrations_teamId_kind_unique UNIQUE (team_id, kind);

-- Add unique constraint for credentials (teamId, provider)  
ALTER TABLE public.credentials
ADD CONSTRAINT credentials_teamId_provider_unique UNIQUE (team_id, provider);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_integrations_team_kind ON public.integrations(team_id, kind);
CREATE INDEX IF NOT EXISTS idx_credentials_team_provider ON public.credentials(team_id, provider);

-- Add comment for documentation
COMMENT ON CONSTRAINT integrations_teamId_kind_unique ON public.integrations IS 'Ensures one integration per provider per team';
COMMENT ON CONSTRAINT credentials_teamId_provider_unique ON public.credentials IS 'Ensures one credential set per provider per team';
