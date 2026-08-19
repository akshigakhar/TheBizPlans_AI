-- GENERATED FILE: safe targeted fix for an already configured project.
-- Adds plan_data if missing and upserts the requested plans.
-- The Auth user akshi.gakhar@gmail.com must already exist.

-- ============================================================================
-- SOURCE: migrations/20260813000000_persist_business_plan_data.sql
-- ============================================================================
-- Schema dumps intentionally clear search_path. Restore it before every source
-- because application migrations use unqualified public object names.
set search_path = public, extensions;
-- Keep the complete guided questionnaire with its owning business plan. The
-- existing typed columns remain available for dashboard queries and exports.
alter table public.business_plans
  add column if not exists plan_data jsonb not null default '{}'::jsonb;

comment on column public.business_plans.plan_data is
  'Complete plan-builder form data, including narrative questionnaire answers.';

-- ============================================================================
-- SOURCE: migrations/20260813010000_seed_akshi_business_plans.sql
-- ============================================================================
-- Schema dumps intentionally clear search_path. Restore it before every source
-- because application migrations use unqualified public object names.
set search_path = public, extensions;
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

-- ============================================================================
-- SOURCE: migrations/20260819000000_seed_veggi_swaadh_plan.sql
-- ============================================================================
-- Schema dumps intentionally clear search_path. Restore it before every source
-- because application migrations use unqualified public object names.
set search_path = public, extensions;
-- Idempotently add the requested Veggi-Swaadh financial plan to Akshi's account.
-- Authentication credentials are deliberately outside the scope of migrations.
do $$
declare
  owner_id uuid;
  plan_id constant uuid := 'a1000000-0000-4000-8000-000000000005';
  financial_data jsonb := $json$
{
  "statementTitle": "Projected Income Statement for bus. plan",
  "periods": ["Year 1", "Year 2", "Year 3"],
  "incomeStatement": {
    "Revenue": {"Dine-in":[200648,335739,378030],"Delivery Apps":[197695,332765,386157],"Take out":[187446,350117,430871],"Catering":[16343,30025,34550],"Total Sales Revenue":[602132,1048646,1229608]},
    "Cost of sales": {"Direct Food, Material & Labour Costs":[170755,297956,349575],"Packaging Costs":[9360,16537,19613],"Delivery App Commissions":[59309,99830,115847],"Total Cost of Sales":[239423,414322,485034]},
    "Gross Profit":[362709,634324,744574],
    "Gross profit (%)":[60,60,61],
    "Operating Expenses":{"Salary":[128880,148320,152770],"Payroll Taxes and Benefits":[15466,17798,18332],"Marketing":[24000,21000,21000],"Professional Fees - Accounting":[1800,1854,1910],"Rent & TMI":[79020,79020,79020],"Insurance":[7200,7416,7638],"Utilities":[19500,24000,24720],"Repairs & Maintenance":[6000,6180,6365],"Telephone & Internet":[4200,4326,4456],"Credit Card Transaction Fee":[12043,20973,24592],"Setup cost - non capital":[7000,0,0],"Total Operating Expenses":[305108,330887,340803]},
    "Operating Income (EBITDA)":[57601,303436,403770],
    "Other Expenses":{"Interest on Long-Term Debt":[10821,10012,9140],"Depreciation / Amortization":[34014,34014,34014]},
    "Earnings before taxes (EBT)":[12765,259410,360616],"Tax":[1915,38912,54092],"Net Income (Profit after tax)":[10850,220499,306524],"Net income margin":[2,21,25]
  },
  "monthly": {
    "periods":["Month 1","Month 2","Month 3","Month 4","Month 5","Month 6","Month 7","Month 8","Month 9","Month 10","Month 11","Month 12","Month 13","Month 14","Month 15","Month 16","Month 17","Month 18","Month 19","Month 20","Month 21","Month 22","Month 23","Month 24","Month 25","Month 26","Month 27","Month 28","Month 29","Month 30","Month 31","Month 32","Month 33","Month 34","Month 35","Month 36"],
    "Dine-in":[0,10767,14594,16969,18305,13999,16315,20250,21384,22264,23087,22714,26933,27672,30879,32753,32432,22892,24740,28594,28222,27556,26878,26188,30760,31518,35075,37103,36643,25796,27807,32056,31560,30737,29907,29068],
    "Delivery Apps":[0,10869,14662,16969,18223,13876,16104,19906,20939,21717,22436,21994,25988,26842,30107,32097,31941,22655,24602,28567,28326,27783,27220,26637,31421,32195,35829,37901,37431,26351,28405,32745,32238,31398,30550,29693],
    "Take out":[0,9741,13289,15547,16871,12977,15206,18973,20137,21067,21948,21690,25830,26989,30612,32987,33170,23764,26057,30542,30561,30240,29881,29484,35060,35923,39977,42290,41765,29402,31694,36537,35971,35034,34087,33131],
    "Catering":[0,797,1102,1305,1433,1115,1320,1663,1782,1881,1976,1969,2363,2437,2729,2905,2887,2045,2218,2572,2547,2495,2441,2386,2811,2881,3206,3391,3349,2358,2541,2930,2884,2809,2733,2657],
    "Total Sales Revenue":[0,32174,43647,50790,54832,41967,48945,60792,64242,66929,69447,68367,81114,83940,94327,100742,100430,71356,77617,90275,89656,88074,86420,84695,100052,102517,114087,120685,119188,83907,90447,104268,102653,99978,97277,94549],
    "Net Income (Profit after tax)":[-25714,-8497,-3429,-61,4316,-3141,-113,6813,8852,10448,11733,9642,15400,16817,21141,24343,24202,10613,13737,20044,19748,18974,18163,17316,24525,25757,30671,33960,33220,16516,19776,26660,25862,24536,23197,21845]
  },
  "balanceSheet": {
    "periods":["Month 0","Year 1","Year 2","Year 3"],
    "Cash":[52000,40096,254274,570225],"Inventory":[0,10000,11865,13248],"Other Net Working Capital":[0,36271,63432,74457],"Total Current Assets":[52000,86366,329572,657930],
    "Security deposit to landlord":[13170,13170,13170,13170],"Equipment, Furn, Millwork & Signage":[95141,76113,57085,38056],"Leasehold improvement":[149859,134873,119887,104901],"Total Non-Current Assets":[258170,224156,190142,156128],"Total Assets":[310170,310522,519714,814058],
    "Total Current Liabilities":[0,0,0,0],"Long-Term Debt":[150000,139502,128195,116015],"Total Liabilities":[150000,139502,128195,116015],"Share Capital":[160170,160170,160170,160170],"Retained Earnings (Deficit)":[0,10850,231349,537873],"Total Equity":[160170,171020,391519,698043],"Total Liabilities and Equity":[310170,310522,519714,814058]
  }
}
$json$::jsonb;
begin
  select id into owner_id from auth.users
  where lower(email) = 'akshi.gakhar@gmail.com'
  order by created_at limit 1;

  if owner_id is null then
    raise exception 'Cannot seed Veggi-Swaadh plan: auth user akshi.gakhar@gmail.com does not exist';
  end if;

  insert into public.business_plans
    (id,user_id,plan_name,business_name,country,region,city,currency,projection_months,plan_data,created_at,updated_at)
  values
    (plan_id,owner_id,'Veggi-Swaadh Restaurant Inc. — Business Plan','Veggi-Swaadh Restaurant Inc.','Canada','Ontario',null,'CAD',36,
     jsonb_build_object('planName','Veggi-Swaadh Restaurant Inc. — Business Plan','businessName','Veggi-Swaadh Restaurant Inc.','country','Canada','region','Ontario','city','','stage','Startup','purpose','Business plan','projectionPeriod','3 years (36 months)','currency','CAD','openingCash',52000,'financialStatements',financial_data),now(),now())
  on conflict (id) do update set
    user_id=excluded.user_id,plan_name=excluded.plan_name,business_name=excluded.business_name,
    country=excluded.country,region=excluded.region,city=excluded.city,currency=excluded.currency,
    projection_months=excluded.projection_months,plan_data=excluded.plan_data,updated_at=excluded.updated_at;
end $$;
