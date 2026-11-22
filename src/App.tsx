import { useSession } from '@/hooks/useSession';
import AuthScreen from '@/components/AuthScreen';
import BudgetWorkspace from '@/components/BudgetWorkspace';
import ResetPasswordScreen from '@/components/ResetPasswordScreen';

export default function App() {
  const { session, loading, recovering, clearRecovery } = useSession();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-600" />
      </div>
    );
  }

  if (recovering && session) return <ResetPasswordScreen onComplete={clearRecovery} />;

  if (!session) return <AuthScreen />;

  return <BudgetWorkspace userId={session.user.id} email={session.user.email ?? ''} />;
}
