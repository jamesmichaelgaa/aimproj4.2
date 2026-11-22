import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { topUpRecurringExpenses } from '@/lib/budgetApi';
import { ensureUserSetup } from '@/lib/userSetup';
import type { Category, Expense, RecurringExpense } from '@/types';

export function useBudgetData(userId: string) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recurring, setRecurring] = useState<RecurringExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const setupDoneFor = useRef<string | null>(null);

  const reload = useCallback(async () => {
    try {
      if (setupDoneFor.current !== userId) {
        await ensureUserSetup(userId);
        setupDoneFor.current = userId;
      }

      const topUp = await topUpRecurringExpenses();
      if (!topUp.ok) throw new Error(topUp.message);

      const [categoryResult, expenseResult, recurringResult] = await Promise.all([
        supabase.from('categories').select('id, name, color, monthly_budget_cents').order('name'),
        supabase
          .from('expenses')
          .select('*')
          .order('occurred_on', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase.from('recurring_expenses').select('*').order('created_at', { ascending: false }),
      ]);

      const failure = categoryResult.error ?? expenseResult.error ?? recurringResult.error;
      if (failure) throw failure;

      setCategories((categoryResult.data ?? []) as Category[]);
      setExpenses((expenseResult.data ?? []) as Expense[]);
      setRecurring((recurringResult.data ?? []) as RecurringExpense[]);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('We could not load your budget. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    reload();
    const handleFocus = () => {
      reload();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [reload]);

  return { categories, expenses, recurring, loading, error, reload };
}
