import { useState, type FormEvent } from 'react';
import { ArrowLeft, Loader2, Lock, Mail, Wallet } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { inputClass } from '@/lib/styles';

type Mode = 'signin' | 'signup' | 'forgot';

const MIN_PASSWORD_LENGTH = 8;

function describeAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) return "That email and password don't match. Please try again.";
  if (lower.includes('already registered') || lower.includes('already exists')) {
    return 'An account with this email already exists. Sign in instead.';
  }
  if (lower.includes('password')) return 'Your password does not meet the requirements.';
  if (lower.includes('valid email')) return 'Please enter a valid email address.';
  return 'Something went wrong. Please try again.';
}

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
  };

  const handleForgot = async (trimmedEmail: string) => {
    setSubmitting(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo: window.location.origin,
    });
    setSubmitting(false);
    if (resetError) {
      setError('We could not send the reset email. Please wait a minute and try again.');
      return;
    }
    setNotice('If an account exists for that email, a reset link is on its way. Check your inbox.');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Enter your email address.');
      return;
    }
    if (mode === 'forgot') {
      setError(null);
      setNotice(null);
      await handleForgot(trimmedEmail);
      return;
    }
    if (!password) {
      setError('Enter your email and password.');
      return;
    }
    if (mode === 'signup' && password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`);
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);

    if (mode === 'signin') {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });
      if (signInError) {
        setError(describeAuthError(signInError.message));
        setSubmitting(false);
      }
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({ email: trimmedEmail, password });
    if (signUpError) {
      setError(describeAuthError(signUpError.message));
      setSubmitting(false);
      return;
    }
    if (!data.session) {
      setNotice('Your account is ready. Sign in with your new password.');
      setMode('signin');
      setPassword('');
    }
    setSubmitting(false);
  };

  const isSignup = mode === 'signup';
  const isForgot = mode === 'forgot';

  const subtitle = isForgot
    ? 'Enter your email and we will send you a link to reset your password.'
    : isSignup
      ? 'Create your account to start tracking.'
      : 'Welcome back. Sign in to continue.';

  const submitLabel = isForgot ? 'Send reset link' : isSignup ? 'Create account' : 'Sign in';

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
            <Wallet className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
            {isForgot ? 'Reset password' : 'Ledger'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {isForgot ? (
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </button>
          ) : (
            <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1" role="tablist">
              {(['signin', 'signup'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="tab"
                  aria-selected={mode === option}
                  onClick={() => switchMode(option)}
                  className={`rounded-lg py-2 text-sm font-medium transition ${
                    mode === option ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {option === 'signin' ? 'Sign in' : 'Create account'}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="auth-email" className="mb-1.5 block text-sm font-medium text-slate-700">
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={`${inputClass} pl-9`}
                />
              </div>
            </div>

            {!isForgot && (
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="auth-password" className="block text-sm font-medium text-slate-700">
                    Password
                  </label>
                  {!isSignup && (
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className="text-xs font-medium text-emerald-700 transition hover:text-emerald-800"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="auth-password"
                    type="password"
                    autoComplete={isSignup ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className={`${inputClass} pl-9`}
                  />
                </div>
                {isSignup && <p className="mt-1.5 text-xs text-slate-500">At least {MIN_PASSWORD_LENGTH} characters.</p>}
              </div>
            )}

            {error && (
              <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            )}
            {notice && (
              <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Please wait...' : submitLabel}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
