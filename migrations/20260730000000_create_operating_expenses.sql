BEGIN;

CREATE TABLE operating_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_plan_id uuid NOT NULL
    REFERENCES business_plans (id) ON DELETE CASCADE,
  expense_name text NOT NULL CHECK (btrim(expense_name) <> ''),
  expense_category text NOT NULL CHECK (btrim(expense_category) <> ''),
  calculation_type text NOT NULL
    CHECK (calculation_type IN ('fixed_amount', 'percentage_of_revenue')),
  fixed_amount numeric(15, 2),
  percentage_rate numeric(7, 4),
  revenue_basis text,
  frequency text,
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
      AND fixed_amount IS NOT NULL AND fixed_amount >= 0
      AND percentage_rate IS NULL AND revenue_basis IS NULL
      AND frequency IN ('monthly', 'quarterly', 'semi_annual', 'annual', 'one_time'))
    OR
    (calculation_type = 'percentage_of_revenue'
      AND fixed_amount IS NULL
      AND percentage_rate IS NOT NULL AND percentage_rate >= 0
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
