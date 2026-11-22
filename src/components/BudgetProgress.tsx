import { formatCents } from '@/lib/money';
import { budgetState, type BudgetState } from '@/lib/budgetMath';

const BAR_STYLES: Record<BudgetState, string> = {
  none: 'bg-slate-300',
  healthy: 'bg-emerald-500',
  warning: 'bg-amber-500',
  over: 'bg-rose-500',
};

const LABEL_STYLES: Record<BudgetState, string> = {
  none: 'text-slate-500',
  healthy: 'text-emerald-700',
  warning: 'text-amber-700',
  over: 'text-rose-700',
};

interface BudgetProgressProps {
  spentCents: number;
  budgetCents: number;
}

export default function BudgetProgress({ spentCents, budgetCents }: BudgetProgressProps) {
  const state = budgetState(spentCents, budgetCents);
  const percent = budgetCents > 0 ? Math.min(100, Math.round((spentCents / budgetCents) * 100)) : 0;
  const remaining = budgetCents - spentCents;

  let caption = 'No budget set';
  if (state !== 'none') {
    caption = remaining >= 0 ? `${formatCents(remaining)} left of ${formatCents(budgetCents)}` : `${formatCents(-remaining)} over budget`;
  }

  return (
    <div className="space-y-1.5">
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${BAR_STYLES[state]}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className={`text-xs font-medium ${LABEL_STYLES[state]}`}>{caption}</p>
    </div>
  );
}
