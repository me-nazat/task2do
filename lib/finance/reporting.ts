import {
  FinanceKpiSnapshot,
  FinanceReportConfig,
  FinanceTransaction,
  FinanceTransactionType,
  GeneratedReport,
} from '@/lib/finance/mock-data';

export function formatCurrencyBDT(amount: number, { signed = false }: { signed?: boolean } = {}) {
  const formatter = new Intl.NumberFormat('en-BD', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const absolute = formatter.format(Math.abs(amount));

  if (!signed) {
    return `৳${absolute}`;
  }

  const prefix = amount > 0 ? '+' : amount < 0 ? '-' : '';
  return `${prefix}৳${absolute}`;
}

export function formatReportDate(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00`));
}

export function calculateFinanceSummary(transactions: FinanceTransaction[]): FinanceKpiSnapshot {
  const monthlyEarnings = transactions
    .filter((transaction) => transaction.type === 'earning')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const monthlyExpenses = transactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  return {
    totalBalance: 0,
    monthlyEarnings,
    monthlyExpenses,
    netSavings: monthlyEarnings - monthlyExpenses,
  };
}

export function createGeneratedReport(config: FinanceReportConfig, transactions: FinanceTransaction[]): GeneratedReport {
  const summary = calculateFinanceSummary(transactions);
  const now = new Date();
  const reportDate = now.toISOString().slice(0, 10);
  const reportTypeLabel = config.reportType.replace(/-/g, '_');
  const extension = config.format === 'excel' ? 'xls' : 'pdf';

  return {
    id: `report-${now.getTime()}`,
    fileName: `report_${reportTypeLabel}_${reportDate}.${extension}`,
    createdAt: now.toISOString(),
    format: config.format,
    reportType: config.reportType,
    periodLabel: 'Last 30 days',
    transactions,
    summary,
  };
}

export function downloadTextFile(fileName: string, body: string, mimeType: string) {
  const blob = new Blob([body], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function buildExcelLikeDocument(report: GeneratedReport) {
  const rows = report.transactions
    .map(
      (transaction) =>
        `<tr><td>${transaction.date}</td><td>${transaction.type === 'expense' ? 'Expense' : 'Earning'}</td><td>${transaction.category}</td><td>${transaction.title}</td><td>${formatCurrencyBDT(transaction.type === 'expense' ? -transaction.amount : transaction.amount, { signed: true })}</td></tr>`
    )
    .join('');

  return `
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Type</th>
          <th>Category</th>
          <th>Description</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

export function getTransactionAmount(transaction: FinanceTransaction) {
  return transaction.type === 'expense' ? -transaction.amount : transaction.amount;
}

export function getSignedAmountValue(amount: number, type: FinanceTransactionType) {
  return type === 'expense' ? -amount : amount;
}
