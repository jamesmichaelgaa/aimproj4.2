import { useMemo, useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import BudgetProgress from '@/components/BudgetProgress';
import { expensesInMonth, spentByCategory } from '@/lib/budgetMath';
import {
  createCategory,
  deleteCategory,
  updateCategoryBudget,
  type ApiResult,
} from '@/lib/budgetApi';
import { inputClass } from '@/lib/styles';
import { formatCents, parseDollarsToCents } from '@/lib/money';
import type { Category, Expense } from '@/types';

interface BudgetsViewProps {
  month: string;
  categories: Category[];
  expenses: Expense[];
  onChanged: () => void;
}

export default function BudgetsView({ month, categories, expenses, onChanged }: BudgetsViewProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#0ea5e9');
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const spentMap = useMemo(() => spentByCategory(expensesInMonth(expenses, month)), [expenses, month]);
  const totalBudget = categories.reduce((sum, category) => sum + category.monthly_budget_cents, 0);

  const handleAdd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setAddError('Please enter a category name.');
      return;
    }
    setAddError(null);
    setAdding(true);
    const result = await createCategory(trimmed, color);
    setAdding(false);
    if (result.ok) {
      setName('');
      onChanged();
    } else {
      setAddError(result.message);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Monthly budgets</h2>
            <p className="text-sm text-slate-500">Set a spending limit for each category. Leave blank for no limit.</p>
          </div>
          <p className="text-sm text-slate-600">
            Total budget <span className="font-semibold text-slate-900">{totalBudget > 0 ? formatCents(totalBudget) : 'not set'}</span>
          </p>
        </div>

        <ul className="mt-6 divide-y divide-slate-100">
          {categories.map((category) => (
            <CategoryBudgetRow
              key={category.id}
              category={category}
              spentCents={spentMap.get(category.id) ?? 0}
              onChanged={onChanged}
            />
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <h2 className="text-base font-semibold text-slate-900">Add a category</h2>
        <form onSubmit={handleAdd} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            aria-label="Category name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Subscriptions"
            maxLength={40}
            className={`${inputClass} flex-1`}
          />
          <input
            type="color"
            aria-label="Category color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
            className="h-10 w-14 cursor-pointer rounded-xl border border-slate-200 bg-white p-1"
          />
          <button
            type="submit"
            disabled={adding}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            {adding ? 'Adding...' : 'Add category'}
          </button>
        </form>
        {addError && (
          <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {addError}
          </p>
        )}
      </section>
    </div>
  );
}

interface CategoryBudgetRowProps {
  category: Category;
  spentCents: number;
  onChanged: () => void;
}

function CategoryBudgetRow({ category, spentCents, onChanged }: CategoryBudgetRowProps) {
  const initialBudget = category.monthly_budget_cents > 0 ? (category.monthly_budget_cents / 100).toFixed(2) : '';
  const [budgetInput, setBudgetInput] = useState(initialBudget);
  const [rowError, setRowError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const dirty = budgetInput !== initialBudget;

  const finish = (result: ApiResult) => {
    setSaving(false);
    if (result.ok) {
      onChanged();
    } else {
      setRowError(result.message);
    }
  };

  const handleSave = async () => {
    const trimmed = budgetInput.trim();
    let cents = 0;
    if (trimmed) {
      const parsed = parseDollarsToCents(trimmed);
      if (parsed === null) {
        setRowError('Enter a budget such as 400 or 400.00.');
        return;
      }
      cents = parsed;
    }
    setRowError(null);
    setSaving(true);
    finish(await updateCategoryBudget(category.id, cents));
  };

  const handleDelete = async () => {
    setSaving(true);
    finish(await deleteCategory(category.id));
  };

  return (
    <li className="py-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">{category.name}</p>
            <p className="text-xs text-slate-500">Spent this month: {formatCents(spentCents)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor={`budget-${category.id}`}>
            Monthly budget for {category.name}
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
            <input
              id={`budget-${category.id}`}
              inputMode="decimal"
              value={budgetInput}
              onChange={(event) => setBudgetInput(event.target.value)}
              placeholder="No limit"
              className={`${inputClass} w-36 pl-7`}
            />
          </div>
          {dirty && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          )}
          {confirmingDelete ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-60"
            >
              Confirm
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              aria-label={`Delete ${category.name}`}
              className="rounded-xl p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {category.monthly_budget_cents > 0 && (
        <div className="mt-3 md:max-w-md">
          <BudgetProgress spentCents={spentCents} budgetCents={category.monthly_budget_cents} />
        </div>
      )}

      {rowError && (
        <p role="alert" className="mt-2 text-sm text-rose-700">
          {rowError}
        </p>
      )}
    </li>
  );
}
