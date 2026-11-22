import { useMemo, useState } from 'react';
import { buildForecast, MAX_FORECAST_MONTHS, monthsBetween } from '@/lib/forecast';
import { currentMonthKey, formatCents, shiftMonth } from '@/lib/money';
import { inputClass } from '@/lib/styles';
import type { Category, RecurringExpense } from '@/types';

interface ForecastViewProps {
  recurring: RecurringExpense[];
  categories: Category[];
}

function formatShortMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(year, monthNumber - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function validateRange(from: string, to: string): string | null {
  if (!from || !to) return 'Choose both a start and an end month.';
  if (monthsBetween(from, to) < 0) return 'The end month must be after the start month.';
  if (monthsBetween(from, to) + 1 > MAX_FORECAST_MONTHS) {
    return `Choose a range of ${MAX_FORECAST_MONTHS} months or fewer.`;
  }
  return null;
}

function AmountCell({ cents, strong = false }: { cents: number | undefined; strong?: boolean }) {
  if (cents === undefined) {
    return <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-300">-</td>;
  }
  return (
    <td
      className={`whitespace-nowrap px-4 py-3 text-right tabular-nums ${strong ? 'font-semibold text-slate-900' : 'text-slate-700'}`}
    >
      {formatCents(cents)}
    </td>
  );
}

export default function ForecastView({ recurring, categories }: ForecastViewProps) {
  const [fromMonth, setFromMonth] = useState(currentMonthKey);
  const [toMonth, setToMonth] = useState(() => shiftMonth(currentMonthKey(), 11));
  const rangeError = validateRange(fromMonth, toMonth);

  const forecast = useMemo(
    () => (rangeError ? null : buildForecast(recurring, categories, fromMonth, toMonth)),
    [recurring, categories, fromMonth, toMonth, rangeError],
  );

  const columnCount = (forecast?.months.length ?? 0) + 2;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Expected expenses</h2>
          <p className="text-sm text-slate-500">
            Upcoming recurring payments for the months you choose, grouped by category.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:flex">
          <div>
            <label htmlFor="forecast-from" className="mb-1.5 block text-sm font-medium text-slate-700">
              From
            </label>
            <input
              id="forecast-from"
              type="month"
              value={fromMonth}
              onChange={(event) => setFromMonth(event.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="forecast-to" className="mb-1.5 block text-sm font-medium text-slate-700">
              To
            </label>
            <input
              id="forecast-to"
              type="month"
              value={toMonth}
              onChange={(event) => setToMonth(event.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {rangeError && (
        <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {rangeError}
        </p>
      )}

      {forecast && forecast.groups.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="text-sm font-medium text-slate-800">No expected expenses in this range</p>
          <p className="mt-1 text-sm text-slate-500">Recurring expenses scheduled in these months will appear here.</p>
        </div>
      )}

      {forecast && forecast.groups.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th scope="col" className="sticky left-0 z-10 bg-slate-50 px-4 py-3 font-semibold">
                  Expense
                </th>
                {forecast.months.map((month) => (
                  <th key={month} scope="col" className="whitespace-nowrap px-4 py-3 text-right font-semibold">
                    {formatShortMonth(month)}
                  </th>
                ))}
                <th scope="col" className="whitespace-nowrap px-4 py-3 text-right font-semibold">
                  Total
                </th>
              </tr>
            </thead>
            {forecast.groups.map((group) => (
              <tbody key={group.key} className="border-b border-slate-200 last:border-b-0">
                <tr className="bg-white">
                  <th
                    scope="rowgroup"
                    colSpan={columnCount}
                    className="sticky left-0 px-4 pb-1 pt-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: group.color ?? '#94a3b8' }}
                      />
                      {group.name}
                    </span>
                  </th>
                </tr>
                {group.rows.map((row) => (
                  <tr key={row.id} className="transition hover:bg-slate-50">
                    <th scope="row" className="sticky left-0 bg-white px-4 py-2.5 pl-9 text-left font-medium text-slate-900">
                      {row.merchant}
                    </th>
                    {forecast.months.map((month) => (
                      <AmountCell key={month} cents={row.amountByMonth[month]} />
                    ))}
                    <AmountCell cents={row.totalCents} strong />
                  </tr>
                ))}
                <tr className="bg-slate-50/70">
                  <th scope="row" className="sticky left-0 bg-slate-50 px-4 py-2.5 pl-9 text-left text-sm font-semibold text-slate-700">
                    Subtotal
                  </th>
                  {forecast.months.map((month) => (
                    <AmountCell key={month} cents={group.monthTotals[month]} strong />
                  ))}
                  <AmountCell cents={group.totalCents} strong />
                </tr>
              </tbody>
            ))}
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-100">
                <th scope="row" className="sticky left-0 bg-slate-100 px-4 py-3 text-left font-bold text-slate-900">
                  Grand total
                </th>
                {forecast.months.map((month) => (
                  <AmountCell key={month} cents={forecast.monthTotals[month]} strong />
                ))}
                <td className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums text-emerald-700">
                  {formatCents(forecast.totalCents)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
