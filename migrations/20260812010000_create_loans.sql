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
