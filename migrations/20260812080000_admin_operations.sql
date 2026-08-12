-- Admin authorization and operational controls. Timestamps are stored in UTC.
create type public.app_role as enum ('user','admin');
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role public.app_role not null default 'user',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles read own" on public.profiles for select using (auth.uid()=user_id);
-- No client update/insert policy: role assignment is service-role/database administration only.

create or replace function public.is_admin() returns boolean language sql stable security definer
set search_path=public,pg_temp as $$ select exists(select 1 from public.profiles where user_id=auth.uid() and role='admin') $$;
revoke all on function public.is_admin() from public; grant execute on function public.is_admin() to authenticated;

create table public.app_settings (
  setting_key text primary key check(setting_key in ('ai_generation_enabled','payments_enabled','exports_enabled','max_regenerations_per_section','max_ai_calls_per_plan','max_ai_calls_per_user_day','max_input_context_size','max_output_token_cap','export_platform_branding','confidentiality_notice_enabled','high_plan_ai_cost_usd','high_generation_count','high_regeneration_count','repeated_failure_count')),
  setting_value_json jsonb not null, updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);
create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(), admin_user_id uuid not null references auth.users(id),
  action text not null, target_type text not null, target_id text, metadata_json jsonb not null default '{}', created_at timestamptz not null default now()
);
alter table public.app_settings enable row level security; alter table public.admin_audit_log enable row level security;
create policy "admins read settings" on public.app_settings for select using(public.is_admin());
create policy "admins update settings" on public.app_settings for update using(public.is_admin()) with check(public.is_admin() and updated_by=auth.uid());
create policy "admins read audit" on public.admin_audit_log for select using(public.is_admin());
create policy "admins append audit" on public.admin_audit_log for insert with check(public.is_admin() and admin_user_id=auth.uid());

insert into public.app_settings(setting_key,setting_value_json) values
('ai_generation_enabled','true'),('payments_enabled','true'),('exports_enabled','true'),
('max_regenerations_per_section','2'),('max_ai_calls_per_plan','40'),('max_ai_calls_per_user_day','60'),
('max_input_context_size','60000'),('max_output_token_cap','2000'),('export_platform_branding','true'),
('confidentiality_notice_enabled','true'),('high_plan_ai_cost_usd','5'),('high_generation_count','20'),
('high_regeneration_count','8'),('repeated_failure_count','3');

-- Admin read access remains server-enforced by is_admin; customer write policies are unchanged.
create policy "admins read profiles" on public.profiles for select using(public.is_admin());
create policy "admins read payments" on public.payments for select using(public.is_admin());
create policy "admins read entitlements" on public.plan_entitlements for select using(public.is_admin());
create policy "admins read webhook events" on public.stripe_webhook_events for select using(public.is_admin());
create policy "admins read ai usage" on public.ai_usage_events for select using(public.is_admin());
create policy "admins read exports" on public.business_plan_exports for select using(public.is_admin());

create index if not exists profiles_created_idx on public.profiles(created_at desc);
create index if not exists business_plans_created_idx on public.business_plans(created_at desc);
create index if not exists payments_status_paid_idx on public.payments(payment_status,paid_at desc);
create index if not exists ai_usage_user_created_idx on public.ai_usage_events(user_id,created_at desc);
create index if not exists ai_usage_plan_created_idx on public.ai_usage_events(business_plan_id,created_at desc);
create index if not exists exports_plan_generated_idx on public.business_plan_exports(business_plan_id,generated_at desc);
