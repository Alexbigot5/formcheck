-- Create lead_scoring_versions table for audit & rollback
create table if not exists public.lead_scoring_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  config jsonb not null default '{}'::jsonb,
  note text,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.lead_scoring_versions enable row level security;

-- Policies: users manage their own versions; admins can view all
create policy "Users can insert their own versions"
  on public.lead_scoring_versions for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can select their own versions"
  on public.lead_scoring_versions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can delete their own versions"
  on public.lead_scoring_versions for delete
  to authenticated
  using (auth.uid() = user_id);

create policy "Admins can view all versions"
  on public.lead_scoring_versions for select
  to authenticated
  using (has_role(auth.uid(), 'admin'::app_role));