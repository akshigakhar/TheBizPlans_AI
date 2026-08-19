-- GENERATED FILE: run npm run database:sql to rebuild.
-- EXISTING PROJECT: the base business_plans schema already exists.
-- Apply once in the Supabase SQL Editor, then use normal migrations thereafter.
-- The seed requires akshi.gakhar@gmail.com to exist in Authentication first.

-- ============================================================================
-- SOURCE: migrations/20260729000000_create_revenue_streams.sql
-- ============================================================================
-- Schema dumps intentionally clear search_path. Restore it before every source
-- because application migrations use unqualified public object names.
set search_path = public, extensions;
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

-- ============================================================================
-- SOURCE: migrations/20260730000000_create_operating_expenses.sql
-- ============================================================================
-- Schema dumps intentionally clear search_path. Restore it before every source
-- because application migrations use unqualified public object names.
set search_path = public, extensions;
BEGIN;

CREATE TABLE operating_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_plan_id uuid NOT NULL
    REFERENCES business_plans (id) ON DELETE CASCADE,
  expense_name text NOT NULL CHECK (btrim(expense_name) <> ''),
  expense_category text NOT NULL CHECK (expense_category IN ('premises','utilities','insurance','marketing','software_and_technology','professional_fees','repairs_and_maintenance','office_and_administration','travel','vehicle','banking_and_merchant_fees','licences_and_memberships','contract_services','communication','security_and_cleaning','taxes_and_permits','other')),
  calculation_type text NOT NULL
    CHECK (calculation_type IN ('fixed_amount', 'percentage_of_revenue')),
  amount numeric(15, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  percentage_of_revenue numeric(7, 4)
    CHECK (percentage_of_revenue BETWEEN 0 AND 100),
  revenue_basis text,
  frequency text NOT NULL DEFAULT 'monthly',
  start_month integer NOT NULL CHECK (start_month >= 1),
  end_month integer,
  annual_increase_percentage numeric(7, 4) NOT NULL DEFAULT 0
    CHECK (annual_increase_percentage >= 0),
  payment_month integer,
  notes text,
  display_order integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT operating_expenses_amount_by_type CHECK (
    (calculation_type = 'fixed_amount'
      AND percentage_of_revenue IS NULL AND revenue_basis IS NULL
      AND frequency IN ('monthly', 'quarterly', 'semi_annual', 'annual', 'one_time'))
    OR
    (calculation_type = 'percentage_of_revenue'
      AND percentage_of_revenue IS NOT NULL
      AND revenue_basis IN ('total_revenue', 'selected_revenue_streams')
      AND frequency = 'monthly')
  ),
  CONSTRAINT operating_expenses_month_range CHECK (
    end_month IS NULL OR end_month >= start_month
  ),
  CONSTRAINT operating_expenses_payment_month CHECK (
    payment_month IS NULL
    OR (payment_month >= start_month AND (end_month IS NULL OR payment_month <= end_month))
  ),
  CONSTRAINT operating_expenses_display_order_positive CHECK (display_order >= 1),
  CONSTRAINT operating_expenses_plan_order_unique UNIQUE (business_plan_id, display_order)
);

CREATE INDEX operating_expenses_business_plan_id_idx
  ON operating_expenses (business_plan_id);
CREATE INDEX operating_expenses_plan_order_idx ON operating_expenses (business_plan_id, display_order);
CREATE INDEX operating_expenses_plan_category_idx ON operating_expenses (business_plan_id, expense_category);

CREATE TABLE operating_expense_revenue_streams (
  operating_expense_id uuid NOT NULL
    REFERENCES operating_expenses (id) ON DELETE CASCADE,
  revenue_stream_id uuid NOT NULL
    REFERENCES revenue_streams (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (operating_expense_id, revenue_stream_id)
);

CREATE INDEX operating_expense_revenue_streams_revenue_stream_id_idx
  ON operating_expense_revenue_streams (revenue_stream_id);

CREATE FUNCTION set_operating_expense_defaults()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.display_order IS NULL THEN
    -- The advisory lock prevents two inserts for one plan choosing the same order.
    PERFORM pg_advisory_xact_lock(hashtext(NEW.business_plan_id::text));
    SELECT COALESCE(MAX(display_order), 0) + 1
      INTO NEW.display_order
      FROM operating_expenses
      WHERE business_plan_id = NEW.business_plan_id;
  END IF;

  IF NEW.calculation_type = 'percentage_of_revenue' AND NEW.frequency IS NULL THEN
    NEW.frequency := 'monthly';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER operating_expenses_defaults_before_insert
BEFORE INSERT ON operating_expenses
FOR EACH ROW EXECUTE FUNCTION set_operating_expense_defaults();

CREATE FUNCTION touch_operating_expense_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER operating_expenses_updated_at_before_update
BEFORE UPDATE ON operating_expenses
FOR EACH ROW EXECUTE FUNCTION touch_operating_expense_updated_at();

COMMIT;

-- ============================================================================
-- SOURCE: migrations/20260812000000_create_staffing_positions_and_payroll_outputs.sql
-- ============================================================================
-- Schema dumps intentionally clear search_path. Restore it before every source
-- because application migrations use unqualified public object names.
set search_path = public, extensions;
BEGIN;

-- Assumptions only: deterministic projection output is calculated in TypeScript.
CREATE TABLE staffing_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_plan_id uuid NOT NULL REFERENCES business_plans (id) ON DELETE CASCADE,
  position_title text NOT NULL CHECK (btrim(position_title) <> ''),
  department text CHECK (department IS NULL OR department IN ('management','administration','sales','marketing','operations','finance','customer_service','technology','production','logistics','human_resources','other')),
  worker_type text NOT NULL CHECK (worker_type IN ('employee','owner','contractor')),
  compensation_type text NOT NULL CHECK (compensation_type IN ('hourly','salaried','fixed_monthly','unpaid')),
  number_of_workers integer NOT NULL DEFAULT 1 CHECK (number_of_workers BETWEEN 1 AND 100000),
  hourly_rate numeric(15,4) CHECK (hourly_rate >= 0),
  weekly_hours numeric(8,2) CHECK (weekly_hours > 0 AND weekly_hours <= 168),
  annual_salary numeric(15,2) CHECK (annual_salary >= 0),
  monthly_contractor_amount numeric(15,2) CHECK (monthly_contractor_amount >= 0),
  monthly_hours numeric(10,2) CHECK (monthly_hours > 0),
  employer_cost_percentage numeric(7,4) NOT NULL DEFAULT 0 CHECK (employer_cost_percentage BETWEEN 0 AND 100),
  monthly_benefits_per_worker numeric(15,2) NOT NULL DEFAULT 0 CHECK (monthly_benefits_per_worker >= 0),
  annual_bonus_per_worker numeric(15,2) NOT NULL DEFAULT 0 CHECK (annual_bonus_per_worker >= 0),
  bonus_month integer CHECK (bonus_month BETWEEN 1 AND 12),
  start_month integer NOT NULL CHECK (start_month BETWEEN 1 AND 36),
  end_month integer CHECK (end_month BETWEEN 1 AND 36),
  annual_compensation_increase_percentage numeric(7,4) NOT NULL DEFAULT 0 CHECK (annual_compensation_increase_percentage BETWEEN 0 AND 100),
  notes text CHECK (char_length(notes) <= 2000),
  display_order integer NOT NULL CHECK (display_order >= 1),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (end_month IS NULL OR end_month >= start_month),
  CHECK (annual_bonus_per_worker = 0 OR bonus_month IS NOT NULL),
  CHECK (worker_type <> 'contractor' OR (employer_cost_percentage = 0 AND monthly_benefits_per_worker = 0 AND annual_bonus_per_worker = 0)),
  CHECK (
    (compensation_type = 'hourly' AND hourly_rate IS NOT NULL AND ((worker_type = 'contractor' AND monthly_hours IS NOT NULL AND weekly_hours IS NULL) OR (worker_type <> 'contractor' AND weekly_hours IS NOT NULL AND monthly_hours IS NULL)) AND annual_salary IS NULL AND monthly_contractor_amount IS NULL)
    OR (compensation_type = 'salaried' AND worker_type <> 'contractor' AND annual_salary IS NOT NULL AND hourly_rate IS NULL AND weekly_hours IS NULL AND monthly_hours IS NULL AND monthly_contractor_amount IS NULL)
    OR (compensation_type = 'fixed_monthly' AND monthly_contractor_amount IS NOT NULL AND hourly_rate IS NULL AND weekly_hours IS NULL AND monthly_hours IS NULL AND annual_salary IS NULL)
    OR (compensation_type = 'unpaid' AND worker_type <> 'contractor' AND hourly_rate IS NULL AND weekly_hours IS NULL AND monthly_hours IS NULL AND annual_salary IS NULL AND monthly_contractor_amount IS NULL)
  ),
  UNIQUE (business_plan_id, display_order)
);

CREATE INDEX staffing_positions_business_plan_id_idx ON staffing_positions (business_plan_id);
CREATE INDEX staffing_positions_plan_order_idx ON staffing_positions (business_plan_id, display_order);
CREATE INDEX staffing_positions_plan_worker_type_idx ON staffing_positions (business_plan_id, worker_type);

CREATE FUNCTION set_staffing_position_defaults() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.display_order IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(NEW.business_plan_id::text));
    SELECT COALESCE(MAX(display_order), 0) + 1 INTO NEW.display_order FROM staffing_positions WHERE business_plan_id = NEW.business_plan_id;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER staffing_positions_defaults_before_insert BEFORE INSERT ON staffing_positions FOR EACH ROW EXECUTE FUNCTION set_staffing_position_defaults();

CREATE FUNCTION touch_staffing_position_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := CURRENT_TIMESTAMP; RETURN NEW; END; $$;
CREATE TRIGGER staffing_positions_updated_at_before_update BEFORE UPDATE ON staffing_positions FOR EACH ROW EXECUTE FUNCTION touch_staffing_position_updated_at();

ALTER TABLE staffing_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY staffing_positions_select_own ON staffing_positions FOR SELECT USING (EXISTS (SELECT 1 FROM business_plans p WHERE p.id = business_plan_id AND p.user_id = auth.uid()));
CREATE POLICY staffing_positions_insert_own ON staffing_positions FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM business_plans p WHERE p.id = business_plan_id AND p.user_id = auth.uid()));
CREATE POLICY staffing_positions_update_own ON staffing_positions FOR UPDATE USING (EXISTS (SELECT 1 FROM business_plans p WHERE p.id = business_plan_id AND p.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM business_plans p WHERE p.id = business_plan_id AND p.user_id = auth.uid()));
CREATE POLICY staffing_positions_delete_own ON staffing_positions FOR DELETE USING (EXISTS (SELECT 1 FROM business_plans p WHERE p.id = business_plan_id AND p.user_id = auth.uid()));

COMMIT;

-- ============================================================================
-- SOURCE: migrations/20260812010000_create_loans.sql
-- ============================================================================
-- Schema dumps intentionally clear search_path. Restore it before every source
-- because application migrations use unqualified public object names.
set search_path = public, extensions;
BEGIN;

CREATE TABLE loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_plan_id uuid NOT NULL REFERENCES business_plans (id) ON DELETE CASCADE,
  loan_name text NOT NULL CHECK (btrim(loan_name) <> ''),
  lender_name text,
  loan_type text NOT NULL DEFAULT 'term_loan' CHECK (loan_type IN ('term_loan','equipment_loan','vehicle_loan','acquisition_loan','shareholder_loan','other')),
  loan_status text NOT NULL CHECK (loan_status IN ('proposed','existing')),
  original_principal numeric(15,2) NOT NULL DEFAULT 0 CHECK (original_principal >= 0),
  annual_interest_rate numeric(9,6) NOT NULL CHECK (annual_interest_rate BETWEEN 0 AND 100),
  amortization_months integer NOT NULL CHECK (amortization_months BETWEEN 1 AND 600),
  term_months integer CHECK (term_months >= 1),
  payment_frequency text NOT NULL DEFAULT 'monthly' CHECK (payment_frequency = 'monthly'),
  loan_start_month integer NOT NULL DEFAULT 1 CHECK (loan_start_month >= 1),
  first_payment_month integer NOT NULL CHECK (first_payment_month >= 1),
  interest_only_months integer NOT NULL DEFAULT 0 CHECK (interest_only_months >= 0 AND interest_only_months < amortization_months),
  interest_only_rate_override numeric(9,6) CHECK (interest_only_rate_override BETWEEN 0 AND 100),
  financing_fee numeric(15,2) NOT NULL DEFAULT 0 CHECK (financing_fee >= 0),
  financing_fee_treatment text NOT NULL DEFAULT 'paid_upfront' CHECK (financing_fee_treatment IN ('paid_upfront','deducted_from_proceeds')),
  balloon_payment numeric(15,2) NOT NULL DEFAULT 0 CHECK (balloon_payment >= 0),
  balloon_payment_month integer CHECK (balloon_payment_month >= 1),
  opening_balance numeric(15,2) NOT NULL DEFAULT 0 CHECK (opening_balance >= 0),
  notes text NOT NULL DEFAULT '',
  display_order integer NOT NULL CHECK (display_order >= 1),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT loans_status_amount CHECK ((loan_status = 'proposed' AND original_principal > 0) OR (loan_status = 'existing' AND opening_balance > 0)),
  CONSTRAINT loans_balloon_month CHECK (balloon_payment = 0 OR balloon_payment_month IS NOT NULL),
  CONSTRAINT loans_existing_timing CHECK (loan_status <> 'existing' OR (loan_start_month = 1 AND first_payment_month = 1)),
  CONSTRAINT loans_proposed_timing CHECK (loan_status <> 'proposed' OR first_payment_month = loan_start_month + 1),
  UNIQUE (business_plan_id, display_order)
);

CREATE INDEX loans_business_plan_id_idx ON loans (business_plan_id);
CREATE INDEX loans_plan_status_idx ON loans (business_plan_id, loan_status) WHERE is_active;

CREATE FUNCTION set_loan_defaults() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.display_order IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(NEW.business_plan_id::text));
    SELECT COALESCE(MAX(display_order), 0) + 1 INTO NEW.display_order FROM loans WHERE business_plan_id = NEW.business_plan_id;
  END IF;
  IF NEW.loan_status = 'proposed' AND NEW.first_payment_month IS NULL THEN NEW.first_payment_month := NEW.loan_start_month + 1; END IF;
  IF NEW.loan_status = 'existing' THEN NEW.loan_start_month := 1; NEW.first_payment_month := 1; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER loans_defaults_before_insert BEFORE INSERT ON loans FOR EACH ROW EXECUTE FUNCTION set_loan_defaults();

CREATE FUNCTION touch_loan_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := CURRENT_TIMESTAMP; RETURN NEW; END; $$;
CREATE TRIGGER loans_updated_at_before_update BEFORE UPDATE ON loans FOR EACH ROW EXECUTE FUNCTION touch_loan_updated_at();

ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY loans_select_own ON loans FOR SELECT USING (EXISTS (SELECT 1 FROM business_plans p WHERE p.id = business_plan_id AND p.user_id = auth.uid()));
CREATE POLICY loans_insert_own ON loans FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM business_plans p WHERE p.id = business_plan_id AND p.user_id = auth.uid()));
CREATE POLICY loans_update_own ON loans FOR UPDATE USING (EXISTS (SELECT 1 FROM business_plans p WHERE p.id = business_plan_id AND p.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM business_plans p WHERE p.id = business_plan_id AND p.user_id = auth.uid()));
CREATE POLICY loans_delete_own ON loans FOR DELETE USING (EXISTS (SELECT 1 FROM business_plans p WHERE p.id = business_plan_id AND p.user_id = auth.uid()));

COMMIT;

-- ============================================================================
-- SOURCE: migrations/20260812020000_create_working_capital_and_fixed_assets.sql
-- ============================================================================
-- Schema dumps intentionally clear search_path. Restore it before every source
-- because application migrations use unqualified public object names.
set search_path = public, extensions;
BEGIN;

CREATE TABLE working_capital_assumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_plan_id uuid NOT NULL UNIQUE REFERENCES business_plans(id) ON DELETE CASCADE,
  accounts_receivable_days numeric(9,2) NOT NULL DEFAULT 0 CHECK (accounts_receivable_days >= 0),
  inventory_days numeric(9,2) NOT NULL DEFAULT 0 CHECK (inventory_days >= 0),
  accounts_payable_days numeric(9,2) NOT NULL DEFAULT 0 CHECK (accounts_payable_days >= 0),
  minimum_inventory_balance numeric(15,2) NOT NULL DEFAULT 0 CHECK (minimum_inventory_balance >= 0),
  use_working_capital boolean NOT NULL DEFAULT false,
  notes text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX working_capital_plan_idx ON working_capital_assumptions(business_plan_id);

CREATE TABLE fixed_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_plan_id uuid NOT NULL REFERENCES business_plans(id) ON DELETE CASCADE,
  asset_name text NOT NULL CHECK (btrim(asset_name) <> ''),
  asset_category text NOT NULL DEFAULT 'other' CHECK (asset_category IN ('equipment','furniture_and_fixtures','vehicle','computer_and_technology','machinery','leasehold_improvements','buildings','other')),
  purchase_amount numeric(15,2) NOT NULL CHECK (purchase_amount >= 0), purchase_month integer NOT NULL CHECK (purchase_month >= 1),
  in_service_month integer NOT NULL CHECK (in_service_month >= purchase_month), useful_life_months integer NOT NULL CHECK (useful_life_months >= 1),
  residual_value numeric(15,2) NOT NULL DEFAULT 0 CHECK (residual_value >= 0 AND residual_value <= purchase_amount),
  depreciation_method text NOT NULL DEFAULT 'straight_line' CHECK (depreciation_method = 'straight_line'),
  source_startup_cost_id uuid, notes text NOT NULL DEFAULT '', display_order integer NOT NULL DEFAULT 1 CHECK (display_order >= 1),
  is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (business_plan_id, source_startup_cost_id), UNIQUE (business_plan_id, display_order)
);
CREATE INDEX fixed_assets_plan_idx ON fixed_assets(business_plan_id);
CREATE INDEX fixed_assets_active_plan_idx ON fixed_assets(business_plan_id) WHERE is_active;

CREATE FUNCTION touch_financial_assumption_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at := CURRENT_TIMESTAMP; RETURN NEW; END; $$;
CREATE TRIGGER working_capital_touch BEFORE UPDATE ON working_capital_assumptions FOR EACH ROW EXECUTE FUNCTION touch_financial_assumption_updated_at();
CREATE TRIGGER fixed_assets_touch BEFORE UPDATE ON fixed_assets FOR EACH ROW EXECUTE FUNCTION touch_financial_assumption_updated_at();

ALTER TABLE working_capital_assumptions ENABLE ROW LEVEL SECURITY; ALTER TABLE fixed_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY working_capital_own ON working_capital_assumptions FOR ALL USING (EXISTS (SELECT 1 FROM business_plans p WHERE p.id=business_plan_id AND p.user_id=auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM business_plans p WHERE p.id=business_plan_id AND p.user_id=auth.uid()));
CREATE POLICY fixed_assets_own ON fixed_assets FOR ALL USING (EXISTS (SELECT 1 FROM business_plans p WHERE p.id=business_plan_id AND p.user_id=auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM business_plans p WHERE p.id=business_plan_id AND p.user_id=auth.uid()));
COMMIT;

-- ============================================================================
-- SOURCE: migrations/20260812030000_create_financial_review_snapshots.sql
-- ============================================================================
-- Schema dumps intentionally clear search_path. Restore it before every source
-- because application migrations use unqualified public object names.
set search_path = public, extensions;
BEGIN;

CREATE TYPE financial_status AS ENUM ('incomplete','calculating','requires_correction','ready_for_review','approved','outdated');
ALTER TABLE business_plans ADD COLUMN financial_status financial_status NOT NULL DEFAULT 'incomplete';
ALTER TABLE business_plans ADD COLUMN current_financial_assumptions_hash text;
ALTER TABLE business_plans ADD COLUMN approved_financial_snapshot_id uuid;
ALTER TABLE business_plans ADD COLUMN financial_last_calculated_at timestamptz;

CREATE TABLE financial_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_plan_id uuid NOT NULL REFERENCES business_plans(id) ON DELETE CASCADE,
  snapshot_version integer NOT NULL CHECK (snapshot_version > 0),
  financial_model_version text NOT NULL, financial_analysis_version text NOT NULL,
  assumptions_hash text NOT NULL CHECK (assumptions_hash ~ '^sha256-[0-9a-f]{64}$'),
  snapshot_status text NOT NULL DEFAULT 'approved' CHECK (snapshot_status = 'approved'),
  approved_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_by uuid NOT NULL REFERENCES auth.users(id),
  projection_start_date date NOT NULL, projection_months integer NOT NULL CHECK (projection_months > 0), currency text NOT NULL,
  assumptions_json jsonb NOT NULL, projection_json jsonb NOT NULL, statements_json jsonb NOT NULL,
  analysis_json jsonb NOT NULL, warnings_json jsonb NOT NULL DEFAULT '[]', warning_codes_acknowledged jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (business_plan_id,snapshot_version),
  UNIQUE (business_plan_id,assumptions_hash,financial_model_version,financial_analysis_version)
);
CREATE INDEX financial_snapshots_plan_approved_idx ON financial_snapshots(business_plan_id,approved_at DESC);
ALTER TABLE business_plans ADD CONSTRAINT business_plans_approved_financial_snapshot_fk FOREIGN KEY (approved_financial_snapshot_id) REFERENCES financial_snapshots(id);

ALTER TABLE financial_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY financial_snapshots_select_own ON financial_snapshots FOR SELECT USING (EXISTS (SELECT 1 FROM business_plans p WHERE p.id=business_plan_id AND p.user_id=auth.uid()));
CREATE POLICY financial_snapshots_insert_own ON financial_snapshots FOR INSERT WITH CHECK (approved_by=auth.uid() AND EXISTS (SELECT 1 FROM business_plans p WHERE p.id=business_plan_id AND p.user_id=auth.uid()));

CREATE FUNCTION prevent_financial_snapshot_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Approved financial snapshots are immutable'; END; $$;
CREATE TRIGGER financial_snapshots_immutable BEFORE UPDATE OR DELETE ON financial_snapshots FOR EACH ROW EXECUTE FUNCTION prevent_financial_snapshot_mutation();

-- The application passes a server-recalculated package. The transaction lock, owner check,
-- stale hash comparison and unique idempotency key make approval atomic and retry-safe.
CREATE FUNCTION approve_financial_snapshot(
  p_business_plan_id uuid,p_expected_hash text,p_model_version text,p_analysis_version text,
  p_projection_start_date date,p_projection_months integer,p_currency text,p_assumptions jsonb,
  p_projection jsonb,p_statements jsonb,p_analysis jsonb,p_warnings jsonb,p_warning_codes jsonb
) RETURNS financial_snapshots LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_plan business_plans; v_snapshot financial_snapshots; v_version integer;
BEGIN
  SELECT * INTO v_plan FROM business_plans WHERE id=p_business_plan_id FOR UPDATE;
  IF v_plan.user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF v_plan.current_financial_assumptions_hash IS DISTINCT FROM p_expected_hash THEN RAISE EXCEPTION 'Financial assumptions changed while you were reviewing them. Refresh the financial review before approving.'; END IF;
  SELECT * INTO v_snapshot FROM financial_snapshots WHERE business_plan_id=p_business_plan_id AND assumptions_hash=p_expected_hash AND financial_model_version=p_model_version AND financial_analysis_version=p_analysis_version;
  IF FOUND THEN RETURN v_snapshot; END IF;
  SELECT COALESCE(MAX(snapshot_version),0)+1 INTO v_version FROM financial_snapshots WHERE business_plan_id=p_business_plan_id;
  INSERT INTO financial_snapshots(business_plan_id,snapshot_version,financial_model_version,financial_analysis_version,assumptions_hash,approved_by,projection_start_date,projection_months,currency,assumptions_json,projection_json,statements_json,analysis_json,warnings_json,warning_codes_acknowledged)
  VALUES(p_business_plan_id,v_version,p_model_version,p_analysis_version,p_expected_hash,auth.uid(),p_projection_start_date,p_projection_months,p_currency,p_assumptions,p_projection,p_statements,p_analysis,p_warnings,p_warning_codes) RETURNING * INTO v_snapshot;
  UPDATE business_plans SET financial_status='approved',approved_financial_snapshot_id=v_snapshot.id WHERE id=p_business_plan_id;
  RETURN v_snapshot;
END $$;
REVOKE ALL ON FUNCTION approve_financial_snapshot(uuid,text,text,text,date,integer,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION approve_financial_snapshot(uuid,text,text,text,date,integer,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb) TO authenticated;
COMMIT;

-- ============================================================================
-- SOURCE: migrations/20260812040000_create_business_plan_generation.sql
-- ============================================================================
-- Schema dumps intentionally clear search_path. Restore it before every source
-- because application migrations use unqualified public object names.
set search_path = public, extensions;
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

-- ============================================================================
-- SOURCE: migrations/20260812050000_business_plan_editor_workflow.sql
-- ============================================================================
-- Schema dumps intentionally clear search_path. Restore it before every source
-- because application migrations use unqualified public object names.
set search_path = public, extensions;
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

-- ============================================================================
-- SOURCE: migrations/20260812060000_business_plan_exports.sql
-- ============================================================================
-- Schema dumps intentionally clear search_path. Restore it before every source
-- because application migrations use unqualified public object names.
set search_path = public, extensions;
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

-- ============================================================================
-- SOURCE: migrations/20260812070000_plan_payments_and_entitlements.sql
-- ============================================================================
-- Schema dumps intentionally clear search_path. Restore it before every source
-- because application migrations use unqualified public object names.
set search_path = public, extensions;
create type public.plan_payment_status as enum ('checkout_started','paid','payment_failed','refunded','disputed');
create type public.plan_entitlement_status as enum ('active','suspended','revoked');
create table public.stripe_customers(user_id uuid primary key references auth.users(id) on delete cascade,stripe_customer_id text not null unique,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.payments(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),business_plan_id uuid not null references public.business_plans(id),product_key text not null,stripe_customer_id text,stripe_checkout_session_id text not null unique,stripe_payment_intent_id text unique,stripe_charge_id text,stripe_price_id text not null,amount bigint check(amount>=0),currency text,payment_status public.plan_payment_status not null default 'checkout_started',paid_at timestamptz,refunded_at timestamptz,refund_amount bigint not null default 0 check(refund_amount>=0),dispute_status text,receipt_url text,metadata_json jsonb not null default '{}'::jsonb,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index payments_user_created_idx on public.payments(user_id,created_at desc);create index payments_plan_idx on public.payments(business_plan_id);
create table public.plan_entitlements(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),business_plan_id uuid not null references public.business_plans(id),entitlement_key text not null,source_type text not null check(source_type in ('payment','subscription','admin_grant','promotion')),source_payment_id uuid references public.payments(id),status public.plan_entitlement_status not null,granted_at timestamptz not null default now(),revoked_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(user_id,business_plan_id,entitlement_key,source_payment_id));
create index active_plan_entitlements_idx on public.plan_entitlements(user_id,business_plan_id,entitlement_key) where status='active';
create table public.stripe_webhook_events(stripe_event_id text primary key,event_type text not null,processing_status text not null check(processing_status in ('processing','processed','failed')),processed_at timestamptz,error_message text,created_at timestamptz not null default now());
alter table public.stripe_customers enable row level security;alter table public.payments enable row level security;alter table public.plan_entitlements enable row level security;alter table public.stripe_webhook_events enable row level security;
create policy "customers read own" on public.stripe_customers for select using(auth.uid()=user_id);create policy "payments read own" on public.payments for select using(auth.uid()=user_id);create policy "entitlements read own" on public.plan_entitlements for select using(auth.uid()=user_id);
-- No client write policies: payment and entitlement writes require the service role.

-- ============================================================================
-- SOURCE: migrations/20260812080000_admin_operations.sql
-- ============================================================================
-- Schema dumps intentionally clear search_path. Restore it before every source
-- because application migrations use unqualified public object names.
set search_path = public, extensions;
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

-- ============================================================================
-- SOURCE: migrations/20260812090000_allow_plan_owner_delete.sql
-- ============================================================================
-- Schema dumps intentionally clear search_path. Restore it before every source
-- because application migrations use unqualified public object names.
set search_path = public, extensions;
begin;
create policy "users delete own plans" on public.business_plans
for delete using (user_id = auth.uid());
commit;

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
