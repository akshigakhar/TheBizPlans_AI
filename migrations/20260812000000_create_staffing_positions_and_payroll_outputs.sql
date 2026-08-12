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
