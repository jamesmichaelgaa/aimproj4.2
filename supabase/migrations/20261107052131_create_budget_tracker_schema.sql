/*
# Create budget tracker schema

1. New Tables
- `categories`: spending categories with an optional monthly budget.
  - `id` (uuid, primary key)
  - `name` (text, unique)
  - `color` (text, hex color used in charts and badges)
  - `monthly_budget_cents` (integer, 0 means no budget set)
  - `created_at` (timestamp)
- `expenses`: every spending record, whether typed by hand or captured from an email or SMS.
  - `id` (uuid, primary key)
  - `merchant` (text, where the money went)
  - `amount_cents` (integer, always positive, stored in cents)
  - `category_id` (uuid, optional link to categories)
  - `occurred_on` (date, when the purchase happened)
  - `note` (text, optional)
  - `source` (text, one of manual, email, sms)
  - `raw_text` (text, original notification text when captured automatically)
  - `created_at` (timestamp)
- `app_settings`: small key/value store for app configuration such as the ingest key.

2. Seed data
- Eight default categories are inserted with stable ids.
- A random ingest key is created in `app_settings` if none exists.

3. Security
- Row level security is enabled on all three tables.
- The app has no sign-in, so the anon and authenticated roles can read and write.
- The service role (used by the ingest function) receives the grants it needs.

4. Important notes
- No existing data is modified or removed.
- Every statement is safe to re-run.
*/

CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT '#64748b',
  monthly_budget_cents integer NOT NULL DEFAULT 0 CHECK (monthly_budget_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  occurred_on date NOT NULL DEFAULT current_date,
  note text,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'email', 'sms')),
  raw_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS expenses_occurred_on_idx ON expenses (occurred_on DESC);
CREATE INDEX IF NOT EXISTS expenses_category_id_idx ON expenses (category_id);

CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text NOT NULL
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON categories TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON expenses TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON app_settings TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "anon_select_categories" ON categories;
CREATE POLICY "anon_select_categories" ON categories FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_categories" ON categories;
CREATE POLICY "anon_insert_categories" ON categories FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_categories" ON categories;
CREATE POLICY "anon_update_categories" ON categories FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_categories" ON categories;
CREATE POLICY "anon_delete_categories" ON categories FOR DELETE
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_expenses" ON expenses;
CREATE POLICY "anon_select_expenses" ON expenses FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_expenses" ON expenses;
CREATE POLICY "anon_insert_expenses" ON expenses FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_expenses" ON expenses;
CREATE POLICY "anon_update_expenses" ON expenses FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_expenses" ON expenses;
CREATE POLICY "anon_delete_expenses" ON expenses FOR DELETE
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_app_settings" ON app_settings;
CREATE POLICY "anon_select_app_settings" ON app_settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_app_settings" ON app_settings;
CREATE POLICY "anon_insert_app_settings" ON app_settings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_app_settings" ON app_settings;
CREATE POLICY "anon_update_app_settings" ON app_settings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_app_settings" ON app_settings;
CREATE POLICY "anon_delete_app_settings" ON app_settings FOR DELETE
  TO anon, authenticated USING (true);

INSERT INTO categories (id, name, color) VALUES
  ('11111111-0000-4000-8000-000000000001', 'Groceries', '#16a34a'),
  ('11111111-0000-4000-8000-000000000002', 'Dining', '#ea580c'),
  ('11111111-0000-4000-8000-000000000003', 'Transport', '#0284c7'),
  ('11111111-0000-4000-8000-000000000004', 'Shopping', '#db2777'),
  ('11111111-0000-4000-8000-000000000005', 'Bills', '#7c3aed'),
  ('11111111-0000-4000-8000-000000000006', 'Entertainment', '#ca8a04'),
  ('11111111-0000-4000-8000-000000000007', 'Health', '#0d9488'),
  ('11111111-0000-4000-8000-000000000008', 'Other', '#64748b')
ON CONFLICT (name) DO NOTHING;

INSERT INTO app_settings (key, value)
VALUES ('ingest_key', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
ON CONFLICT (key) DO NOTHING;
