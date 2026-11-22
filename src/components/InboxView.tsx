import { useEffect, useState, type FormEvent } from 'react';
import { Check, Copy, Send } from 'lucide-react';
import GmailSetup from '@/components/GmailSetup';
import { SUPABASE_URL, supabase } from '@/lib/supabase';
import { formatCents } from '@/lib/money';

interface InboxViewProps {
  userId: string;
  onCaptured: () => void;
}

interface CapturedExpense {
  merchant: string;
  amount_cents: number;
}

function isCapturedExpense(value: unknown): value is CapturedExpense {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.merchant === 'string' && typeof candidate.amount_cents === 'number';
}

const SAMPLE_TEXT = 'Card purchase of $24.50 at Blue Bottle Coffee on card ending 4421.';

export default function InboxView({ userId, onCaptured }: InboxViewProps) {
  const [ingestKey, setIngestKey] = useState<string | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sample, setSample] = useState(SAMPLE_TEXT);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from('user_settings')
        .select('ingest_key')
        .eq('user_id', userId)
        .maybeSingle();
      if (!active) return;
      if (error || !data) {
        console.error(error);
        setKeyError('We could not load your connection details. Try again in a moment.');
        return;
      }
      setIngestKey(data.ingest_key as string);
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  const endpoint = ingestKey ? `${SUPABASE_URL}/functions/v1/ingest-expense?key=${ingestKey}` : null;

  const handleCopy = async () => {
    if (!endpoint) return;
    try {
      await navigator.clipboard.writeText(endpoint);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setResult({ ok: false, message: 'Copying failed. Select the address and copy it manually.' });
    }
  };

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!endpoint || !sample.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sample, source: 'sms' }),
      });
      const body: unknown = await response.json().catch(() => null);
      const errorMessage =
        typeof body === 'object' && body !== null && typeof (body as { error?: unknown }).error === 'string'
          ? (body as { error: string }).error
          : null;

      if (!response.ok) {
        setResult({ ok: false, message: errorMessage ?? 'The notification could not be added.' });
      } else if (typeof body === 'object' && body !== null && isCapturedExpense((body as { expense?: unknown }).expense)) {
        const expense = (body as { expense: CapturedExpense }).expense;
        setResult({
          ok: true,
          message: `Added ${formatCents(expense.amount_cents)} at ${expense.merchant}.`,
        });
        onCaptured();
      } else {
        setResult({ ok: false, message: 'The app returned an unexpected response.' });
      }
    } catch (err) {
      console.error(err);
      setResult({ ok: false, message: 'Could not reach the service. Check your connection and try again.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <h2 className="text-base font-semibold text-slate-900">Your receiving address</h2>
        <p className="mt-1 text-sm text-slate-500">
          Anything sent here with an amount in it is saved as an expense. Keep this address private.
        </p>

        {keyError ? (
          <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {keyError}
          </p>
        ) : !endpoint ? (
          <div className="mt-4 h-11 animate-pulse rounded-xl bg-slate-100" />
        ) : (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <code className="flex-1 break-all rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-xs text-slate-700">
              {endpoint}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 active:scale-[0.98]"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy address'}
            </button>
          </div>
        )}
      </section>

      {endpoint && <GmailSetup endpoint={endpoint} />}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <h2 className="text-base font-semibold text-slate-900">Try a sample notification</h2>
        <p className="mt-1 text-sm text-slate-500">
          Paste a bank alert to confirm the app picks up the amount and merchant.
        </p>
        <form onSubmit={handleSend} className="mt-4 space-y-3">
          <textarea
            aria-label="Sample notification text"
            rows={3}
            value={sample}
            onChange={(event) => setSample(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p aria-live="polite" className={`text-sm ${result ? (result.ok ? 'text-emerald-700' : 'text-rose-700') : 'text-slate-500'}`}>
              {result ? result.message : 'Recorded as a text message expense.'}
            </p>
            <button
              type="submit"
              disabled={!endpoint || sending || !sample.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              {sending ? 'Sending...' : 'Send sample'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
