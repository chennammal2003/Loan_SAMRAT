import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';

export type TrackerLoan = {
  id: string;
  fullName: string;
  loanAmount: number;
  tenure: number; // in months
  emiAmount: number;
  disbursedDate: string;
};

type PaymentRow = {
  monthLabel: string;
  dueDateStr: string;
  amount: number;
  status: 'Pending' | 'Paid' | 'ECS Success' | 'ECS Bounce' | 'Due Missed';
};

interface PaymentDetailsModalProps {
  loan: TrackerLoan;
  onClose: () => void;
  readOnly?: boolean; // Hide update column for read-only views
}

export default function PaymentDetailsModal({ loan, onClose, readOnly = false }: PaymentDetailsModalProps) {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const schedule = useMemo(() => {
    const result: { monthLabel: string; dueDate: Date }[] = [];
    const start = loan.disbursedDate ? new Date(loan.disbursedDate) : new Date();
    // Use the day of the start date for all monthly dues
    const dueDay = start.getDate();
    const base = new Date(start.getFullYear(), start.getMonth(), dueDay);
    for (let i = 0; i < loan.tenure; i++) {
      // Construct date keeping same day; adjust for months with fewer days
      const y = base.getFullYear();
      const m = base.getMonth() + i + 1; // Start from next month
      const lastDayOfTarget = new Date(y, m + 1, 0).getDate();
      const day = Math.min(dueDay, lastDayOfTarget);
      const d = new Date(y, m, day);
      result.push({
        monthLabel: d.toLocaleString('en-US', { month: 'short' }),
        dueDate: d,
      });
    }
    return result;
  }, [loan.disbursedDate, loan.tenure]);

  useEffect(() => {
    const fetchPayments = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from('payments')
          .select('payment_date,total_paid')
          .eq('loan_id', loan.id)
          .order('payment_date', { ascending: true });
        if (error) throw error;
        const payments = (data || []).map((p: any) => ({
          date: new Date(p.payment_date),
          amount: Number(p.total_paid ?? 0),
        }));
        // Build cumulative coverage per installment (default computation)
        const computed: PaymentRow[] = schedule.map((slot) => {
          // Sum payments made up to the end of this month
          const endOfMonth = new Date(slot.dueDate.getFullYear(), slot.dueDate.getMonth() + 1, 0, 23, 59, 59);
          const paidThisCutoff = payments
            .filter((p) => p.date.getTime() <= endOfMonth.getTime())
            .reduce((s, p) => s + p.amount, 0);
          // Determine how many EMIs covered by paid amount
          const emisCovered = Math.floor(paidThisCutoff / Math.max(loan.emiAmount, 1));
          const index = schedule.indexOf(slot);
          const covered = emisCovered > index; // this installment index covered
          const status: PaymentRow['status'] = covered ? 'Paid' : 'Pending';
          return {
            monthLabel: slot.monthLabel,
            dueDateStr: endOfMonth
              ? slot.dueDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
              : '-',
            amount: loan.emiAmount,
            status,
          };
        });

        // Try to fetch saved statuses from emi_statuses table and merge
        try {
          const { data: saved, error: statusErr } = await supabase
            .from('emi_statuses')
            .select('installment_index,status')
            .eq('loan_id', loan.id)
            .order('installment_index');
          if (!statusErr && saved && saved.length > 0) {
            const merged = computed.map((r, i) => {
              const row = (saved as any[]).find((s) => Number(s.installment_index) === i);
              return row ? { ...r, status: row.status as PaymentRow['status'] } : r;
            });
            setRows(merged);
          } else {
            setRows(computed);
          }
        } catch {
          // Table may not exist; fall back to computed
          setRows(computed);
        }
      } catch (e: any) {
        setError(e.message || 'Failed to load payment details');
      } finally {
        setLoading(false);
      }
    };
    fetchPayments();
  }, [loan.id, loan.emiAmount, schedule]);

  const setRowStatus = (i: number, status: PaymentRow['status']) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, status } : r)));
    // Optimistically persist to emi_statuses (ignore if table not present)
    const upsert = async () => {
      try {
        const { error } = await supabase.from('emi_statuses').upsert(
          [{ loan_id: loan.id, installment_index: i, status, updated_at: new Date().toISOString() }],
          { onConflict: 'loan_id,installment_index' } as any
        );
        if (error) {
          // If upsert with onConflict not supported, try plain upsert without option
          await supabase.from('emi_statuses').upsert({ loan_id: loan.id, installment_index: i, status, updated_at: new Date().toISOString() });
        }
      } catch {
        // silently ignore
      }
    };
    upsert();

    // Update overall loan status based on EMI statuses
    const updateLoanStatus = async () => {
      try {
        const { data: allStatuses, error: fetchError } = await supabase
          .from('emi_statuses')
          .select('status')
          .eq('loan_id', loan.id);
        if (fetchError || !allStatuses) return;

        const statuses = allStatuses.map(s => s.status);
        const allPaidOrSuccess = statuses.every(s => s === 'Paid' || s === 'ECS Success');
        const hasBounce = statuses.some(s => s === 'ECS Bounce');
        const hasMissed = statuses.some(s => s === 'Due Missed');

        let newLoanStatus = 'ontrack'; // default
        if (allPaidOrSuccess) {
          newLoanStatus = 'paid';
        } else if (hasBounce || hasMissed) {
          newLoanStatus = 'overdue';
        } else if (statuses.some(s => s === 'Paid' || s === 'ECS Success')) {
          newLoanStatus = 'ontrack';
        }

        // Update loans table
        await supabase.from('loans').update({ status: newLoanStatus }).eq('id', loan.id);
      } catch {
        // silently ignore
      }
    };
    updateLoanStatus();
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-start justify-center p-4 overflow-y-auto"
      style={{ zIndex: 1000 }}
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mt-10 w-full max-w-3xl bg-gray-900 text-gray-100 rounded-xl shadow-2xl border border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-gray-800 border-b border-gray-700">
          <h3 className="text-lg font-semibold">Loan {loan.id} — {loan.fullName}</h3>
          <button onClick={onClose} className="p-2 rounded hover:bg-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800/80">
                <tr>
                  <th className="text-left px-6 py-3 text-sm font-semibold">Month</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold">Due Date</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold">Amount</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold">Current Status</th>
                  {!readOnly && <th className="text-left px-6 py-3 text-sm font-semibold">Update</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {loading && (
                  <tr>
                    <td colSpan={readOnly ? 4 : 5} className="px-6 py-8 text-center text-gray-300">Loading...</td>
                  </tr>
                )}
                {error && !loading && (
                  <tr>
                    <td colSpan={readOnly ? 4 : 5} className="px-6 py-8 text-center text-red-400">{error}</td>
                  </tr>
                )}
                {!loading && !error && rows.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-800/50">
                    <td className="px-6 py-4">{r.monthLabel}</td>
                    <td className="px-6 py-4">{r.dueDateStr}</td>
                    <td className="px-6 py-4">₹{r.amount.toLocaleString('en-IN')}</td>
                    <td className="px-6 py-4">
                      {r.status === 'Paid' && (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-900/40 text-green-300 border border-green-800">Paid</span>
                      )}
                      {r.status === 'ECS Success' && (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-900/40 text-emerald-300 border border-emerald-800">ECS Success</span>
                      )}
                      {r.status === 'ECS Bounce' && (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-900/40 text-red-300 border border-red-800">ECS Bounce</span>
                      )}
                      {r.status === 'Due Missed' && (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-orange-900/40 text-orange-300 border border-orange-800">Due Missed</span>
                      )}
                      {r.status === 'Pending' && (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-900/40 text-amber-300 border border-amber-800">Pending</span>
                      )}
                    </td>
                    {!readOnly && (
                      <td className="px-6 py-4">
                        <select
                          value={r.status}
                          onChange={(e) => setRowStatus(i, e.target.value as PaymentRow['status'])}
                          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                        >
                          <option>Pending</option>
                          <option>Paid</option>
                          <option>ECS Success</option>
                          <option>ECS Bounce</option>
                          <option>Due Missed</option>
                        </select>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
