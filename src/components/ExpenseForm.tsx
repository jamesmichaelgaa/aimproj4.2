import { useState, type FormEvent } from 'react';
import Modal from '@/components/Modal';
import { createExpense, deleteExpense, updateExpense, type ApiResult } from '@/lib/budgetApi';
import { inputClass } from '@/lib/styles';
import { parseDollarsToCents, todayISO } from '@/lib/money';
import type { Category, Expense } from '@/types';

interface ExpenseFormProps {
  expense: Expense | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}

export default function ExpenseForm({ expense, categories, onClose, onSaved }: ExpenseFormProps) {
  const [merchant, setMerchant] = useState(expense?.merchant ?? '');
  const [amount, setAmount] = useState(expense ? (expense.amount_cents / 100).toFixed(2) : '');
  const [occurredOn, setOccurredOn] = useState(expense?.occurred_on ?? todayISO());
  const [categoryId, setCategoryId] = useState(expense?.category_id ?? '');
  const [note, setNote] = useState(expense?.note ?? '');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const handleResult = (result: ApiResult) => {
    if (result.ok) {
      onSaved();
    } else {
      setFormError(result.message);
      setSaving(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedMerchant = merchant.trim();
    const amountCents = parseDollarsToCents(amount);

    if (!trimmedMerchant) {
      setFormError('Please enter where the money was spent.');
      return;
    }
    if (amountCents === null) {
      setFormError('Please enter an amount greater than zero, such as 12.50.');
      return;
    }
    if (!occurredOn) {
      setFormError('Please choose a date.');
      return;
    }

    setFormError(null);
    setSaving(true);
    const input = {
      merchant: trimmedMerchant,
      amount_cents: amountCents,
      category_id: categoryId || null,
      occurred_on: occurredOn,
      note: note.trim() || null,
    };
    handleResult(expense ? await updateExpense(expense.id, input) : await createExpense(input));
  };

  const handleDelete = async () => {
    if (!expense) return;
    setSaving(true);
    handleResult(await deleteExpense(expense.id));
  };

  return (
    <Modal title={expense ? 'Edit expense' : 'Add expense'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="expense-merchant" className="mb-1.5 block text-sm font-medium text-slate-700">
            Merchant
          </label>
          <input
            id="expense-merchant"
            value={merchant}
            onChange={(event) => setMerchant(event.target.value)}
            placeholder="Blue Bottle Coffee"
            maxLength={80}
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="expense-amount" className="mb-1.5 block text-sm font-medium text-slate-700">
              Amount
            </label>
            <input
              id="expense-amount"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="expense-date" className="mb-1.5 block text-sm font-medium text-slate-700">
              Date
            </label>
            <input
              id="expense-date"
              type="date"
              value={occurredOn}
              onChange={(event) => setOccurredOn(event.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label htmlFor="expense-category" className="mb-1.5 block text-sm font-medium text-slate-700">
            Category
          </label>
          <select
            id="expense-category"
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

        <div>
          <label htmlFor="expense-note" className="mb-1.5 block text-sm font-medium text-slate-700">
            Note <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea
            id="expense-note"
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className={inputClass}
          />
        </div>

        {formError && (
          <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {formError}
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
          {expense ? (
            confirmingDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Delete this expense?</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-60"
                >
                  Yes, delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="text-sm font-medium text-rose-600 transition hover:text-rose-700"
              >
                Delete expense
              </button>
            )
          ) : (
            <span />
          )}

          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Saving...' : expense ? 'Save changes' : 'Add expense'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
