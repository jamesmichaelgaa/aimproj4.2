import { useState } from 'react';
import { Check, Copy, Mail } from 'lucide-react';
import { buildGmailScript } from '@/lib/gmailScript';

interface GmailSetupProps {
  endpoint: string;
}

const STEPS = [
  'Sign in to the Gmail account that receives your bank alerts, then open script.google.com and choose New project.',
  'Delete the placeholder code in the editor and paste the script below.',
  'Click Save, then choose Run and pick sendBankAlertsToLedger. Approve the Gmail permission. Google may warn the script is unverified; choose Advanced, then continue, since it runs only in your account.',
  'Click the clock icon on the left (Triggers), add a trigger for sendBankAlertsToLedger, set it to run every 15 minutes, and save.',
];

export default function GmailSetup({ endpoint }: GmailSetupProps) {
  const script = buildGmailScript(endpoint);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
      setCopyFailed(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyFailed(true);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
          <Mail className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900">Gmail bank alerts</h2>
          <p className="mt-1 text-sm text-slate-500">
            Ledger reads your bank alerts in Gmail every 15 minutes using a script that runs in your own Google account.
            Only emails matching the search in the script are sent to Ledger.
          </p>
        </div>
      </div>

      <ol className="mt-5 list-decimal space-y-2 pl-5 text-sm text-slate-600">
        {STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-800">Script to paste</p>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 active:scale-[0.98]"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copied' : 'Copy script'}
        </button>
      </div>
      {copyFailed && (
        <p role="alert" className="mt-2 text-sm text-rose-700">
          Copying failed. Select the script text below and copy it manually.
        </p>
      )}
      <pre className="mt-3 max-h-72 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-700">
        {script}
      </pre>
    </section>
  );
}
