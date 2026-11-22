import { shiftMonth } from '@/lib/money';
import type { Category, RecurringExpense } from '@/types';

export const MAX_FORECAST_MONTHS = 36;

export interface ForecastRow {
  id: string;
  merchant: string;
  amountByMonth: Record<string, number>;
  totalCents: number;
}

export interface ForecastGroup {
  key: string;
  name: string;
  color: string | null;
  rows: ForecastRow[];
  monthTotals: Record<string, number>;
  totalCents: number;
}

export interface Forecast {
  months: string[];
  groups: ForecastGroup[];
  monthTotals: Record<string, number>;
  totalCents: number;
}

export function monthsBetween(from: string, to: string): number {
  const [fromYear, fromMonth] = from.split('-').map(Number);
  const [toYear, toMonth] = to.split('-').map(Number);
  return (toYear - fromYear) * 12 + (toMonth - fromMonth);
}

export function listMonths(from: string, to: string): string[] {
  return Array.from({ length: monthsBetween(from, to) + 1 }, (_, index) => shiftMonth(from, index));
}

function zeroTotals(months: string[]): Record<string, number> {
  return Object.fromEntries(months.map((month) => [month, 0]));
}

function planRow(plan: RecurringExpense, months: string[]): ForecastRow | null {
  const startMonth = plan.start_date.slice(0, 7);
  const amountByMonth: Record<string, number> = {};
  let totalCents = 0;

  for (const month of months) {
    const index = monthsBetween(startMonth, month);
    if (index < 0) continue;
    if (plan.total_months !== null && index >= plan.total_months) continue;
    amountByMonth[month] = plan.amount_cents;
    totalCents += plan.amount_cents;
  }

  return totalCents > 0 ? { id: plan.id, merchant: plan.merchant, amountByMonth, totalCents } : null;
}

export function buildForecast(
  plans: RecurringExpense[],
  categories: Category[],
  fromMonth: string,
  toMonth: string,
): Forecast {
  const months = listMonths(fromMonth, toMonth);
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const groupByKey = new Map<string, ForecastGroup>();

  for (const plan of plans) {
    const row = planRow(plan, months);
    if (!row) continue;

    const category = plan.category_id ? categoryById.get(plan.category_id) : undefined;
    const key = category?.id ?? 'uncategorized';
    let group = groupByKey.get(key);
    if (!group) {
      group = {
        key,
        name: category?.name ?? 'Uncategorized',
        color: category?.color ?? null,
        rows: [],
        monthTotals: zeroTotals(months),
        totalCents: 0,
      };
      groupByKey.set(key, group);
    }

    group.rows.push(row);
    group.totalCents += row.totalCents;
    for (const month of months) {
      if (row.amountByMonth[month] !== undefined) group.monthTotals[month] += row.amountByMonth[month];
    }
  }

  const groups = [...groupByKey.values()]
    .map((group) => ({ ...group, rows: group.rows.sort((a, b) => a.merchant.localeCompare(b.merchant)) }))
    .sort((a, b) => {
      if (a.key === 'uncategorized') return 1;
      if (b.key === 'uncategorized') return -1;
      return a.name.localeCompare(b.name);
    });

  const monthTotals = zeroTotals(months);
  for (const group of groups) {
    for (const month of months) monthTotals[month] += group.monthTotals[month];
  }
  const totalCents = groups.reduce((sum, group) => sum + group.totalCents, 0);

  return { months, groups, monthTotals, totalCents };
}
