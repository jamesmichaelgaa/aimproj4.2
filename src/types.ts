export type ExpenseSource = 'manual' | 'email' | 'sms';

export interface Category {
  id: string;
  name: string;
  color: string;
  monthly_budget_cents: number;
}

export interface Expense {
  id: string;
  merchant: string;
  amount_cents: number;
  category_id: string | null;
  occurred_on: string;
  note: string | null;
  source: ExpenseSource;
  raw_text: string | null;
  recurring_id: string | null;
  created_at: string;
}

export interface RecurringExpense {
  id: string;
  merchant: string;
  amount_cents: number;
  category_id: string | null;
  start_date: string;
  total_months: number | null;
  created_at: string;
}
