import { monthRange } from '@/lib/money';
import type { Expense } from '@/types';

export function expensesInMonth(expenses: Expense[], month: string): Expense[] {
  const { start, end } = monthRange(month);
  return expenses.filter((expense) => expense.occurred_on >= start && expense.occurred_on <= end);
}

export function totalCents(expenses: Expense[]): number {
  return expenses.reduce((sum, expense) => sum + expense.amount_cents, 0);
}

export function spentByCategory(expenses: Expense[]): Map<string | null, number> {
  const totals = new Map<string | null, number>();
  for (const expense of expenses) {
    totals.set(expense.category_id, (totals.get(expense.category_id) ?? 0) + expense.amount_cents);
  }
  return totals;
}

export type BudgetState = 'none' | 'healthy' | 'warning' | 'over';

export function budgetState(spent: number, budget: number): BudgetState {
  if (budget <= 0) return 'none';
  const ratio = spent / budget;
  if (ratio > 1) return 'over';
  if (ratio >= 0.8) return 'warning';
  return 'healthy';
}
