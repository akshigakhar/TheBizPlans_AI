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
