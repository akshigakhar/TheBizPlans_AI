begin;
-- Server code is the only writer of provider metadata and usage rows.
alter table public.business_plans add column business_plan_generation_status text not null default 'not_started' check(business_plan_generation_status in ('not_started','ready','partially_generated','generated','requires_update'));
create table public.business_plan_sections (
 id uuid primary key default gen_random_uuid(), business_plan_id uuid not null references public.business_plans(id) on delete cascade,
 section_key text not null check(section_key in ('executive_summary','business_overview','ownership_management','products_services','market_target_customers','competitive_analysis','sales_marketing','operations','staffing_hr','funding_request','financial_projections','risk_analysis')),
 section_title text not null, section_order smallint not null check(section_order between 1 and 12), generation_status text not null default 'not_generated' check(generation_status in ('not_generated','ready','generating','generated','edited','approved','outdated','error')),
 generated_content text, edited_content text, content_format text not null default 'markdown' check(content_format='markdown'), source_data_hash text, approved_financial_snapshot_id uuid references public.financial_snapshots(id), generation_context_json jsonb,
 prompt_version text, model_used text, input_tokens integer not null default 0 check(input_tokens>=0), output_tokens integer not null default 0 check(output_tokens>=0), total_tokens integer generated always as (input_tokens+output_tokens) stored,
 estimated_cost numeric(14,8) not null default 0 check(estimated_cost>=0), generation_count integer not null default 0 check(generation_count>=0), regeneration_count integer not null default 0 check(regeneration_count>=0), generated_at timestamptz, approved_at timestamptz, is_approved boolean not null default false, error_code text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(business_plan_id,section_key)
);
create table public.business_plan_section_versions (
 id uuid primary key default gen_random_uuid(), business_plan_section_id uuid not null references public.business_plan_sections(id) on delete cascade, version_number integer not null check(version_number>0), content text not null, source_data_hash text not null, generation_type text not null check(generation_type in ('ai_initial','ai_regeneration','manual_snapshot')), prompt_version text not null, model_used text, input_tokens integer not null default 0, output_tokens integer not null default 0, estimated_cost numeric(14,8) not null default 0, created_at timestamptz not null default now(), created_by uuid not null references auth.users(id), unique(business_plan_section_id,version_number)
);
create table public.ai_usage_events (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), business_plan_id uuid not null references public.business_plans(id) on delete cascade, section_key text not null, action_type text not null check(action_type in ('initial_generation','regeneration')), model text not null, input_tokens integer not null default 0, output_tokens integer not null default 0, total_tokens integer generated always as (input_tokens+output_tokens) stored, estimated_cost numeric(14,8) not null default 0, source_data_hash text not null, prompt_version text not null, request_status text not null check(request_status in ('succeeded','failed')), error_code text, created_at timestamptz not null default now()
);
create index business_plan_sections_cache_idx on public.business_plan_sections(business_plan_id,section_key,source_data_hash,prompt_version,model_used);
create index business_plan_section_versions_history_idx on public.business_plan_section_versions(business_plan_section_id,version_number desc);
create index ai_usage_events_plan_idx on public.ai_usage_events(business_plan_id,created_at desc);
create index ai_usage_events_user_day_idx on public.ai_usage_events(user_id,created_at desc);
alter table public.business_plan_sections enable row level security; alter table public.business_plan_section_versions enable row level security; alter table public.ai_usage_events enable row level security;
create policy "owners read sections" on public.business_plan_sections for select using (exists(select 1 from public.business_plans p where p.id=business_plan_id and p.user_id=auth.uid()));
create policy "owners read versions" on public.business_plan_section_versions for select using (exists(select 1 from public.business_plan_sections s join public.business_plans p on p.id=s.business_plan_id where s.id=business_plan_section_id and p.user_id=auth.uid()));
-- No direct client policies for INSERT/UPDATE/DELETE or usage reads: trusted server/service-role actions own writes and internal cost data.
commit;
