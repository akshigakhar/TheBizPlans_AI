-- GENERATED FILE: safe targeted fix for an already configured project.
-- Adds plan_data if missing and upserts the four requested plans.
-- The Auth user akshi.gakhar@gmail.com must already exist.

-- ============================================================================
-- SOURCE: migrations/20260813000000_persist_business_plan_data.sql
-- ============================================================================
-- Keep the complete guided questionnaire with its owning business plan. The
-- existing typed columns remain available for dashboard queries and exports.
alter table public.business_plans
  add column if not exists plan_data jsonb not null default '{}'::jsonb;

comment on column public.business_plans.plan_data is
  'Complete plan-builder form data, including narrative questionnaire answers.';

-- ============================================================================
-- SOURCE: migrations/20260813010000_seed_akshi_business_plans.sql
-- ============================================================================
-- Idempotent demo data for the requested existing Supabase Auth account.
-- The account must already exist in Authentication > Users; this migration does
-- not create or modify credentials.
do $$
declare
  owner_id uuid;
begin
  select id into owner_id
  from auth.users
  where lower(email) = 'akshi.gakhar@gmail.com'
  order by created_at
  limit 1;

  if owner_id is null then
    raise exception 'Cannot seed plans: auth user akshi.gakhar@gmail.com does not exist';
  end if;

  insert into public.business_plans
    (id,user_id,plan_name,business_name,country,region,city,currency,projection_months,plan_data,created_at,updated_at)
  values
    ('a1000000-0000-4000-8000-000000000001',owner_id,'Bloom & Brew — Launch Plan','Bloom & Brew Coffee Co.','United States','California','San Diego','USD',36,
      jsonb_build_object('planName','Bloom & Brew — Launch Plan','businessName','Bloom & Brew Coffee Co.','country','United States','region','California','city','San Diego','stage','Startup','purpose','Bank or lender','projectionPeriod','3 years (36 months)','currency','USD','description','A neighborhood coffee shop combining specialty drinks, fresh pastries, and a welcoming community workspace.','problem','Local residents need a comfortable independent cafe with reliable quality, fast service, and room to meet or work.','difference','Locally roasted coffee, seasonal menus, and community events create a distinctive neighborhood experience.','shortGoals','Open the first location, build repeat traffic, and reach monthly operating break-even.','longGoals','Add catering and open a second neighborhood location.','questionnaire',jsonb_build_object('What is the legal structure?','Limited liability company','When did or will it begin?','Spring 2027')),now()-interval '6 days',now()-interval '2 hours'),
    ('a1000000-0000-4000-8000-000000000002',owner_id,'Northstar Digital — Growth Plan','Northstar Digital Studio','United States','New York','Brooklyn','USD',36,
      jsonb_build_object('planName','Northstar Digital — Growth Plan','businessName','Northstar Digital Studio','country','United States','region','New York','city','Brooklyn','stage','Expansion','purpose','Internal planning','projectionPeriod','3 years (36 months)','currency','USD','description','A strategy and web design studio serving growing professional-services firms.','problem','Small firms struggle to maintain a clear brand and a high-performing website without an in-house team.','difference','Senior specialists, fixed-scope delivery, and measurable conversion improvements.','shortGoals','Grow recurring retainers and hire a full-time designer.','longGoals','Become a nationally recognized digital partner for professional-services firms.','questionnaire',jsonb_build_object('Who will manage daily operations?','The founder and operations lead','How will customers find the business?','Referrals, partnerships, content marketing, and direct outreach.')),now()-interval '12 days',now()-interval '1 day'),
    ('a1000000-0000-4000-8000-000000000003',owner_id,'GreenRoute — Investor Plan','GreenRoute Logistics','Canada','Ontario','Toronto','CAD',60,
      jsonb_build_object('planName','GreenRoute — Investor Plan','businessName','GreenRoute Logistics','country','Canada','region','Ontario','city','Toronto','stage','Startup','purpose','Investor','projectionPeriod','5 years (60 months)','currency','CAD','description','Technology-enabled last-mile delivery for independent retailers using optimized routes and low-emission vehicles.','problem','Independent retailers face expensive, inconsistent same-day delivery options.','difference','Shared delivery capacity, transparent tracking, and lower-emission operations.','shortGoals','Complete the pilot and sign 40 retail customers.','longGoals','Expand across major Canadian cities.','questionnaire',jsonb_build_object('What geographic market does the business serve?','Greater Toronto Area initially','What evidence supports demand?','Pilot interviews and letters of intent from local retailers.')),now()-interval '20 days',now()-interval '3 days'),
    ('a1000000-0000-4000-8000-000000000004',owner_id,'Harbor Wellness — Acquisition Plan','Harbor Wellness Clinic','United Kingdom','Greater London','London','GBP',36,
      jsonb_build_object('planName','Harbor Wellness — Acquisition Plan','businessName','Harbor Wellness Clinic','country','United Kingdom','region','Greater London','city','London','stage','Business acquisition','purpose','Bank or lender','projectionPeriod','3 years (36 months)','currency','GBP','description','An established multidisciplinary wellness clinic offering physiotherapy, massage, and workplace wellbeing programs.','problem','Busy professionals need coordinated, convenient preventative and rehabilitative care.','difference','Multiple disciplines in one clinic, evening availability, and employer partnerships.','shortGoals','Complete the acquisition and retain the existing clinical team.','longGoals','Add a second clinic and grow workplace wellbeing contracts.','questionnaire',jsonb_build_object('Who will manage daily operations?','The acquiring owner with the existing clinic manager','What will the money be used for?','Acquisition consideration, equipment refresh, and working capital.')),now()-interval '30 days',now()-interval '5 days')
  on conflict (id) do update set
    user_id=excluded.user_id, plan_name=excluded.plan_name, business_name=excluded.business_name,
    country=excluded.country, region=excluded.region, city=excluded.city, currency=excluded.currency,
    projection_months=excluded.projection_months, plan_data=excluded.plan_data, updated_at=excluded.updated_at;
end $$;
