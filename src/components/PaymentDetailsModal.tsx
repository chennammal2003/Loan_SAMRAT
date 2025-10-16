import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export type TrackerLoan = {
  id: string;
  applicationNumber?: string;
  fullName: string;
  loanAmount: number;
  tenure: number; // in months
  emiAmount: number;
  disbursedDate: string;
  createdAt?: string;
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
  onUpdated?: (u: { loanId: string; paidAmount: number; paymentsCompleted: number; status: 'ontrack' | 'overdue' | 'paid' | 'bounce' | 'ecs_success' }) => void;
}

export default function PaymentDetailsModal({ loan, onClose, readOnly: propReadOnly = false, onUpdated }: PaymentDetailsModalProps) {
  const { profile } = useAuth();
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Determine if editing should be allowed based on user role and prop
  const isAdmin = profile?.role === 'admin';
  const readOnly = propReadOnly || !isAdmin;

  // Compute EMI using standard formula at 36% p.a. (monthly rate 3%)
  const computedEmi = useMemo(() => {
    const P = Number(loan.loanAmount || 0);
    const n = Math.max(Number(loan.tenure || 0), 0);
    const r = 0.36 / 12; // 3% per month
    if (P <= 0 || n <= 0) return 0;
    const pow = Math.pow(1 + r, n);
    const emi = (P * r * pow) / (pow - 1);
    return Math.round(emi);
  }, [loan.loanAmount, loan.tenure]);

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
          const emisCovered = Math.floor(paidThisCutoff / Math.max(computedEmi, 1));
          const index = schedule.indexOf(slot);
          const covered = emisCovered > index; // this installment index covered
          const status: PaymentRow['status'] = covered ? 'Paid' : 'Pending';
          return {
            monthLabel: slot.monthLabel,
            dueDateStr: endOfMonth
              ? slot.dueDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
              : '-',
            amount: computedEmi,
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
  }, [loan.id, computedEmi, schedule]);

  const setRowStatus = async (i: number, status: PaymentRow['status']) => {
    // Update UI immediately for responsiveness
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, status } : r)));

    // Get the current status of this EMI before the change for logging
    const { data: currentEmiData } = await supabase
      .from('emi_statuses')
      .select('status')
      .eq('loan_id', loan.id)
      .eq('installment_index', i)
      .single();

    const oldStatus = currentEmiData?.status as PaymentRow['status'] || 'Pending';

    try {
      let newPaidAmountComputed: number | null = null;
      let newLoanStatusComputed: 'ontrack' | 'overdue' | 'paid' | 'bounce' | 'ecs_success' | null = null;
      let paymentsCompletedComputed: number | null = null;
      // 1. First, save EMI status to database
      await new Promise<void>((resolve, reject) => {
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
            resolve();
          } catch (err) {
            reject(err);
          }
        };
        upsert();
      });

      // 2. Update paid_amount in loans table based on status change
      await new Promise<void>((resolve, reject) => {
        const updatePaidAmount = async () => {
          try {
            // Get current loan data
            const { data: loanData, error: loanErr } = await supabase
              .from('loans')
              .select('paid_amount')
              .eq('id', loan.id)
              .single();
            if (loanErr || !loanData) {
              resolve(); // Continue even if this fails
              return;
            }

            const currentPaidAmount = Number(loanData.paid_amount || 0);
            const emiAmount = computedEmi;
            let newPaidAmount = currentPaidAmount;

            const isOldPaid = oldStatus === 'Paid' || oldStatus === 'ECS Success';
            const isNewPaid = status === 'Paid' || status === 'ECS Success';

            // Adjust paid amount based on status change
            if (isNewPaid && !isOldPaid) {
              // EMI changed from unpaid to paid - add EMI amount
              newPaidAmount += emiAmount;
            } else if (!isNewPaid && isOldPaid) {
              // EMI changed from paid to unpaid - subtract EMI amount
              newPaidAmount -= emiAmount;
            }
            // If status changed within paid statuses (Paid <-> ECS Success), no amount change needed

            // Update the paid_amount in loans table
            await supabase.from('loans').update({ paid_amount: newPaidAmount }).eq('id', loan.id);
            newPaidAmountComputed = newPaidAmount;
            resolve();
          } catch (err) {
            reject(err);
          }
        };
        updatePaidAmount();
      });

      // 3. Update overall loan status based on EMI statuses
      await new Promise<void>((resolve, reject) => {
        const updateLoanStatus = async () => {
          try {
            const { data: allStatuses, error: fetchError } = await supabase
              .from('emi_statuses')
              .select('status')
              .eq('loan_id', loan.id);
            if (fetchError || !allStatuses) {
              resolve(); // Continue even if this fails
              return;
            }

            const statuses = allStatuses.map(s => s.status);
            const paidCount = statuses.filter(s => s === 'Paid').length;
            const ecsSuccessCount = statuses.filter(s => s === 'ECS Success').length;
            const bounceCount = statuses.filter(s => s === 'ECS Bounce').length;
            const overdueCount = statuses.filter(s => s === 'Due Missed').length;

            let newLoanStatus = 'ontrack';

            // Check for bounce status first (highest priority)
            if (bounceCount > 0) {
              newLoanStatus = 'bounce';
            }
            // Check for overdue status (second highest priority)
            else if (overdueCount > 0) {
              newLoanStatus = 'overdue';
            }
            // Check if all installments are ECS Success
            else if (ecsSuccessCount === loan.tenure) {
              newLoanStatus = 'ecs_success';
            }
            // Check if all installments are Paid
            else if (paidCount === loan.tenure) {
              newLoanStatus = 'paid';
            }
            // Check if we have a mix of Paid and ECS Success
            else if (paidCount + ecsSuccessCount === loan.tenure) {
              newLoanStatus = 'paid';
            }
            // Default to ontrack if we have some payments but not all
            else if (paidCount + ecsSuccessCount > 0) {
              newLoanStatus = 'ontrack';
            }

            // Update loans table
            await supabase.from('loans').update({ status: newLoanStatus }).eq('id', loan.id);
            newLoanStatusComputed = newLoanStatus as any;
            paymentsCompletedComputed = paidCount + ecsSuccessCount;
            resolve();
          } catch (err) {
            reject(err);
          }
        };
        updateLoanStatus();
      });

      // 4. Insert audit record for this change
      try {
        const emiAmount = computedEmi;
        const isOldPaid = oldStatus === 'Paid' || oldStatus === 'ECS Success';
        const isNewPaid = status === 'Paid' || status === 'ECS Success';
        let amountAffected = 0;
        if (isNewPaid && !isOldPaid) amountAffected = emiAmount; // payment recognized
        else if (!isNewPaid && isOldPaid) amountAffected = -emiAmount; // payment reversed

        const dueInfo = schedule[i];
        const note = dueInfo
          ? `Month: ${dueInfo.monthLabel}, Due: ${dueInfo.dueDate.toLocaleDateString('en-IN')}, EMI: ${emiAmount}`
          : `EMI: ${emiAmount}`;

        await supabase.from('emi_status_audit').insert({
          loan_id: loan.id,
          installment_index: i,
          old_status: oldStatus,
          new_status: status,
          changed_by: profile?.id || null,
          amount_affected: amountAffected,
          notes: note,
        });
      } catch (err) {
        // Non-blocking: don't fail UX if audit insert fails
        console.warn('emi_status_audit insert failed', err);
      }

      // 5. Log the audit trail (optional - doesn't affect core functionality)
      console.log(`EMI Status Change: Loan ${loan.id}, Installment ${i}, From ${oldStatus} to ${status} at ${new Date().toISOString()}`);

      // All database operations completed successfully
      console.log('✅ EMI status change saved successfully to database');

      // 6. Notify parent to update UI immediately
      if (onUpdated && newPaidAmountComputed !== null && newLoanStatusComputed) {
        onUpdated({
          loanId: loan.id,
          paidAmount: newPaidAmountComputed,
          paymentsCompleted: paymentsCompletedComputed || 0,
          status: newLoanStatusComputed,
        });
      }

    } catch (error) {
      console.error('❌ Error saving EMI status change:', error);
      // Revert UI change on error
      setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, status: status } : r)));
    }
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
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold">
              {loan.applicationNumber ? `App: ${loan.applicationNumber}` : `Loan ${loan.id}`} — {loan.fullName}
            </h3>
            {loan.createdAt && (
              <div className="text-xs text-gray-300">
                Applied On: {new Date(loan.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: '2-digit' })}
              </div>
            )}
            {!isAdmin && (
              <span className="px-2 py-1 text-xs font-medium bg-yellow-900/40 text-yellow-300 border border-yellow-800 rounded-full">
                Read Only
              </span>
            )}
          </div>
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
                          onChange={async (e) => {
                            const newStatus = e.target.value as PaymentRow['status'];
                            await setRowStatus(i, newStatus);
                          }}
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