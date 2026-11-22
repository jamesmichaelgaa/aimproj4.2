import { useCallback, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarClock, CalendarRange, LayoutDashboard, LogOut, PiggyBank, Receipt, Wallet, Inbox } from 'lucide-react';
import BudgetsView from '@/components/BudgetsView';
import DashboardView from '@/components/DashboardView';
import ExpensesView from '@/components/ExpensesView';
import ForecastView from '@/components/ForecastView';
import InboxView from '@/components/InboxView';
import RecurringView from '@/components/RecurringView';
import { useBudgetData } from '@/hooks/useBudgetData';
import { supabase } from '@/lib/supabase';
import { currentMonthKey, formatMonthLabel, shiftMonth } from '@/lib/money';

type Tab = 'dashboard' | 'expenses' | 'recurring' | 'forecast' | 'budgets' | 'connect';

const TABS: Array<{ id: Tab; label: string; Icon: typeof Wallet }> = [
  { id: 'dashboard', label: 'Overview', Icon: LayoutDashboard },
  { id: 'expenses', label: 'Expenses', Icon: Receipt },
  { id: 'recurring', label: 'Recurring', Icon: CalendarClock },
  { id: 'forecast', label: 'Forecast', Icon: CalendarRange },
  { id: 'budgets', label: 'Budgets', Icon: PiggyBank },
  { id: 'connect', label: 'Auto-capture', Icon: Inbox },
];

interface BudgetWorkspaceProps {
  userId: string;
  email: string;
}

export default function BudgetWorkspace({ userId, email }: BudgetWorkspaceProps) {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [month, setMonth] = useState(currentMonthKey);
  const { categories, expenses, recurring, loading, error, reload } = useBudgetData(userId);
  const isCurrentMonth = month === currentMonthKey();

  const handleCaptured = useCallback(() => {
    reload();
  }, [reload]);

  const handleSignOut = async () => {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) console.error(signOutError);
  };

  const renderView = () => {
    if (loading) {
      return (
        <div className="space-y-4">
          <div className="h-24 animate-pulse rounded-2xl bg-slate-200/70" />
          <div className="h-64 animate-pulse rounded-2xl bg-slate-200/70" />
        </div>
      );
    }
    if (error) {
      return (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
          <p className="text-sm font-medium text-rose-800">{error}</p>
          <button
            type="button"
            onClick={reload}
            className="mt-4 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
          >
            Try again
          </button>
        </div>
      );
    }
    switch (tab) {
      case 'dashboard':
        return <DashboardView month={month} categories={categories} expenses={expenses} />;
      case 'expenses':
        return <ExpensesView month={month} categories={categories} expenses={expenses} onChanged={reload} />;
      case 'recurring':
        return (
          <RecurringView
            categories={categories}
            expenses={expenses}
            recurring={recurring}
            onChanged={reload}
          />
        );
      case 'forecast':
        return <ForecastView recurring={recurring} categories={categories} />;
      case 'budgets':
        return <BudgetsView month={month} categories={categories} expenses={expenses} onChanged={reload} />;
      case 'connect':
        return <InboxView userId={userId} onCaptured={handleCaptured} />;
    }
  };

  return (
    <>
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                <Wallet className="h-5 w-5" />
              </div>
              <span className="text-lg font-semibold tracking-tight">Ledger</span>
            </div>

            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setMonth((current) => shiftMonth(current, -1))}
                aria-label="Previous month"
                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[9.5rem] text-center text-sm font-medium text-slate-800">
                {formatMonthLabel(month)}
              </span>
              <button
                type="button"
                onClick={() => setMonth((current) => shiftMonth(current, 1))}
                aria-label="Next month"
                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              {!isCurrentMonth && (
                <button
                  type="button"
                  onClick={() => setMonth(currentMonthKey())}
                  className="ml-1 rounded-lg px-2 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-50"
                >
                  Today
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden max-w-[12rem] truncate text-sm text-slate-500 lg:inline">{email}</span>
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:text-slate-900"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>

          <nav className="-mx-1 flex gap-1 overflow-x-auto px-1" aria-label="Main">
            {TABS.map(({ id, label, Icon }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    active
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main key={tab} className="mx-auto max-w-6xl animate-[fadeUp_300ms_ease-out] px-4 py-6 md:px-6 md:py-8">
        {renderView()}
      </main>
    </div>
    </>
  );
}
