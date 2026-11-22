import { supabase } from '@/lib/supabase';

export interface ExpenseInput {
  merchant: string;
  amount_cents: number;
  category_id: string | null;
  occurred_on: string;
  note: string | null;
}

export type ApiResult = { ok: true } | { ok: false; message: string };

const GENERIC_ERROR = 'Something went wrong. Please try again.';

function toResult(error: { code?: string; message: string } | null, duplicateMessage?: string): ApiResult {
  if (!error) return { ok: true };
  console.error(error);
  if (duplicateMessage && error.code === '23505') return { ok: false, message: duplicateMessage };
  return { ok: false, message: GENERIC_ERROR };
}

export async function createExpense(input: ExpenseInput): Promise<ApiResult> {
  const { error } = await supabase.from('expenses').insert({ ...input, source: 'manual' });
  return toResult(error);
}

export async function updateExpense(id: string, input: ExpenseInput): Promise<ApiResult> {
  const { error } = await supabase.from('expenses').update(input).eq('id', id);
  return toResult(error);
}

export interface RecurringInput {
  merchant: string;
  amount_cents: number;
  category_id: string | null;
  start_date: string;
  total_months: number | null;
}

export async function createRecurringExpense(input: RecurringInput): Promise<ApiResult> {
  const { error } = await supabase.rpc('create_recurring_expense', {
    p_merchant: input.merchant,
    p_amount_cents: input.amount_cents,
    p_category_id: input.category_id,
    p_start_date: input.start_date,
    p_total_months: input.total_months,
    p_note: null,
  });
  return toResult(error);
}

export async function topUpRecurringExpenses(): Promise<ApiResult> {
  const { error } = await supabase.rpc('top_up_recurring_expenses');
  return toResult(error);
}

export async function cancelRecurringExpense(id: string): Promise<ApiResult> {
  const { error } = await supabase.rpc('cancel_recurring_expense', { p_id: id });
  return toResult(error);
}

export async function deleteExpense(id: string): Promise<ApiResult> {
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  return toResult(error);
}

export async function createCategory(name: string, color: string): Promise<ApiResult> {
  const { error } = await supabase.from('categories').insert({ name, color });
  return toResult(error, 'A category with this name already exists.');
}

export async function updateCategoryBudget(id: string, monthlyBudgetCents: number): Promise<ApiResult> {
  const { error } = await supabase
    .from('categories')
    .update({ monthly_budget_cents: monthlyBudgetCents })
    .eq('id', id);
  return toResult(error);
}

export async function deleteCategory(id: string): Promise<ApiResult> {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  return toResult(error);
}
