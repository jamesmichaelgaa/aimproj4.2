/*
# Allow open-ended (indefinite) recurring expenses

Recurring plans can now run with no end date, for bills like rent. Their payments are scheduled
ahead automatically and kept topped up each time the budget loads.

1. Modified Tables
- `recurring_expenses.total_months` may now be empty (NULL). Empty means the plan runs until stopped.
  Finite plans keep their 1 to 120 month limit.

2. New Functions
- `top_up_recurring_expenses()`: for each signed-in user's open-ended plan, adds any missing monthly
  payments from the first payment date through 12 months from today. Payments that already exist are
  skipped, so running it repeatedly is safe.
- `create_recurring_expense(...)`: now accepts an empty number of months. Open-ended plans get their
  first 12 months of payments immediately. Finite plans behave as before.

3. Indexes
- A unique index on `expenses (recurring_id, occurred_on)` for scheduled payments, so the same payment
  can never be added twice, even if two tabs load at once.

4. Security
- Both functions run with the signed-in user's permissions; row level security still applies.
- Anonymous visitors cannot call either function.

5. Important notes
- Statements are idempotent and safe to re-run.
- No existing rows are changed or deleted.
*/

ALTER TABLE recurring_expenses ALTER COLUMN total_months DROP NOT NULL;
ALTER TABLE recurring_expenses DROP CONSTRAINT IF EXISTS recurring_expenses_total_months_check;
ALTER TABLE recurring_expenses ADD CONSTRAINT recurring_expenses_total_months_check
  CHECK (total_months IS NULL OR total_months BETWEEN 1 AND 120);

CREATE UNIQUE INDEX IF NOT EXISTS expenses_recurring_occurrence_key
  ON expenses (recurring_id, occurred_on)
  WHERE recurring_id IS NOT NULL;

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
