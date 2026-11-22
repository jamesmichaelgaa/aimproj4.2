import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import ExpenseForm from '@/components/ExpenseForm';
import SourceBadge from '@/components/SourceBadge';
import { expensesInMonth, totalCents } from '@/lib/budgetMath';
import { formatCents, formatDay } from '@/lib/money';
import type { Category, Expense } from '@/types';

const UNCATEGORIZED = 'uncategorized';

interface ExpensesViewProps {
  month: string;
  categories: Category[];
  expenses: Expense[];
  onChanged: () => void;
}

export default function ExpensesView({ month, categories, expenses, onChanged }: ExpensesViewProps) {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [editing, setEditing] = useState<Expense | 'new' | null>(null);

  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return expensesInMonth(expenses, month).filter((expense) => {
      if (categoryFilter === UNCATEGORIZED && expense.category_id !== null) return false;
      if (categoryFilter !== 'all' && categoryFilter !== UNCATEGORIZED && expense.category_id !== categoryFilter) {
        return false;
      }
      if (needle && !expense.merchant.toLowerCase().includes(needle) && !(expense.note ?? '').toLowerCase().includes(needle)) {
        return false;
      }
      return true;
    });
  }, [expenses, month, query, categoryFilter]);

  const filteredTotal = totalCents(filtered);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Expenses</h2>
          <p className="text-sm text-slate-500">
            {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'} totaling {formatCents(filteredTotal)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          Add expense
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search merchant or note"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </label>
        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          aria-label="Filter by category"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        >
          <option value="all">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
          <option value={UNCATEGORIZED}>Uncategorized</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="text-sm font-medium text-slate-800">No expenses match</p>
          <p className="mt-1 text-sm text-slate-500">Try another month or clear your filters, or add an expense.</p>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {filtered.map((expense) => {
            const category = expense.category_id ? categoryById.get(expense.category_id) : undefined;
            return (
              <li key={expense.id} className="border-b border-slate-100 last:border-b-0">
                <button
                  type="button"
                  onClick={() => setEditing(expense)}
                  className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition hover:bg-slate-50 focus:bg-slate-50 focus:outline-none md:px-5"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-medium text-slate-900">{expense.merchant}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>{formatDay(expense.occurred_on)}</span>
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: category?.color ?? '#cbd5e1' }}
                        />
                        {category?.name ?? 'Uncategorized'}
                      </span>
                      <SourceBadge source={expense.source} />
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-slate-900">
                    {formatCents(expense.amount_cents)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <ExpenseForm
          expense={editing === 'new' ? null : editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
}
