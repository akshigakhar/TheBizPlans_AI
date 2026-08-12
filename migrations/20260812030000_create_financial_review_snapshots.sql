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
