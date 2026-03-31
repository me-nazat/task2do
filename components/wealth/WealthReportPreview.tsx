'use client';

import { useEffect } from 'react';
import { Menu } from 'lucide-react';
import { EmptyPreview } from '@/components/dual-dashboard/AppShell';
import { POCKET_TRACKER_BRAND_NAME } from '@/lib/finance/mock-data';
import { formatCurrencyBDT, getTransactionAmount } from '@/lib/finance/reporting';
import { useFinanceStore } from '@/store/useFinanceStore';
import { useShellStore } from '@/store/useShellStore';

export function PocketTrackerReportPreview() {
  const latestReport = useFinanceStore((state) => state.generatedReports[0] ?? null);
  const wealthTheme = useShellStore((state) => state.wealthTheme);

  useEffect(() => {
    document.documentElement.dataset.product = 'pocket-tracker';
    document.documentElement.dataset.theme = wealthTheme;
  }, [wealthTheme]);

  if (!latestReport) {
    return (
      <div className="min-h-screen bg-[var(--app-bg)] px-4 py-8 text-[color:var(--app-text)] md:px-8">
        <EmptyPreview
          eyebrow="Report Preview"
          title="No report has been generated yet."
          description="Generate a report from Pocket Tracker to open the PDF-style preview."
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1f1f1f] text-white">
      <header className="flex h-14 items-center gap-4 border-b border-white/10 bg-[#2b2b2b] px-4">
        <button type="button" className="rounded-full p-2 text-white/70 transition hover:bg-white/10">
          <Menu className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium">{latestReport.fileName}</span>
      </header>

      <div className="flex min-h-[calc(100vh-56px)] items-start justify-center bg-[#181818] px-4 py-8">
        <article className="w-full max-w-[760px] bg-white text-slate-900 shadow-[0_24px_90px_rgba(0,0,0,0.45)]">
          <div className="bg-[#2563eb] px-10 py-8 text-white">
            <h1 className="text-5xl font-semibold tracking-[-0.05em]">{POCKET_TRACKER_BRAND_NAME}</h1>
            <p className="mt-4 text-base opacity-90">
              Financial Report • {latestReport.reportType.replace(/-/g, ' ')} • {latestReport.periodLabel}
            </p>
          </div>

          <div className="space-y-8 px-10 py-8">
            <p className="text-sm text-slate-500">
              Generated: {new Date(latestReport.createdAt).toLocaleString()} | Period: 2026-03-01 to 2026-03-31
            </p>

            <section className="rounded-[20px] border border-slate-200 bg-slate-50 p-5">
              <h2 className="text-lg font-semibold tracking-[-0.03em] text-slate-900">Summary</h2>
              <div className="mt-3 space-y-2 text-sm">
                <p>Total Earnings: <span className="font-semibold text-emerald-600">{formatCurrencyBDT(latestReport.summary.monthlyEarnings)}</span></p>
                <p>Total Expenses: <span className="font-semibold text-rose-500">{formatCurrencyBDT(latestReport.summary.monthlyExpenses)}</span></p>
                <p>Net Balance: <span className="font-semibold text-slate-900">{formatCurrencyBDT(latestReport.summary.netSavings, { signed: true })}</span></p>
              </div>
            </section>

            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-[#2563eb] text-white">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {latestReport.transactions.slice(0, 12).map((transaction, index) => (
                  <tr key={transaction.id} className={index % 2 === 0 ? 'bg-sky-50/60' : 'bg-white'}>
                    <td className="px-4 py-3">{transaction.date}</td>
                    <td className={transaction.type === 'expense' ? 'px-4 py-3 text-rose-500' : 'px-4 py-3 text-emerald-600'}>
                      {transaction.type === 'expense' ? 'Expense' : 'Earning'}
                    </td>
                    <td className="px-4 py-3">{transaction.category}</td>
                    <td className="px-4 py-3">{transaction.title}</td>
                    <td className={transaction.type === 'expense' ? 'px-4 py-3 text-right font-semibold text-rose-500' : 'px-4 py-3 text-right font-semibold text-emerald-600'}>
                      {formatCurrencyBDT(getTransactionAmount(transaction), { signed: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </div>
  );
}
