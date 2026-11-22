/*
# Restore recurring expense functions without currency

Removes the currency-specific version of the recurring expense save function so the app can
create plans again. The app no longer sends a currency.

1. Modified Functions
- `create_recurring_expense`: the version taking a currency argument is removed. The version without
  it is recreated, matching the open-ended plan behaviour.
- `top_up_recurring_expenses`: recreated without currency handling.

2. Security
- Both functions run with the signed-in user's permissions; row level security still applies.
- Anonymous visitors cannot call either function.

3. Important notes
- No tables, columns, or rows are changed or deleted. Existing currency columns keep their default value.
- Statements are idempotent and safe to re-run.
*/

DROP FUNCTION IF EXISTS create_recurring_expense(text, integer, uuid, date, integer, text, text);

CREATE OR REPLACE FUNCTION top_up_recurring_expenses()
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_horizon date := (current_date + make_interval(months => 12))::date;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to update recurring expenses.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO expenses (user_id, merchant, amount_cents, category_id, occurred_on, note, source, recurring_id)
  SELECT
    plan.user_id,
    plan.merchant,
    plan.amount_cents,
    plan.category_id,
    (plan.start_date + make_interval(months => payment.index))::date,
    NULL,
    'manual',
    plan.id
  FROM recurring_expenses AS plan
  CROSS JOIN LATERAL generate_series(
    0,
    GREATEST(
      (EXTRACT(YEAR FROM v_horizon) - EXTRACT(YEAR FROM plan.start_date)) * 12
        + EXTRACT(MONTH FROM v_horizon) - EXTRACT(MONTH FROM plan.start_date),
      0
    )::integer
  ) AS payment(index)
  WHERE plan.total_months IS NULL
    AND (plan.start_date + make_interval(months => payment.index))::date <= v_horizon
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION create_recurring_expense(
  p_merchant text,
  p_amount_cents integer,
  p_category_id uuid,
  p_start_date date,
  p_total_months integer,
  p_note text
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_plan_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to create a recurring expense.' USING ERRCODE = '42501';
  END IF;

  IF p_category_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM categories WHERE id = p_category_id) THEN
    RAISE EXCEPTION 'That category could not be found.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO recurring_expenses (merchant, amount_cents, category_id, start_date, total_months)
  VALUES (p_merchant, p_amount_cents, p_category_id, p_start_date, p_total_months)
  RETURNING id INTO v_plan_id;

  IF p_total_months IS NULL THEN
    PERFORM top_up_recurring_expenses();
    RETURN v_plan_id;
  END IF;

  INSERT INTO expenses (merchant, amount_cents, category_id, occurred_on, note, source, recurring_id)
  SELECT
    p_merchant,
    p_amount_cents,
    p_category_id,
    (p_start_date + make_interval(months => payment.index))::date,
    p_note,
    'manual',
    v_plan_id
  FROM generate_series(0, p_total_months - 1) AS payment(index);

  RETURN v_plan_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION top_up_recurring_expenses() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION top_up_recurring_expenses() TO authenticated;
REVOKE EXECUTE ON FUNCTION create_recurring_expense(text, integer, uuid, date, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION create_recurring_expense(text, integer, uuid, date, integer, text) TO authenticated;
