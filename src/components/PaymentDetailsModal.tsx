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
  productDeliveredDate?: string; // NEW: Product delivery date for EMI start
  productDeliveryStatus?: string; // NEW: Status of product delivery (Pending/Delivered)
  createdAt?: string;
};

type PaymentRow = {
  monthLabel: string;
  dueDateStr: string;
  amount: number;
  status: 'Pending' | 'Paid' | 'ECS Success' | 'ECS Bounce' | 'Due Missed';
  paidDate?: string; // Format: YYYY-MM-DD
  paymentMethod?: 'pending' | 'manual' | 'ecs' | 'ecs_bounce' | 'missed'; // NEW: Track how payment was made
  paidByUserId?: string; // NEW: Track who marked it paid
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
  const [actionModalIndex, setActionModalIndex] = useState<number | null>(null);
  const [actionModalPaidDate, setActionModalPaidDate] = useState<string>('');

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
    
    // CRITICAL: Use product delivery date if available, otherwise use disbursed date
    // This ensures EMI starts counting from actual product delivery, not just disbursement
    let startDate = loan.disbursedDate ? new Date(loan.disbursedDate) : new Date();
    
    if (loan.productDeliveredDate && loan.productDeliveryStatus !== 'Pending') {
      // Product has been delivered, use delivery date as EMI start date
      startDate = new Date(loan.productDeliveredDate);
    } else if (loan.productDeliveredDate && !loan.productDeliveryStatus) {
      // If delivery date exists but status is not set, use delivery date
      startDate = new Date(loan.productDeliveredDate);
    }
    // else: Product not yet delivered, use disbursement date
    
    // Use the day of the start date for all monthly dues
    const dueDay = startDate.getDate();
    const base = new Date(startDate.getFullYear(), startDate.getMonth(), dueDay);
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
  }, [loan.disbursedDate, loan.productDeliveredDate, loan.productDeliveryStatus, loan.tenure]);

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
    const currentRow = rows[i];
    const oldStatus = currentRow.status;
    const oldPaymentMethod = currentRow.paymentMethod;

    // PROTECTION 1: Cannot override manually paid EMIs
    if (oldPaymentMethod === 'manual' && currentRow.paidDate) {
      alert('❌ Cannot change status: This EMI was manually marked as paid on ' + 
            new Date(currentRow.paidDate).toLocaleDateString('en-IN') + 
            '.\n\nTo change it, you must first clear the payment record.');
      // Revert UI
      setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, status: oldStatus } : r)));
      return;
    }

    // PROTECTION 2: Cannot override ECS Success EMIs
    if (oldPaymentMethod === 'ecs' && oldStatus === 'ECS Success') {
      alert('❌ Cannot change status: This EMI was processed by ECS system.\n\n' +
            'Only ECS system can modify this record.');
      // Revert UI
      setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, status: oldStatus } : r)));
      return;
    }

    // PROTECTION 3: Cannot change Due Missed status manually
    if (oldStatus === 'Due Missed') {
      alert('❌ Cannot change status: This EMI is marked as due missed.\n\n' +
            'Please contact system administrator to override.');
      // Revert UI
      setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, status: oldStatus } : r)));
      return;
    }

    // Update UI immediately for responsiveness
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, status } : r)));

    // Determine new payment method based on status
    let newPaymentMethod = oldPaymentMethod || 'pending';
    if (status === 'ECS Success') {
      newPaymentMethod = 'ecs';
    } else if (status === 'ECS Bounce') {
      newPaymentMethod = 'ecs_bounce';
    } else if (status === 'Due Missed') {
      newPaymentMethod = 'missed';
    } else if (status === 'Pending') {
      newPaymentMethod = 'pending';
    }
    // Note: 'Paid' through dropdown should not be set directly; use "Mark Paid" button instead

    try {
      let newPaidAmountComputed: number | null = null;
      let newLoanStatusComputed: 'ontrack' | 'overdue' | 'paid' | 'bounce' | 'ecs_success' | null = null;
      let paymentsCompletedComputed: number | null = null;
      // 1. First, save EMI status to database WITH payment method
      await new Promise<void>((resolve, reject) => {
        const upsert = async () => {
          try {
            const { error } = await supabase.from('emi_statuses').upsert(
              [{ 
                loan_id: loan.id, 
                installment_index: i, 
                status, 
                payment_method: newPaymentMethod, // NEW: Track payment method
                updated_at: new Date().toISOString() 
              }],
              { onConflict: 'loan_id,installment_index' } as any
            );
            if (error) {
              // If upsert with onConflict not supported, try plain upsert without option
              await supabase.from('emi_statuses').upsert({ 
                loan_id: loan.id, 
                installment_index: i, 
                status, 
                payment_method: newPaymentMethod, // NEW
                updated_at: new Date().toISOString() 
              });
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
          ? `Month: ${dueInfo.monthLabel}, Due: ${dueInfo.dueDate.toLocaleDateString('en-IN')}, EMI: ${emiAmount}, Payment Method: ${newPaymentMethod}`
          : `EMI: ${emiAmount}, Payment Method: ${newPaymentMethod}`;

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

  // NEW: Helper to determine if EMI is locked for editing
  const isEmiLocked = (row: PaymentRow): boolean => {
    // Locked if manually paid with date
    if (row.paymentMethod === 'manual' && row.paidDate) {
      return true;
    }
    // Locked if ECS success
    if (row.paymentMethod === 'ecs' && row.status === 'ECS Success') {
      return true;
    }
    // Locked if due missed
    if (row.status === 'Due Missed') {
      return true;
    }
    return false;
  };

  const handleSavePaidDate = async (installmentIndex: number, paidDate: string) => {
    if (!paidDate) {
      alert('Please enter a paid date');
      return;
    }
    
    const currentRow = rows[installmentIndex];
    
    // PROTECTION: Cannot override ECS processed EMIs
    if (currentRow.paymentMethod === 'ecs' && currentRow.status === 'ECS Success') {
      alert('❌ Cannot mark as paid: This EMI was already processed by ECS system as ' + 
            currentRow.status + '.\n\n' +
            'Only ECS system can modify this record.');
      return;
    }

    try {
      // NEW: Set payment method to 'manual'
      const newPaymentMethod = 'manual';

      // Update the row with the paid date and payment method
      setRows((prev) => prev.map((r, idx) => 
        idx === installmentIndex 
          ? { 
              ...r, 
              status: 'Paid', 
              paidDate,
              paymentMethod: newPaymentMethod, // NEW
              paidByUserId: profile?.id // NEW
            } 
          : r
      ));

      // Save to emi_statuses table with payment method
      await supabase.from('emi_statuses').upsert({
        loan_id: loan.id,
        installment_index: installmentIndex,
        status: 'Paid',
        payment_method: newPaymentMethod, // NEW
        paid_date: paidDate,
        paid_by_user_id: profile?.id, // NEW: Track who marked it paid
        updated_at: new Date().toISOString()
      }, { onConflict: 'loan_id,installment_index' } as any);

      // Get the current EMI status to determine if it was paid before
      const { data: currentEmiData } = await supabase
        .from('emi_statuses')
        .select('status')
        .eq('loan_id', loan.id)
        .eq('installment_index', installmentIndex)
        .single();

      const oldStatus = currentEmiData?.status as PaymentRow['status'] || 'Pending';

      // Update paid_amount in loans table
      const { data: loanData } = await supabase
        .from('loans')
        .select('paid_amount')
        .eq('id', loan.id)
        .single();

      const currentPaidAmount = Number(loanData?.paid_amount || 0);
      const emiAmount = computedEmi;
      let newPaidAmount = currentPaidAmount;

      const isOldPaid = oldStatus === 'Paid' || oldStatus === 'ECS Success';
      if (!isOldPaid) {
        newPaidAmount += emiAmount;
      }

      await supabase.from('loans').update({ paid_amount: newPaidAmount }).eq('id', loan.id);

      // Update overall loan status
      const { data: allStatuses } = await supabase
        .from('emi_statuses')
        .select('status')
        .eq('loan_id', loan.id);

      const statuses = (allStatuses || []).map(s => s.status);
      const paidCount = statuses.filter(s => s === 'Paid').length;
      const ecsSuccessCount = statuses.filter(s => s === 'ECS Success').length;
      const bounceCount = statuses.filter(s => s === 'ECS Bounce').length;
      const overdueCount = statuses.filter(s => s === 'Due Missed').length;

      let newLoanStatus = 'ontrack';
      if (bounceCount > 0) newLoanStatus = 'bounce';
      else if (overdueCount > 0) newLoanStatus = 'overdue';
      else if (ecsSuccessCount === loan.tenure) newLoanStatus = 'ecs_success';
      else if (paidCount === loan.tenure) newLoanStatus = 'paid';
      else if (paidCount + ecsSuccessCount === loan.tenure) newLoanStatus = 'paid';
      else if (paidCount + ecsSuccessCount > 0) newLoanStatus = 'ontrack';

      await supabase.from('loans').update({ status: newLoanStatus }).eq('id', loan.id);

      // Notify parent
      if (onUpdated) {
        onUpdated({
          loanId: loan.id,
          paidAmount: newPaidAmount,
          paymentsCompleted: paidCount + ecsSuccessCount,
          status: newLoanStatus as any,
        });
      }

      setActionModalIndex(null);
      setActionModalPaidDate('');
      alert('Paid date saved successfully!');
    } catch (error) {
      console.error('Error saving paid date:', error);
      alert('Failed to save paid date');
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
                  {!readOnly && <th className="text-left px-6 py-3 text-sm font-semibold">View Actions</th>}
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
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-900/40 text-green-300 border border-green-800">Paid {r.paidDate && `(${new Date(r.paidDate).toLocaleDateString('en-IN')})`}</span>
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
                      <>
                        <td className="px-6 py-4">
                          <select
                            value={r.status}
                            onChange={async (e) => {
                              const newStatus = e.target.value as PaymentRow['status'];
                              await setRowStatus(i, newStatus);
                            }}
                            disabled={isEmiLocked(r)} // NEW: Disable if EMI is locked
                            className={`bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm ${
                              isEmiLocked(r) ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                          >
                            <option>Pending</option>
                            <option>Paid</option>
                            <option>ECS Success</option>
                            <option>ECS Bounce</option>
                            <option>Due Missed</option>
                          </select>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => {
                              setActionModalIndex(i);
                              setActionModalPaidDate(r.paidDate || '');
                            }}
                            disabled={r.status === 'Paid' || r.status === 'ECS Success' || r.status === 'Due Missed'} // NEW: Disable if already paid via other method
                            className={`px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white ${
                              r.status === 'Paid' || r.status === 'ECS Success' || r.status === 'Due Missed'
                                ? 'opacity-50 cursor-not-allowed'
                                : 'hover:bg-blue-700'
                            } transition-colors`}
                          >
                            Mark Paid
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Action Modal - Mark as Paid with Date */}
      {actionModalIndex !== null && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4"
          style={{ zIndex: 1001 }}
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setActionModalIndex(null);
              setActionModalPaidDate('');
            }
          }}
        >
          <div className="bg-gray-900 text-gray-100 rounded-xl shadow-2xl border border-gray-700 max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Mark EMI as Paid</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  EMI: <span className="font-bold">{rows[actionModalIndex]?.monthLabel}</span> (Due: {rows[actionModalIndex]?.dueDateStr})
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Enter Paid Date:</label>
                <input
                  type="date"
                  value={actionModalPaidDate}
                  onChange={(e) => setActionModalPaidDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]} // Can't select future dates
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                <p className="text-xs text-gray-400 mt-1">Select the date when the EMI was paid</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setActionModalIndex(null);
                    setActionModalPaidDate('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-700 text-gray-100 rounded-lg hover:bg-gray-600 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (actionModalIndex !== null) {
                      handleSavePaidDate(actionModalIndex, actionModalPaidDate);
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  Save & Mark Paid
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}