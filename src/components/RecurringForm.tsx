import { useState, type FormEvent } from 'react';
import Modal from '@/components/Modal';
import { createRecurringExpense } from '@/lib/budgetApi';
import { inputClass } from '@/lib/styles';
import { formatCents, formatDay, occurrenceDate, parseDollarsToCents, todayISO } from '@/lib/money';
import type { Category } from '@/types';

const MAX_MONTHS = 120;

interface RecurringFormProps {
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}

function parseMonths(value: string): number | null {
  const months = Number(value);
  return Number.isInteger(months) && months >= 1 && months <= MAX_MONTHS ? months : null;
}

export default function RecurringForm({ categories, onClose, onSaved }: RecurringFormProps) {
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [startDate, setStartDate] = useState(todayISO());
  const [months, setMonths] = useState('12');
  const [indefinite, setIndefinite] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const amountCents = parseDollarsToCents(amount);
  const monthCount = parseMonths(months);
  const showPreview = amountCents !== null && (indefinite || monthCount !== null) && Boolean(startDate);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedMerchant = merchant.trim();
    if (!trimmedMerchant) {
      setFormError('Please enter what the payment is for.');
      return;
    }
    if (amountCents === null) {
      setFormError('Please enter a monthly amount greater than zero, such as 1200.00.');
      return;
    }
    if (!startDate) {
      setFormError('Please choose the first payment date.');
      return;
    }
    if (!indefinite && monthCount === null) {
      setFormError(`Enter how many months it runs, from 1 to ${MAX_MONTHS}, or choose runs indefinitely.`);
      return;
    }

    setFormError(null);
    setSaving(true);
    const result = await createRecurringExpense({
      merchant: trimmedMerchant,
      amount_cents: amountCents,
      category_id: categoryId || null,
      start_date: startDate,
      total_months: indefinite ? null : monthCount,
    });
    if (result.ok) {
      onSaved();
    } else {
      setFormError(result.message);
      setSaving(false);
    }
  };

  return (
    <Modal title="Add recurring expense" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="recurring-merchant" className="mb-1.5 block text-sm font-medium text-slate-700">
            What is it for
          </label>
          <input
            id="recurring-merchant"
            value={merchant}
            onChange={(event) => setMerchant(event.target.value)}
            placeholder="Apartment rent"
            maxLength={80}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="recurring-amount" className="mb-1.5 block text-sm font-medium text-slate-700">
            Monthly amount
          </label>
          <input
            id="recurring-amount"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="recurring-months" className="mb-1.5 block text-sm font-medium text-slate-700">
              Number of months
            </label>
            <input
              id="recurring-months"
              type="number"
              min={1}
              max={MAX_MONTHS}
              value={months}
              disabled={indefinite}
              onChange={(event) => setMonths(event.target.value)}
              className={`${inputClass} disabled:bg-slate-100 disabled:text-slate-400`}
            />
            <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={indefinite}
                onChange={(event) => setIndefinite(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              Runs indefinitely
            </label>
          </div>
          <div>
            <label htmlFor="recurring-start" className="mb-1.5 block text-sm font-medium text-slate-700">
              First payment
            </label>
            <input
              id="recurring-start"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label htmlFor="recurring-category" className="mb-1.5 block text-sm font-medium text-slate-700">
            Category
          </label>
          <select
            id="recurring-category"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className={inputClass}
          >
            <option value="">Uncategorized</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        {showPreview && amountCents !== null && indefinite && (
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <p>
              <span className="font-semibold">{formatCents(amountCents)}</span> every month, starting{' '}
              {formatDay(startDate)}, until you stop it.
            </p>
            <p className="mt-1 text-slate-500">Upcoming payments are added automatically.</p>
          </div>
        )}
        {showPreview && amountCents !== null && monthCount !== null && !indefinite && (
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <p>
              Creates <span className="font-semibold">{monthCount}</span>{' '}
              {monthCount === 1 ? 'payment' : 'payments'} of{' '}
              <span className="font-semibold">{formatCents(amountCents)}</span>, from{' '}
              {formatDay(occurrenceDate(startDate, 0))} to {formatDay(occurrenceDate(startDate, monthCount - 1))}.
            </p>
            <p className="mt-1 text-slate-500">Total: {formatCents(amountCents * monthCount)}</p>
          </div>
        )}

        {formError && (
          <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {formError}
          </p>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Create schedule'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
