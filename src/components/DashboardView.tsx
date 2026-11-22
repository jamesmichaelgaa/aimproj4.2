import { useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, Download, Receipt, Target, Wallet } from 'lucide-react';
import BudgetProgress from '@/components/BudgetProgress';
import SourceBadge from '@/components/SourceBadge';
import { expensesInMonth, spentByCategory, totalCents } from '@/lib/budgetMath';
import { formatCents, formatDay, formatMonthLabel } from '@/lib/money';
import { downloadMonthlyReport } from '@/lib/reportPdf';
import type { Category, Expense } from '@/types';

interface DashboardViewProps {
  month: string;
  categories: Category[];
  expenses: Expense[];
}

export default function DashboardView({ month, categories, expenses }: DashboardViewProps) {
  const monthExpenses = useMemo(() => expensesInMonth(expenses, month), [expenses, month]);
  const spentMap = useMemo(() => spentByCategory(monthExpenses), [monthExpenses]);

  const spent = totalCents(monthExpenses);
  const budget = categories.reduce((sum, category) => sum + category.monthly_budget_cents, 0);
  const remaining = budget - spent;
  const automatedCount = monthExpenses.filter((expense) => expense.source !== 'manual').length;

  const breakdown = categories
    .filter((category) => category.monthly_budget_cents > 0 || spentMap.has(category.id))
    .sort((a, b) => (spentMap.get(b.id) ?? 0) - (spentMap.get(a.id) ?? 0));
  const uncategorized = spentMap.get(null) ?? 0;
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  const stats = [
    { label: 'Spent this month', value: formatCents(spent), icon: Wallet, tone: 'text-slate-900' },
    { label: 'Monthly budget', value: budget > 0 ? formatCents(budget) : 'Not set', icon: Target, tone: 'text-slate-900' },
    {
      label: remaining >= 0 ? 'Left to spend' : 'Over budget',
      value: budget > 0 ? formatCents(Math.abs(remaining)) : '--',
      icon: remaining >= 0 ? ArrowDownRight : ArrowUpRight,
      tone: budget > 0 && remaining < 0 ? 'text-rose-600' : 'text-emerald-600',
    },
    { label: 'Captured automatically', value: String(automatedCount), icon: Receipt, tone: 'text-slate-900' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{formatMonthLabel(month)}</h2>
          <p className="text-sm text-slate-500">A snapshot of your spending and budgets.</p>
        </div>
        <button
          type="button"
          onClick={() => downloadMonthlyReport({ month, categories, expenses: monthExpenses })}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
        >
          <Download className="h-4 w-4" />
          Download PDF report
        </button>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {stats.map(({ label, value, icon: Icon, tone }, index) => (
          <div
            key={label}
            style={{ animationDelay: `${index * 60}ms` }}
            className="animate-[fadeUp_400ms_ease-out_both] rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-500 md:text-sm">{label}</p>
              <Icon className="h-4 w-4 text-slate-400" />
            </div>
            <p className={`mt-2 text-xl font-semibold tracking-tight md:text-2xl ${tone}`}>{value}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6 lg:col-span-3">
          <h2 className="text-base font-semibold text-slate-900">Where it went</h2>
          <p className="mt-1 text-sm text-slate-500">Spending by category against each monthly budget.</p>

          {breakdown.length === 0 && uncategorized === 0 ? (
            <p className="mt-8 pb-6 text-center text-sm text-slate-500">No spending recorded this month yet.</p>
          ) : (
            <ul className="mt-5 space-y-5">
              {breakdown.map((category) => (
                <li key={category.id} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: category.color }} />
                      <span className="text-sm font-medium text-slate-800">{category.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-900">
                      {formatCents(spentMap.get(category.id) ?? 0)}
                    </span>
                  </div>
                  <BudgetProgress
                    spentCents={spentMap.get(category.id) ?? 0}
                    budgetCents={category.monthly_budget_cents}
                  />
                </li>
              ))}
              {uncategorized > 0 && (
                <li className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Uncategorized</span>
                  <span className="font-semibold text-slate-900">{formatCents(uncategorized)}</span>
                </li>
              )}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6 lg:col-span-2">
          <h2 className="text-base font-semibold text-slate-900">Recent activity</h2>
          <p className="mt-1 text-sm text-slate-500">The latest charges for this month.</p>

          {monthExpenses.length === 0 ? (
            <p className="mt-8 pb-6 text-center text-sm text-slate-500">Nothing here yet.</p>
          ) : (
            <ul className="mt-5 divide-y divide-slate-100">
              {monthExpenses.slice(0, 6).map((expense) => {
                const category = expense.category_id ? categoryById.get(expense.category_id) : undefined;
                return (
                  <li key={expense.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{expense.merchant}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span>{formatDay(expense.occurred_on)}</span>
                        {category && <span>{category.name}</span>}
                        <SourceBadge source={expense.source} />
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-slate-900">
                      {formatCents(expense.amount_cents)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
