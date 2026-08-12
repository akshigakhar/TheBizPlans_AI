begin;
create table public.business_plan_exports (
 id uuid primary key default gen_random_uuid(), business_plan_id uuid not null references public.business_plans(id) on delete cascade,
 export_version integer not null check(export_version>0), export_type text not null check(export_type in ('docx','pdf','xlsx')),
 financial_snapshot_id uuid not null references public.financial_snapshots(id), financial_snapshot_version integer not null check(financial_snapshot_version>0),
 approved_section_versions jsonb not null check(jsonb_typeof(approved_section_versions)='array'), plan_content_hash text not null check(plan_content_hash ~ '^sha256-[0-9a-f]{64}$'),
 template_key text not null default 'professional_standard', template_version text not null,
 file_name text not null, storage_key text not null, file_size bigint not null default 0 check(file_size>=0),
 generated_by uuid not null references auth.users(id), generated_at timestamptz not null default now(),
 export_status text not null check(export_status in ('pending','generating','ready','failed','superseded')), error_category text, created_at timestamptz not null default now(),
 unique(business_plan_id,export_type,plan_content_hash,template_version)
);
create index business_plan_exports_history_idx on public.business_plan_exports(business_plan_id,export_version desc,generated_at desc);
create index business_plan_exports_cache_idx on public.business_plan_exports(business_plan_id,export_type,plan_content_hash,template_version) where export_status='ready';
alter table public.business_plan_exports enable row level security;
create policy "owners read exports" on public.business_plan_exports for select using(exists(select 1 from public.business_plans p where p.id=business_plan_id and p.user_id=auth.uid()));
-- Writes are intentionally server-only. A service role inserts/updates after performing the
-- same ownership/readiness checks; authenticated clients cannot forge approval or object keys.
commit;
