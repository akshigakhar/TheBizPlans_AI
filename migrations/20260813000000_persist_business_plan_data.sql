-- Keep the complete guided questionnaire with its owning business plan. The
-- existing typed columns remain available for dashboard queries and exports.
alter table public.business_plans
  add column if not exists plan_data jsonb not null default '{}'::jsonb;

comment on column public.business_plans.plan_data is
  'Complete plan-builder form data, including narrative questionnaire answers.';
