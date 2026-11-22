/*
# Add per-user ownership, recurring expense plans, and per-user ingest keys

This migration turns the single shared budget into one private budget per signed-in person.

1. New Tables
- `recurring_expenses`: a plan for a bill that repeats monthly for a set number of months.
  - `id`, `user_id` (owner, defaults to the signed-in user), `merchant`, `amount_cents`, `category_id`, `start_date`, `total_months` (1 to 120), `created_at`.
- `user_settings`: one row per person holding their private `ingest_key` used by the email and text receiving address.

2. Modified Tables
- `categories` and `expenses` gain a `user_id` owner column that defaults to the signed-in user.
- `categories` no longer requires globally unique names. Each person has their own unique set of names.
- `expenses` gains `recurring_id`, linking each scheduled payment to its recurring plan.
- Existing rows created before this change have no owner, so they are hidden from every account. They are not deleted.

3. Security
- Anonymous visitors lose all access to `categories`, `expenses`, and `app_settings`.
- Signed-in users can only read and change rows they own, enforced by row level security on every verb.
- `app_settings` is left in place with its access removed. It is no longer used.
- `user_settings` lets each person read and create only their own row. The receiving function reads it with the service role.

4. Important notes
- Statements are idempotent and safe to re-run.
- No rows are deleted or rewritten.
*/

CREATE TABLE IF NOT EXISTS recurring_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  merchant text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  start_date date NOT NULL,
  total_months integer NOT NULL CHECK (total_months BETWEEN 1 AND 120),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  ingest_key text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE categories ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS recurring_id uuid REFERENCES recurring_expenses(id) ON DELETE SET NULL;

ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS categories_user_id_name_key ON categories (user_id, name);
CREATE INDEX IF NOT EXISTS expenses_user_id_occurred_on_idx ON expenses (user_id, occurred_on DESC);
CREATE INDEX IF NOT EXISTS expenses_recurring_id_idx ON expenses (recurring_id);
CREATE INDEX IF NOT EXISTS recurring_expenses_user_id_idx ON recurring_expenses (user_id);
CREATE INDEX IF NOT EXISTS user_settings_ingest_key_idx ON user_settings (ingest_key);

ALTER TABLE recurring_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON categories, expenses, app_settings FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON expenses TO authenticated;
GRANT SELECT, INSERT, DELETE ON recurring_expenses TO authenticated;
GRANT SELECT, INSERT ON user_settings TO authenticated;
GRANT SELECT ON user_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON categories TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON expenses TO service_role;

DROP POLICY IF EXISTS "anon_select_categories" ON categories;
DROP POLICY IF EXISTS "anon_insert_categories" ON categories;
DROP POLICY IF EXISTS "anon_update_categories" ON categories;
DROP POLICY IF EXISTS "anon_delete_categories" ON categories;
DROP POLICY IF EXISTS "select_own_categories" ON categories;
CREATE POLICY "select_own_categories" ON categories FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_categories" ON categories;
CREATE POLICY "insert_own_categories" ON categories FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_categories" ON categories;
CREATE POLICY "update_own_categories" ON categories FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_categories" ON categories;
CREATE POLICY "delete_own_categories" ON categories FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "anon_select_expenses" ON expenses;
DROP POLICY IF EXISTS "anon_insert_expenses" ON expenses;
DROP POLICY IF EXISTS "anon_update_expenses" ON expenses;
DROP POLICY IF EXISTS "anon_delete_expenses" ON expenses;
DROP POLICY IF EXISTS "select_own_expenses" ON expenses;
CREATE POLICY "select_own_expenses" ON expenses FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_expenses" ON expenses;
CREATE POLICY "insert_own_expenses" ON expenses FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_expenses" ON expenses;
CREATE POLICY "update_own_expenses" ON expenses FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_expenses" ON expenses;
CREATE POLICY "delete_own_expenses" ON expenses FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "anon_select_app_settings" ON app_settings;
DROP POLICY IF EXISTS "anon_insert_app_settings" ON app_settings;
DROP POLICY IF EXISTS "anon_update_app_settings" ON app_settings;
DROP POLICY IF EXISTS "anon_delete_app_settings" ON app_settings;

DROP POLICY IF EXISTS "select_own_recurring_expenses" ON recurring_expenses;
CREATE POLICY "select_own_recurring_expenses" ON recurring_expenses FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_recurring_expenses" ON recurring_expenses;
CREATE POLICY "insert_own_recurring_expenses" ON recurring_expenses FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_recurring_expenses" ON recurring_expenses;
CREATE POLICY "delete_own_recurring_expenses" ON recurring_expenses FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_own_user_settings" ON user_settings;
CREATE POLICY "select_own_user_settings" ON user_settings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_user_settings" ON user_settings;
CREATE POLICY "insert_own_user_settings" ON user_settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
