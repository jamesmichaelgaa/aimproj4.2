import { Mail, MessageSquare, PenLine } from 'lucide-react';
import type { ExpenseSource } from '@/types';

const SOURCE_STYLES: Record<ExpenseSource, { label: string; className: string; Icon: typeof PenLine }> = {
  manual: { label: 'Manual', className: 'bg-slate-100 text-slate-700', Icon: PenLine },
  email: { label: 'Email', className: 'bg-sky-50 text-sky-700', Icon: Mail },
  sms: { label: 'Text', className: 'bg-emerald-50 text-emerald-700', Icon: MessageSquare },
};

export default function SourceBadge({ source }: { source: ExpenseSource }) {
  const { label, className, Icon } = SOURCE_STYLES[source];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
