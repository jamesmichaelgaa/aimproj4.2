/*
# Add recurring expense create and cancel functions

1. New Functions
- `create_recurring_expense(...)`: saves a recurring plan and creates one scheduled expense for every month of the plan, all in one step. If any part fails, nothing is saved.
- `cancel_recurring_expense(p_id)`: removes a recurring plan and its scheduled payments that have not happened yet. Payments already made stay in the expense history as ordinary expenses.

2. Security
- Both functions run with the signed-in user's permissions, so row level security still decides what they can touch.
- Anonymous visitors cannot call either function.
- Each payment's day is kept within the month. For example, a plan starting January 31 pays on February 28 in a non-leap year.

3. Important notes
- Statements are idempotent and safe to re-run.
- Only future scheduled payments are removed by cancellation. Nothing that has already been paid is deleted.
*/

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

CREATE OR REPLACE FUNCTION cancel_recurring_expense(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  DELETE FROM expenses
  WHERE recurring_id = p_id
    AND occurred_on > current_date;

  DELETE FROM recurring_expenses WHERE id = p_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION create_recurring_expense(text, integer, uuid, date, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION create_recurring_expense(text, integer, uuid, date, integer, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION cancel_recurring_expense(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION cancel_recurring_expense(uuid) TO authenticated;
