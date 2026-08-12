begin;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.business_plans (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_name text not null check (length(trim(plan_name)) between 1 and 160),
  business_name text not null check (length(trim(business_name)) between 1 and 160),
  stage text not null default 'Draft',
  progress smallint not null default 0 check (progress between 0 and 100),
  questionnaire_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_plans_user_updated_idx on public.business_plans(user_id,updated_at desc);
alter table public.business_plans enable row level security;

create policy "owners read plans" on public.business_plans for select using(auth.uid()=user_id);
create policy "owners create plans" on public.business_plans for insert with check(auth.uid()=user_id);
create policy "owners update plans" on public.business_plans for update using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy "owners delete plans" on public.business_plans for delete using(auth.uid()=user_id);

create or replace function public.touch_business_plan_updated_at() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin new.updated_at=now(); return new; end;
$$;
create trigger business_plans_touch before update on public.business_plans for each row execute function public.touch_business_plan_updated_at();

commit;
