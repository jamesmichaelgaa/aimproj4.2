import { jsPDF } from 'jspdf';
import { spentByCategory, totalCents } from '@/lib/budgetMath';
import { formatCents, formatDay, formatMonthLabel, todayISO } from '@/lib/money';
import type { Category, Expense } from '@/types';

interface MonthlyReportInput {
  month: string;
  categories: Category[];
  expenses: Expense[];
}

const MARGIN = 48;
const INK: [number, number, number] = [15, 23, 42];
const MUTED: [number, number, number] = [100, 116, 139];
const ACCENT: [number, number, number] = [5, 150, 105];
const RULE: [number, number, number] = [226, 232, 240];

export function downloadMonthlyReport({ month, categories, expenses }: MonthlyReportInput): void {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;
  const bottomLimit = pageHeight - MARGIN - 24;
  const monthLabel = formatMonthLabel(month);
  const spentMap = spentByCategory(expenses);
  const spent = totalCents(expenses);
  const budget = categories.reduce((sum, category) => sum + category.monthly_budget_cents, 0);
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  let y = MARGIN;

  const setColor = (color: [number, number, number]) => doc.setTextColor(color[0], color[1], color[2]);

  const newPageIfNeeded = (neededHeight: number, redraw?: () => void) => {
    if (y + neededHeight <= bottomLimit) return;
    doc.addPage();
    y = MARGIN;
    redraw?.();
  };

  const drawRule = () => {
    doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
    doc.setLineWidth(0.75);
    doc.line(MARGIN, y, pageWidth - MARGIN, y);
    y += 16;
  };

  const drawSectionTitle = (title: string) => {
    newPageIfNeeded(40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    setColor(INK);
    doc.text(title, MARGIN, y);
    y += 14;
    drawRule();
  };

  // Ledger monthly report header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  setColor(ACCENT);
  doc.text('Ledger', MARGIN, y + 6);
  doc.setFontSize(11);
  setColor(MUTED);
  doc.text(`Generated ${formatDay(todayISO())}`, pageWidth - MARGIN, y + 6, { align: 'right' });
  y += 34;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  setColor(INK);
  doc.text(`Monthly report: ${monthLabel}`, MARGIN, y);
  y += 24;
  drawRule();

  // Summary
  const summaryItems: Array<[string, string]> = [
    ['Total spent', formatCents(spent)],
    ['Monthly budget', budget > 0 ? formatCents(budget) : 'Not set'],
    [
      budget > 0 && spent > budget ? 'Over budget' : 'Left to spend',
      budget > 0 ? formatCents(Math.abs(budget - spent)) : '--',
    ],
    ['Transactions', String(expenses.length)],
  ];
  const columnWidth = contentWidth / summaryItems.length;
  summaryItems.forEach(([label, value], index) => {
    const x = MARGIN + index * columnWidth;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    setColor(MUTED);
    doc.text(label.toUpperCase(), x, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    setColor(INK);
    doc.text(value, x, y + 20);
  });
  y += 46;

  // Category breakdown
  drawSectionTitle('Spending by category');
  const categoryRows = categories
    .filter((category) => category.monthly_budget_cents > 0 || spentMap.has(category.id))
    .map((category) => ({
      name: category.name,
      spent: spentMap.get(category.id) ?? 0,
      budget: category.monthly_budget_cents,
    }));
  const uncategorized = spentMap.get(null) ?? 0;
  if (uncategorized > 0) categoryRows.push({ name: 'Uncategorized', spent: uncategorized, budget: 0 });

  const drawCategoryHeader = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    setColor(MUTED);
    doc.text('CATEGORY', MARGIN, y);
    doc.text('SPENT', MARGIN + contentWidth * 0.55, y, { align: 'right' });
    doc.text('BUDGET', MARGIN + contentWidth * 0.75, y, { align: 'right' });
    doc.text('USED', pageWidth - MARGIN, y, { align: 'right' });
    y += 14;
  };

  if (categoryRows.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    setColor(MUTED);
    doc.text('No spending recorded this month.', MARGIN, y + 12);
    y += 28;
  } else {
    drawCategoryHeader();
    for (const row of categoryRows) {
      newPageIfNeeded(18, drawCategoryHeader);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      setColor(INK);
      doc.text(row.name, MARGIN, y);
      doc.text(formatCents(row.spent), MARGIN + contentWidth * 0.55, y, { align: 'right' });
      doc.text(row.budget > 0 ? formatCents(row.budget) : '--', MARGIN + contentWidth * 0.75, y, { align: 'right' });
      const used = row.budget > 0 ? `${Math.round((row.spent / row.budget) * 100)}%` : '--';
      doc.text(used, pageWidth - MARGIN, y, { align: 'right' });
      y += 18;
    }
  }
  y += 16;

  // Transactions
  drawSectionTitle('Transactions');
  const drawTransactionHeader = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    setColor(MUTED);
    doc.text('DATE', MARGIN, y);
    doc.text('MERCHANT', MARGIN + 64, y);
    doc.text('CATEGORY', MARGIN + contentWidth * 0.62, y);
    doc.text('AMOUNT', pageWidth - MARGIN, y, { align: 'right' });
    y += 14;
  };

  if (expenses.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    setColor(MUTED);
    doc.text('No transactions recorded this month.', MARGIN, y + 12);
    y += 28;
  } else {
    drawTransactionHeader();
    const chronological = [...expenses].sort((a, b) => a.occurred_on.localeCompare(b.occurred_on));
    for (const expense of chronological) {
      newPageIfNeeded(18, drawTransactionHeader);
      const category = expense.category_id ? categoryById.get(expense.category_id) : undefined;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      setColor(INK);
      doc.text(formatDay(expense.occurred_on), MARGIN, y);
      doc.text(truncate(expense.merchant, 38), MARGIN + 64, y);
      doc.text(category?.name ?? 'Uncategorized', MARGIN + contentWidth * 0.62, y);
      doc.text(formatCents(expense.amount_cents), pageWidth - MARGIN, y, { align: 'right' });
      y += 18;
    }
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setColor(MUTED);
    doc.text(`Ledger - ${monthLabel}`, MARGIN, pageHeight - MARGIN / 2);
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - MARGIN, pageHeight - MARGIN / 2, { align: 'right' });
  }

  doc.save(`ledger-report-${month}.pdf`);
}

function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
}
