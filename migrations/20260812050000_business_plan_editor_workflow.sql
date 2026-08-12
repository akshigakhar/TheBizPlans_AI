begin;

alter table public.business_plan_sections
  add column last_edited_at timestamptz,
  add column approved_by uuid references auth.users(id),
  add column approved_content_version_id uuid,
  add column source_reviewed_at timestamptz,
  add column source_reviewed_by uuid references auth.users(id),
  add column revision integer not null default 0 check (revision >= 0);

alter table public.business_plan_section_versions drop constraint if exists business_plan_section_versions_generation_type_check;
alter table public.business_plan_section_versions add constraint business_plan_section_versions_generation_type_check
  check (generation_type in ('ai_initial','ai_regeneration','manual_edit','manual_review_refresh','approval_snapshot','restored_version'));

alter table public.business_plan_sections add constraint business_plan_sections_approved_version_fk
  foreign key (approved_content_version_id) references public.business_plan_section_versions(id) deferrable initially deferred;

alter table public.business_plans drop constraint if exists business_plans_business_plan_generation_status_check;
alter table public.business_plans add constraint business_plans_business_plan_generation_status_check
  check (business_plan_generation_status in ('not_started','ready','partially_generated','generated','in_progress','ready_for_final_review','approved_for_export','requires_update'));

create index business_plan_sections_approval_idx on public.business_plan_sections(business_plan_id, is_approved, generation_status);
create index business_plan_sections_approved_by_idx on public.business_plan_sections(approved_by) where approved_by is not null;

-- Existing owner-only SELECT policies remain in force. There are intentionally no
-- client write policies: authenticated server actions validate ownership, compute
-- source hashes, and derive audit identities from auth.uid().
commit;
