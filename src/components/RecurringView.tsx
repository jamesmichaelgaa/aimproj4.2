import { useMemo, useState } from 'react';
import { CalendarClock, Plus, Trash2 } from 'lucide-react';
import RecurringForm from '@/components/RecurringForm';
import { cancelRecurringExpense, type ApiResult } from '@/lib/budgetApi';
import { formatCents, formatDay, todayISO } from '@/lib/money';
import { totalCents } from '@/lib/budgetMath';
import type { Category, Expense, RecurringExpense } from '@/types';

interface RecurringViewProps {
  categories: Category[];
  expenses: Expense[];
  recurring: RecurringExpense[];
  onChanged: () => void;
}

interface PlanProgress {
  payments: Expense[];
  paidCount: number;
  nextDue: string | null;
  remainingCents: number;
}

function planProgress(payments: Expense[], today: string): PlanProgress {
  const sorted = [...payments].sort((a, b) => a.occurred_on.localeCompare(b.occurred_on));
  const upcoming = sorted.filter((payment) => payment.occurred_on > today);
  return {
    payments: sorted,
    paidCount: sorted.length - upcoming.length,
    nextDue: upcoming[0]?.occurred_on ?? null,
    remainingCents: totalCents(upcoming),
  };
}

export default function RecurringView({ categories, expenses, recurring, onChanged }: RecurringViewProps) {
  const [adding, setAdding] = useState(false);
  const today = todayISO();
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);

  const paymentsByPlan = useMemo(() => {
    const map = new Map<string, Expense[]>();
    for (const expense of expenses) {
      if (!expense.recurring_id) continue;
      map.set(expense.recurring_id, [...(map.get(expense.recurring_id) ?? []), expense]);
    }
    return map;
  }, [expenses]);

  const plans = recurring.map((plan) => ({
    plan,
    progress: planProgress(paymentsByPlan.get(plan.id) ?? [], today),
  }));
  const committedCents = plans
    .filter(({ plan }) => plan.total_months !== null)
    .reduce((sum, { progress }) => sum + progress.remainingCents, 0);
  const activeCount = plans.filter(({ progress }) => progress.nextDue !== null).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Recurring expenses</h2>
          <p className="text-sm text-slate-500">
            Bills that repeat each month, for a set number of months or until you stop them.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          Add recurring expense
        </button>
      </div>

      {plans.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
            <p className="text-xs font-medium text-slate-500 md:text-sm">Active plans</p>
            <p className="mt-2 text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">{activeCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
            <p className="text-xs font-medium text-slate-500 md:text-sm">Still to pay</p>
            <p className="mt-2 text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">
              {formatCents(committedCents)}
            </p>
          </div>
        </div>
      )}

      {plans.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <CalendarClock className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-3 text-sm font-medium text-slate-800">No recurring expenses yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Add rent, a subscription, or a loan repayment and choose how many months it runs.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {plans.map(({ plan, progress }) => (
            <RecurringPlanCard
              key={plan.id}
              plan={plan}
              progress={progress}
              category={plan.category_id ? categoryById.get(plan.category_id) : undefined}
              onChanged={onChanged}
            />
          ))}
        </ul>
      )}

      {adding && (
        <RecurringForm
          categories={categories}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

interface RecurringPlanCardProps {
  plan: RecurringExpense;
  progress: PlanProgress;
  category: Category | undefined;
  onChanged: () => void;
}

function RecurringPlanCard({ plan, progress, category, onChanged }: RecurringPlanCardProps) {
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ongoing = plan.total_months === null;
  const scheduled = progress.payments.length || plan.total_months || 0;
  const percent = scheduled === 0 ? 0 : Math.round((progress.paidCount / scheduled) * 100);
  const completed = !ongoing && progress.nextDue === null;

  const handleCancel = async () => {
    setSaving(true);
    const result: ApiResult = await cancelRecurringExpense(plan.id);
    setSaving(false);
    if (result.ok) {
      onChanged();
    } else {
      setError(result.message);
    }
  };

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-slate-900">{plan.merchant}</h3>
            {category && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: category.color }} />
                {category.name}
              </span>
            )}
            {completed && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                Completed
              </span>
            )}
            {ongoing && (
              <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">Ongoing</span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {formatCents(plan.amount_cents)} per month, starting {formatDay(plan.start_date)}
          </p>
        </div>

        <div className="shrink-0 text-left sm:text-right">
          {ongoing ? (
            <>
              <p className="text-sm font-semibold text-slate-900">{formatCents(plan.amount_cents * progress.paidCount)}</p>
              <p className="text-xs text-slate-500">paid so far, {progress.paidCount} payments</p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-slate-900">{formatCents(plan.amount_cents * scheduled)}</p>
              <p className="text-xs text-slate-500">total over {scheduled} months</p>
            </>
          )}
        </div>
      </div>

      {ongoing ? (
        <div className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-xs font-medium text-slate-600">
          {progress.nextDue ? `Next payment due ${formatDay(progress.nextDue)}` : 'No upcoming payments scheduled.'}
        </div>
      ) : (
        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
            <span>
              {progress.paidCount} of {scheduled} paid
            </span>
            <span>{completed ? 'All payments made' : `Next due ${formatDay(progress.nextDue ?? '')}`}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-700 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <p className="text-xs text-slate-500">
          {ongoing
            ? 'Runs until you stop it.'
            : completed
              ? 'No upcoming payments.'
              : `${formatCents(progress.remainingCents)} still scheduled`}
        </p>
        {!completed &&
          (confirming ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600">Remove upcoming payments?</span>
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-rose-700 disabled:opacity-60"
              >
                {saving ? 'Removing...' : 'Yes, remove'}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
              >
                Keep
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Stop plan
            </button>
          ))}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-rose-700">
          {error}
        </p>
      )}
    </li>
  );
}
