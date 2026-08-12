BEGIN;

-- User-entered assumptions. No calculated payroll values are stored here.
CREATE TABLE staffing_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_plan_id uuid NOT NULL REFERENCES business_plans (id) ON DELETE CASCADE,
  job_title text NOT NULL CHECK (btrim(job_title) <> ''),
  department text,
  number_of_employees integer NOT NULL CHECK (number_of_employees >= 1),
  compensation_type text NOT NULL CHECK (compensation_type IN ('hourly', 'salaried', 'owner_unpaid', 'contractor')),
  hourly_wage numeric(15,2), weekly_hours numeric(8,2), annual_salary numeric(15,2),
  contractor_payment_type text CHECK (contractor_payment_type IN ('fixed_monthly', 'hourly')),
  contractor_monthly_amount numeric(15,2), contractor_hourly_rate numeric(15,2), contractor_monthly_hours numeric(8,2),
  start_month integer NOT NULL CHECK (start_month BETWEEN 1 AND 36),
  end_month integer CHECK (end_month BETWEEN 1 AND 36),
  annual_salary_increase_percentage numeric(7,4) NOT NULL DEFAULT 0 CHECK (annual_salary_increase_percentage >= 0),
  employer_payroll_burden_percentage numeric(7,4) NOT NULL DEFAULT 0 CHECK (employer_payroll_burden_percentage >= 0),
  monthly_benefits_per_employee numeric(15,2) NOT NULL DEFAULT 0 CHECK (monthly_benefits_per_employee >= 0),
  annual_bonus_per_employee numeric(15,2) NOT NULL DEFAULT 0 CHECK (annual_bonus_per_employee >= 0),
  notes text NOT NULL DEFAULT '',
  display_order integer NOT NULL CHECK (display_order >= 1),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (end_month IS NULL OR end_month >= start_month),
  CHECK (
    (compensation_type = 'hourly' AND hourly_wage >= 0 AND weekly_hours >= 0 AND annual_salary IS NULL AND contractor_payment_type IS NULL)
    OR (compensation_type = 'salaried' AND annual_salary >= 0 AND hourly_wage IS NULL AND weekly_hours IS NULL AND contractor_payment_type IS NULL)
    OR (compensation_type = 'owner_unpaid' AND hourly_wage IS NULL AND weekly_hours IS NULL AND annual_salary IS NULL AND contractor_payment_type IS NULL)
    OR (compensation_type = 'contractor' AND hourly_wage IS NULL AND weekly_hours IS NULL AND annual_salary IS NULL AND (
      (contractor_payment_type = 'fixed_monthly' AND contractor_monthly_amount >= 0 AND contractor_hourly_rate IS NULL AND contractor_monthly_hours IS NULL)
      OR (contractor_payment_type = 'hourly' AND contractor_monthly_amount IS NULL AND contractor_hourly_rate >= 0 AND contractor_monthly_hours >= 0)
    ))
  ),
  UNIQUE (business_plan_id, display_order)
);
CREATE INDEX staffing_positions_business_plan_id_idx ON staffing_positions (business_plan_id);

-- Materialized deterministic outputs, kept separate so assumptions remain auditable.
CREATE TABLE payroll_monthly_outputs (
  business_plan_id uuid NOT NULL REFERENCES business_plans (id) ON DELETE CASCADE,
  projection_month integer NOT NULL CHECK (projection_month BETWEEN 1 AND 36),
  base_wages numeric(15,2) NOT NULL CHECK (base_wages >= 0),
  employer_costs numeric(15,2) NOT NULL CHECK (employer_costs >= 0),
  benefits numeric(15,2) NOT NULL CHECK (benefits >= 0),
  bonuses numeric(15,2) NOT NULL CHECK (bonuses >= 0),
  total_payroll numeric(15,2) NOT NULL CHECK (total_payroll >= 0),
  headcount integer NOT NULL CHECK (headcount >= 0),
  calculated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (business_plan_id, projection_month)
);

COMMIT;
