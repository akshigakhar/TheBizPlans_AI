BEGIN;

-- Multiple assumption records may belong to one plan; schedules are deterministic outputs.
CREATE TABLE loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_plan_id uuid NOT NULL REFERENCES business_plans (id) ON DELETE CASCADE,
  loan_name text NOT NULL CHECK (btrim(loan_name) <> ''),
  lender_name text,
  original_principal numeric(15,2) NOT NULL CHECK (original_principal > 0),
  annual_interest_rate numeric(9,6) NOT NULL CHECK (annual_interest_rate >= 0),
  amortization_months integer NOT NULL CHECK (amortization_months >= 1),
  term_months integer CHECK (term_months >= 1),
  payment_frequency text NOT NULL DEFAULT 'monthly' CHECK (payment_frequency = 'monthly'),
  loan_start_month integer NOT NULL CHECK (loan_start_month BETWEEN 1 AND 36),
  interest_only_months integer NOT NULL DEFAULT 0 CHECK (interest_only_months >= 0),
  balloon_payment numeric(15,2) CHECK (balloon_payment >= 0),
  financing_fee numeric(15,2) CHECK (financing_fee >= 0),
  existing_or_proposed text NOT NULL CHECK (existing_or_proposed IN ('existing', 'proposed')),
  notes text NOT NULL DEFAULT '',
  display_order integer NOT NULL CHECK (display_order >= 1),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (business_plan_id, display_order)
);

CREATE INDEX loans_business_plan_id_idx ON loans (business_plan_id);

COMMIT;
