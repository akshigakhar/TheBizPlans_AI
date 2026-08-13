begin;

create table if not exists public.revenue_streams (
  id uuid primary key default gen_random_uuid(),
  business_plan_id uuid not null references public.business_plans(id) on delete cascade,
  stream_name text not null check (btrim(stream_name) <> ''),
  description text not null default '',
  display_order integer not null check (display_order > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_plan_id, display_order)
);

create index if not exists revenue_streams_plan_idx
  on public.revenue_streams(business_plan_id, display_order);

alter table public.revenue_streams enable row level security;
create policy "owners manage revenue streams" on public.revenue_streams
  for all using (
    exists(select 1 from public.business_plans p where p.id=business_plan_id and p.user_id=auth.uid())
  ) with check (
    exists(select 1 from public.business_plans p where p.id=business_plan_id and p.user_id=auth.uid())
  );

commit;
