import { useEffect, useMemo, useState } from 'react';
import { X, RefreshCw } from 'lucide-react';
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
  const [isRefreshing, setIsRefreshing] = useState(false);

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
        // STEP 1: Build the base schedule with computed EMI amounts
        const computed: PaymentRow[] = schedule.map((slot) => {
          return {
            monthLabel: slot.monthLabel,
            dueDateStr: slot.dueDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
            amount: computedEmi,
            status: 'Pending' as const,
          };
        });

        // STEP 2: Try to fetch SAVED statuses from product_emi_statuses table (PRIMARY SOURCE)
        let finalRows = [...computed];
        try {
          const { data: saved, error: statusErr } = await supabase
            .from('product_emi_statuses')
            .select('installment_index,status,paid_date,payment_method,paid_by_user_id')
            .eq('product_loan_id', loan.id)
            .order('installment_index');
          
          if (!statusErr && saved && saved.length > 0) {
            // Merge saved data with computed schedule
            finalRows = computed.map((r, i) => {
              const savedRecord = (saved as any[]).find((s) => Number(s.installment_index) === i);
              if (savedRecord) {
                return { 
                  ...r, 
                  status: savedRecord.status as PaymentRow['status'],
                  paidDate: savedRecord.paid_date,
                  paymentMethod: savedRecord.payment_method,
                  paidByUserId: savedRecord.paid_by_user_id
                };
              }
              return r;
            });
          }
        } catch (err) {
          console.warn('product_emi_statuses fetch error (non-critical):', err);
          // If product_emi_statuses doesn't exist, try fallback
        }

        // STEP 3: If no data from product_emi_statuses, try fallback to legacy emi_statuses
        if (finalRows.every(r => r.status === 'Pending')) {
          try {
            const { data: legacySaved, error: legacyErr } = await supabase
              .from('emi_statuses')
              .select('installment_index,status,paid_date,payment_method,paid_by_user_id')
              .eq('loan_id', loan.id)
              .order('installment_index');
            
            if (!legacyErr && legacySaved && legacySaved.length > 0) {
              finalRows = computed.map((r, i) => {
                const legacyRecord = (legacySaved as any[]).find((s) => Number(s.installment_index) === i);
                if (legacyRecord) {
                  return { 
                    ...r, 
                    status: legacyRecord.status as PaymentRow['status'],
                    paidDate: legacyRecord.paid_date,
                    paymentMethod: legacyRecord.payment_method,
                    paidByUserId: legacyRecord.paid_by_user_id
                  };
                }
                return r;
              });
            }
          } catch (err) {
            console.warn('emi_statuses fallback fetch error (non-critical):', err);
          }
        }

        // STEP 4: Set final rows (either from product_emi_statuses, emi_statuses, or computed defaults)
        setRows(finalRows);

        // STEP 5: Subscribe to real-time changes in product_emi_statuses
        // This ensures data stays synced even if another admin updates it
        const subscription = supabase
          .channel(`product_emi_statuses:${loan.id}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'product_emi_statuses',
              filter: `product_loan_id=eq.${loan.id}`
            },
            (payload) => {
              console.log('EMI Status Change Detected:', payload);
              // Fetch latest data when changes occur
              fetchPayments();
            }
          )
          .subscribe();

        // Cleanup subscription on unmount
        return () => {
          subscription.unsubscribe();
        };
      } catch (e: any) {
        setError(e.message || 'Failed to load payment details');
      } finally {
        setLoading(false);
      }
    };
    
    fetchPayments();
  }, [loan.id, computedEmi, schedule]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Force re-fetch from database
      const { data: saved, error: statusErr } = await supabase
        .from('product_emi_statuses')
        .select('installment_index,status,paid_date,payment_method,paid_by_user_id')
        .eq('product_loan_id', loan.id)
        .order('installment_index');
      
      if (!statusErr && saved && saved.length > 0) {
        const updatedRows = rows.map((r, i) => {
          const savedRecord = (saved as any[]).find((s) => Number(s.installment_index) === i);
          if (savedRecord) {
            return {
              ...r,
              status: savedRecord.status as PaymentRow['status'],
              paidDate: savedRecord.paid_date,
              paymentMethod: savedRecord.payment_method,
              paidByUserId: savedRecord.paid_by_user_id
            };
          }
          return r;
        });
        setRows(updatedRows);
      }
    } catch (err) {
      console.error('Manual refresh error:', err);
    } finally {
      setIsRefreshing(false);
    }
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
      // STEP 1: Get the CURRENT (old) status BEFORE making any changes
      // Try product_emi_statuses first (new), fallback to emi_statuses (old)
      let oldEmiData: any = null;
      let fetchError: any = null;
      
      // Try new table first
      const { data: newTableData, error: newTableError } = await supabase
        .from('product_emi_statuses')
        .select('status, paid_date, payment_method')
        .eq('product_loan_id', loan.id)
        .eq('installment_index', installmentIndex)
        .maybeSingle();

      if (!newTableError) {
        oldEmiData = newTableData;
      } else {
        // Fallback to old table (for backward compatibility)
        const { data: oldTableData, error: oldTableError } = await supabase
          .from('emi_statuses')
          .select('status, paid_date, payment_method')
          .eq('loan_id', loan.id)
          .eq('installment_index', installmentIndex)
          .maybeSingle();
        
        oldEmiData = oldTableData;
        fetchError = oldTableError;
      }

      if (fetchError && !oldEmiData) throw fetchError;

      const oldStatus = (oldEmiData?.status as PaymentRow['status']) || 'Pending';
      const wasOldPaid = oldStatus === 'Paid' || oldStatus === 'ECS Success';

      // STEP 2: Get current paid amount from product_loans table
      const { data: loanData, error: loanFetchError } = await supabase
        .from('product_loans')
        .select('paid_amount')
        .eq('id', loan.id)
        .maybeSingle();

      if (loanFetchError) throw loanFetchError;

      const currentPaidAmount = Number(loanData?.paid_amount || 0);
      const emiAmount = computedEmi;

      // STEP 3: Calculate new paid amount (only add if this EMI wasn't already paid)
      let newPaidAmount = currentPaidAmount;
      if (!wasOldPaid) {
        newPaidAmount += emiAmount;
      }

      // STEP 4: Upsert the EMI status with ALL required fields
      // Try product_emi_statuses first (new), fallback to emi_statuses (old)
      let upsertError: any = null;
      
      const newStatus = rows[installmentIndex]?.status || 'Paid'; // Use status from modal
      const currentRow = rows[installmentIndex];
      
      // Build base upsert data with required fields only
      const upsertData: any = {
        status: newStatus, // Use the status selected in modal
        payment_method: newStatus === 'Paid' ? 'manual' : (newStatus === 'ECS Success' ? 'ecs' : newStatus === 'ECS Bounce' ? 'ecs_bounce' : 'missed'),
        paid_date: paidDate,
        paid_by_user_id: profile?.id,
        updated_at: new Date().toISOString(),
        created_at: oldEmiData?.status === 'Pending' ? new Date().toISOString() : undefined,
      };
      
      // Optional: Store month label and due date if columns exist
      if (currentRow?.monthLabel) {
        upsertData.month_label = currentRow.monthLabel;
      }
      if (currentRow?.dueDateStr) {
        upsertData.due_date = currentRow.dueDateStr;
      }

      // Try new table structure first
      const { error: newTableUpsertError } = await supabase
        .from('product_emi_statuses')
        .upsert(
          {
            product_loan_id: loan.id,
            installment_index: installmentIndex,
            ...upsertData
          },
          { onConflict: 'product_loan_id,installment_index' } as any
        );

      if (newTableUpsertError) {
        // Try old table structure (legacy fallback)
        const { error: oldTableUpsertError } = await supabase
          .from('emi_statuses')
          .upsert(
            {
              loan_id: loan.id,
              installment_index: installmentIndex,
              ...upsertData
            },
            { onConflict: 'loan_id,installment_index' } as any
          );
        
        upsertError = oldTableUpsertError;
      }

      if (upsertError) throw upsertError;

      // STEP 5: Also log this change in the audit table for compliance
      // Try new table first, fallback to old
      const auditData: any = {
        installment_index: installmentIndex,
        old_status: oldStatus,
        new_status: newStatus, // Use the status from modal
        paid_date: paidDate,
        payment_method: newStatus === 'Paid' ? 'manual' : (newStatus === 'ECS Success' ? 'ecs' : newStatus === 'ECS Bounce' ? 'ecs_bounce' : 'missed'),
        changed_by: profile?.id,
        notes: `Marked as ${newStatus} on ${new Date().toLocaleDateString('en-IN')} by ${profile?.full_name || 'Admin'}`,
      };
      
      // Optional: Include month and due date if columns exist
      if (currentRow?.monthLabel) {
        auditData.month_label = currentRow.monthLabel;
      }
      if (currentRow?.dueDateStr) {
        auditData.due_date = currentRow.dueDateStr;
      }

      const { error: newAuditError } = await supabase
        .from('product_emi_payment_audit')
        .insert({
          product_loan_id: loan.id,
          ...auditData
        });

      if (newAuditError) {
        // Fallback to old audit table
        const { error: oldAuditError } = await supabase
          .from('emi_payment_audit')
          .insert({
            loan_id: loan.id,
            ...auditData
          });
        
        if (oldAuditError) {
          console.warn('Audit log error (non-critical):', oldAuditError);
        }
      }

      // STEP 6: Update product_loans table with new paid_amount
      // Try product_loans first, fallback to loans
      let loanUpdateError: any = null;

      const { error: productLoanError } = await supabase
        .from('product_loans')
        .update({ 
          paid_amount: newPaidAmount,
          last_payment_date: paidDate,
          payment_updated_at: new Date().toISOString()
        })
        .eq('id', loan.id);

      if (productLoanError) {
        // Fallback to legacy loans table
        const { error: legacyLoanError } = await supabase
          .from('loans')
          .update({ 
            paid_amount: newPaidAmount,
            updated_at: new Date().toISOString()
          })
          .eq('id', loan.id);
        
        loanUpdateError = legacyLoanError;
      }

      if (loanUpdateError) throw loanUpdateError;

      // STEP 7: Fetch ALL product_emi_statuses to recalculate loan status
      // Try product_emi_statuses first, fallback to emi_statuses
      let allStatuses: any = null;
      let statusError: any = null;

      const { data: newTableStatuses, error: newTableStatusError } = await supabase
        .from('product_emi_statuses')
        .select('status')
        .eq('product_loan_id', loan.id);

      if (!newTableStatusError) {
        allStatuses = newTableStatuses;
      } else {
        // Fallback to old table
        const { data: oldTableStatuses, error: oldTableStatusError } = await supabase
          .from('emi_statuses')
          .select('status')
          .eq('loan_id', loan.id);
        
        allStatuses = oldTableStatuses;
        statusError = oldTableStatusError;
      }

      if (statusError) throw statusError;

      // STEP 8: Count statuses and determine new loan status
      const statuses = (allStatuses || []).map((s: any) => s.status);
      const paidCount = statuses.filter((s: any) => s === 'Paid').length;
      const ecsSuccessCount = statuses.filter((s: any) => s === 'ECS Success').length;
      const bounceCount = statuses.filter((s: any) => s === 'ECS Bounce').length;
      const dueMissedCount = statuses.filter((s: any) => s === 'Due Missed').length;
      const totalCompleted = paidCount + ecsSuccessCount;

      // STEP 9: Determine loan status based on EMI counts
      let newLoanStatus: string = 'ontrack';
      
      if (bounceCount > 0) {
        newLoanStatus = 'bounce';
      } else if (dueMissedCount > 0) {
        newLoanStatus = 'overdue';
      } else if (totalCompleted === loan.tenure && loan.tenure > 0) {
        // All EMIs are paid
        newLoanStatus = 'paid';
      } else if (totalCompleted > 0) {
        // Some EMIs are paid
        newLoanStatus = 'ontrack';
      }

      // STEP 10: Update the loan payment_status in database
      // Try product_loans first, fallback to loans
      let statusUpdateError: any = null;

      const { error: productStatusError } = await supabase
        .from('product_loans')
        .update({ 
          payment_status: newLoanStatus,
          payment_updated_at: new Date().toISOString()
        })
        .eq('id', loan.id);

      if (productStatusError) {
        // Fallback to legacy loans table
        const { error: legacyStatusError } = await supabase
          .from('loans')
          .update({ 
            status: newLoanStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', loan.id);
        
        statusUpdateError = legacyStatusError;
      }

      if (statusUpdateError) throw statusUpdateError;

      // STEP 11: Update UI state with new row data
      setRows((prev) =>
        prev.map((r, idx) =>
          idx === installmentIndex
            ? {
                ...r,
                status: 'Paid',
                paidDate: paidDate,
                paymentMethod: 'manual',
                paidByUserId: profile?.id,
              }
            : r
        )
      );

      // STEP 12: Notify parent component of changes
      if (onUpdated) {
        onUpdated({
          loanId: loan.id,
          paidAmount: newPaidAmount,
          paymentsCompleted: totalCompleted,
          status: newLoanStatus as any,
        });
      }

      // STEP 13: Close modal and show success with detailed info
      setActionModalIndex(null);
      setActionModalPaidDate('');
      
      const successMessage = `✅ EMI Status Updated Successfully!\n\n` +
        `Month: ${rows[installmentIndex]?.monthLabel}\n` +
        `New Status: ${newStatus}\n` +
        `Paid Date: ${new Date(paidDate).toLocaleDateString('en-IN')}\n` +
        `Amount: ₹${emiAmount.toLocaleString('en-IN')}\n` +
        `Loan Status: ${newLoanStatus.toUpperCase()}\n` +
        `Total Paid: ₹${newPaidAmount.toLocaleString('en-IN')}\n` +
        `Payments Completed: ${totalCompleted}/${loan.tenure}`;
      
      alert(successMessage);
    } catch (error) {
      console.error('Error saving paid date:', error);
      const errorMsg = (error as any).message || 'Unknown error';
      const detailedError = `❌ Failed to save paid date\n\n` +
        `Error: ${errorMsg}\n\n` +
        `Please ensure:\n` +
        `1. Database migration has been run\n` +
        `2. All required fields exist in emi_statuses table\n` +
        `3. You have proper permissions`;
      alert(detailedError);
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
      <div className="mt-10 w-full max-w-3xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {loan.applicationNumber ? `App: ${loan.applicationNumber}` : `Loan ${loan.id}`} — {loan.fullName}
            </h3>
            {loan.createdAt && (
              <div className="text-xs text-gray-600 dark:text-gray-300">
                Applied On: {new Date(loan.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: '2-digit' })}
              </div>
            )}
            {!isAdmin && (
              <span className="px-2 py-1 text-xs font-medium bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-800 rounded-full">
                Read Only
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleManualRefresh} 
              disabled={isRefreshing}
              title="Refresh payment data"
              className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 text-gray-600 dark:text-gray-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
              <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        <div className="p-0">
          {/* LOAN STATUS SUMMARY SECTION */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600 grid grid-cols-2 gap-4">
            {/* DISBURSEMENT STATUS */}
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/40">
                  <span className="text-blue-600 dark:text-blue-400 text-lg font-semibold">💰</span>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Loan Disbursed</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {loan.disbursedDate ? new Date(loan.disbursedDate).toLocaleDateString('en-IN') : 'N/A'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">₹{loan.loanAmount?.toLocaleString('en-IN')}</p>
              </div>
            </div>

            {/* PRODUCT DELIVERY STATUS */}
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <div className={`flex items-center justify-center h-10 w-10 rounded-full ${
                  loan.productDeliveryStatus === 'Delivered' 
                    ? 'bg-green-100 dark:bg-green-900/40' 
                    : 'bg-amber-100 dark:bg-amber-900/40'
                }`}>
                  <span className={`text-lg font-semibold ${
                    loan.productDeliveryStatus === 'Delivered'
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}>
                    {loan.productDeliveryStatus === 'Delivered' ? '✅' : '⏳'}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Product Delivery</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {loan.productDeliveryStatus || 'Pending'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {loan.productDeliveredDate 
                    ? new Date(loan.productDeliveredDate).toLocaleDateString('en-IN')
                    : 'Not yet delivered'}
                </p>
              </div>
            </div>

            {/* EMI PAYMENT PROGRESS */}
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/40">
                  <span className="text-purple-600 dark:text-purple-400 text-lg font-semibold">📊</span>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">EMI Progress</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {rows.filter(r => r.status === 'Paid' || r.status === 'ECS Success').length}/{loan.tenure} Paid
                </p>
                <div className="w-32 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full overflow-hidden mt-1">
                  <div 
                    className={`h-full transition-all ${
                      rows.filter(r => r.status === 'Paid' || r.status === 'ECS Success').length === loan.tenure
                        ? 'bg-green-500'
                        : 'bg-blue-500'
                    }`}
                    style={{ width: `${((rows.filter(r => r.status === 'Paid' || r.status === 'ECS Success').length || 0) / (loan.tenure || 1)) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* LOAN COMPLETION STATUS */}
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <div className={`flex items-center justify-center h-10 w-10 rounded-full ${
                  rows.filter(r => r.status === 'Paid' || r.status === 'ECS Success').length === loan.tenure
                    ? 'bg-green-100 dark:bg-green-900/40'
                    : 'bg-orange-100 dark:bg-orange-900/40'
                }`}>
                  <span className={`text-lg font-semibold ${
                    rows.filter(r => r.status === 'Paid' || r.status === 'ECS Success').length === loan.tenure
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-orange-600 dark:text-orange-400'
                  }`}>
                    {rows.filter(r => r.status === 'Paid' || r.status === 'ECS Success').length === loan.tenure ? '🎉' : '⏱️'}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Loan Status</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {rows.filter(r => r.status === 'Paid' || r.status === 'ECS Success').length === loan.tenure
                    ? '✅ FULLY PAID'
                    : '⏳ IN PROGRESS'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {rows.filter(r => r.status === 'Paid' || r.status === 'ECS Success').length === loan.tenure
                    ? 'All EMIs completed'
                    : `${loan.tenure - (rows.filter(r => r.status === 'Paid' || r.status === 'ECS Success').length || 0)} EMIs remaining`}
                </p>
              </div>
            </div>
          </div>

          {/* DELIVERY STATUS INFO */}
          {loan.productDeliveryStatus === 'Pending' && (
            <div className="px-6 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-sm text-amber-800 dark:text-amber-300">
                <strong>⏳ Note:</strong> Product delivery status is still <strong>Pending</strong>. Please go to "Product Loans" and mark the product as delivered to start EMI tracking from the delivery date.
              </p>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <tr>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-gray-900 dark:text-white">Month</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-gray-900 dark:text-white">Due Date</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-gray-900 dark:text-white">Amount</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-gray-900 dark:text-white">Current Status</th>
                  {!readOnly && <th className="text-left px-6 py-3 text-sm font-semibold text-gray-900 dark:text-white">View Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {loading && (
                  <tr>
                    <td colSpan={readOnly ? 4 : 5} className="px-6 py-8 text-center text-gray-600 dark:text-gray-400">Loading...</td>
                  </tr>
                )}
                {error && !loading && (
                  <tr>
                    <td colSpan={readOnly ? 4 : 5} className="px-6 py-8 text-center text-red-600 dark:text-red-400">{error}</td>
                  </tr>
                )}
                {!loading && !error && rows.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 text-gray-900 dark:text-white">{r.monthLabel}</td>
                    <td className="px-6 py-4 text-gray-900 dark:text-white">{r.dueDateStr}</td>
                    <td className="px-6 py-4 text-gray-900 dark:text-white">₹{r.amount.toLocaleString('en-IN')}</td>
                    <td className="px-6 py-4">
                      {r.status === 'Paid' && (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 border border-green-300 dark:border-green-800">Paid {r.paidDate && `(${new Date(r.paidDate).toLocaleDateString('en-IN')})`}</span>
                      )}
                      {r.status === 'ECS Success' && (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">ECS Success</span>
                      )}
                      {r.status === 'ECS Bounce' && (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-800">ECS Bounce</span>
                      )}
                      {r.status === 'Due Missed' && (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300 border border-orange-300 dark:border-orange-800">Due Missed</span>
                      )}
                      {r.status === 'Pending' && (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">Pending</span>
                      )}
                    </td>
                    {!readOnly && (
                      <>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => {
                              setActionModalIndex(i);
                              setActionModalPaidDate(r.paidDate || '');
                            }}
                            disabled={r.status === 'Paid' || r.status === 'ECS Success'}
                            className={`px-3 py-1.5 text-sm rounded-md text-white font-medium ${
                              r.status === 'Paid' || r.status === 'ECS Success'
                                ? 'bg-gray-400 cursor-not-allowed opacity-50'
                                : 'bg-blue-600 hover:bg-blue-700'
                            } transition-colors`}
                            title={r.status === 'Paid' || r.status === 'ECS Success' ? 'Cannot edit paid EMIs' : 'Click to mark as paid or update status'}
                          >
                            {r.status === 'Paid' ? '✓ Paid' : r.status === 'ECS Success' ? '✓ ECS Success' : 'Mark Paid'}
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

      {/* Action Modal - Mark as Paid with Date and Status */}
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
          <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Mark EMI as Paid</h3>
            
            {/* Current Status Info */}
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>Current Status:</strong> {rows[actionModalIndex]?.status}
              </p>
              {(rows[actionModalIndex]?.status === 'Paid' || rows[actionModalIndex]?.status === 'ECS Success') && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">ℹ️ This EMI is already paid and cannot be edited.</p>
              )}
              {(rows[actionModalIndex]?.status === 'Due Missed' || rows[actionModalIndex]?.status === 'ECS Bounce') && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">✓ This EMI can be updated. Mark as paid or change status.</p>
              )}
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  EMI: <span className="font-bold">{rows[actionModalIndex]?.monthLabel}</span>
                </label>
                <p className="text-xs text-gray-600 dark:text-gray-400">Due: {rows[actionModalIndex]?.dueDateStr}</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Update Status:</label>
                <select
                  value={rows[actionModalIndex]?.status || 'Pending'}
                  onChange={(e) => {
                    const newStatus = e.target.value as PaymentRow['status'];
                    setRows((prev) =>
                      prev.map((r, idx) =>
                        idx === actionModalIndex ? { ...r, status: newStatus } : r
                      )
                    );
                  }}
                  className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="Pending">Pending - Not yet paid</option>
                  <option value="Paid">✓ Paid - Mark as manually paid</option>
                  <option value="ECS Success">✓ ECS Success - Paid via ECS</option>
                  <option value="ECS Bounce">⚠️ ECS Bounce - Payment failed</option>
                  <option value="Due Missed">⚠️ Due Missed - Payment overdue</option>
                </select>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {rows[actionModalIndex]?.status === 'Paid' || rows[actionModalIndex]?.status === 'ECS Success' 
                    ? '🔒 Read-only - Already paid' 
                    : '✏️ Editable - Change the payment status'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Paid Date:</label>
                <input
                  type="date"
                  value={actionModalPaidDate}
                  onChange={(e) => setActionModalPaidDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  disabled={rows[actionModalIndex]?.status === 'Paid' || rows[actionModalIndex]?.status === 'ECS Success'}
                  className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${
                    rows[actionModalIndex]?.status === 'Paid' || rows[actionModalIndex]?.status === 'ECS Success'
                      ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-50'
                      : 'bg-gray-50 dark:bg-gray-700'
                  }`}
                />
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {rows[actionModalIndex]?.status === 'Paid' || rows[actionModalIndex]?.status === 'ECS Success'
                    ? 'Date is locked for paid EMIs'
                    : 'Select when the payment was made'}
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setActionModalIndex(null);
                    setActionModalPaidDate('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (actionModalIndex !== null) {
                      handleSavePaidDate(actionModalIndex, actionModalPaidDate);
                    }
                  }}
                  disabled={rows[actionModalIndex]?.status === 'Paid' || rows[actionModalIndex]?.status === 'ECS Success'}
                  className={`flex-1 px-4 py-2 rounded-lg transition-colors font-medium ${
                    rows[actionModalIndex]?.status === 'Paid' || rows[actionModalIndex]?.status === 'ECS Success'
                      ? 'bg-gray-400 text-gray-100 cursor-not-allowed opacity-50'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  Save & Update
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}