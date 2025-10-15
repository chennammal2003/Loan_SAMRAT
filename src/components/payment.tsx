import React, { useState } from 'react';
import {
  CreditCard,
  Calendar,
  DollarSign,
  FileText,
  CheckCircle,
  Upload,
  User,
  AlertCircle,
  Save
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PaymentFormData {
  loanId: string;
  borrowerName: string;
  mobileNumber: string;
  paymentDate: string;
  paymentAmount: string;
  paymentMode: string;
  transactionId: string;
  bankName: string;
  chequeNumber: string;
  upiId: string;
  remarks: string;
  paymentProof: File | null;
  lateFee: string;
  penaltyAmount: string;
  totalPaid: string;
  receiptNumber: string;
}

const Payment: React.FC = () => {
  const [formData, setFormData] = useState<PaymentFormData>({
    loanId: '',
    borrowerName: '',
    mobileNumber: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentAmount: '',
    paymentMode: 'cash',
    transactionId: '',
    bankName: '',
    chequeNumber: '',
    upiId: '',
    remarks: '',
    paymentProof: null,
    lateFee: '0',
    penaltyAmount: '0',
    totalPaid: '',
    receiptNumber: ''
  });

  const [fileName, setFileName] = useState<string>('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };

      // Auto-calculate total paid
      if (name === 'paymentAmount' || name === 'lateFee' || name === 'penaltyAmount') {
        const payment = parseFloat(name === 'paymentAmount' ? value : updated.paymentAmount) || 0;
        const late = parseFloat(name === 'lateFee' ? value : updated.lateFee) || 0;
        const penalty = parseFloat(name === 'penaltyAmount' ? value : updated.penaltyAmount) || 0;
        updated.totalPaid = (payment + late + penalty).toFixed(2);
      }

      return updated;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFormData(prev => ({ ...prev, paymentProof: file }));
      setFileName(file.name);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const loanId = formData.loanId.trim();
      if (!loanId) throw new Error('Loan ID is required');

      const amount = parseFloat(formData.paymentAmount || '0') || 0;
      const late = parseFloat(formData.lateFee || '0') || 0;
      const penalty = parseFloat(formData.penaltyAmount || '0') || 0;
      const totalPaid = parseFloat(formData.totalPaid || `${amount + late + penalty}`) || 0;

      // 1) Optional: upload proof to Storage bucket 'payment_proofs'
      let proof_path: string | null = null;
      let proof_url: string | null = null;
      if (formData.paymentProof) {
        const file = formData.paymentProof;
        const filePath = `${loanId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9_.-]/g, '')}`;
        const { error: upErr } = await supabase.storage.from('payment_proofs').upload(filePath, file, {
          upsert: false,
        });
        if (upErr) throw new Error(`Proof upload failed: ${upErr.message}`);
        const { data: pub } = supabase.storage.from('payment_proofs').getPublicUrl(filePath);
        proof_path = filePath;
        proof_url = pub?.publicUrl || null;
      }

      // 2) Insert into payments table
      const { error: insErr } = await supabase.from('payments').insert({
        loan_id: loanId,
        borrower_name: formData.borrowerName || null,
        mobile_number: formData.mobileNumber || null,
        payment_date: formData.paymentDate,
        payment_amount: amount,
        payment_mode: formData.paymentMode,
        transaction_id: formData.transactionId || null,
        bank_name: formData.bankName || null,
        cheque_number: formData.chequeNumber || null,
        upi_id: formData.upiId || null,
        remarks: formData.remarks || null,
        proof_path,
        proof_url,
        late_fee: late,
        penalty_amount: penalty,
        total_paid: totalPaid,
        receipt_number: formData.receiptNumber || null,
      });
      if (insErr) throw new Error(insErr.message);

      // 3) Update the loan's paid_amount (fetch current and set new value)
      const { data: loanRow, error: loanErr } = await supabase
        .from('loans')
        .select('id, paid_amount')
        .eq('id', loanId)
        .single();
      if (loanErr) throw new Error(loanErr.message);
      const currentPaid = Number((loanRow as any)?.paid_amount || 0);
      const newPaid = currentPaid + totalPaid;
      const { error: updErr } = await supabase
        .from('loans')
        .update({ paid_amount: newPaid })
        .eq('id', loanId);
      if (updErr) throw new Error(updErr.message);

      setShowSuccess(true);
      // Reset form after success
      setFormData({
        loanId: '',
        borrowerName: '',
        mobileNumber: '',
        paymentDate: new Date().toISOString().split('T')[0],
        paymentAmount: '',
        paymentMode: 'cash',
        transactionId: '',
        bankName: '',
        chequeNumber: '',
        upiId: '',
        remarks: '',
        paymentProof: null,
        lateFee: '0',
        penaltyAmount: '0',
        totalPaid: '',
        receiptNumber: ''
      });
      setFileName('');
      setTimeout(() => setShowSuccess(false), 2500);
    } catch (e: any) {
      setError(e.message || 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-950 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Payment Entry</h1>
          <p className="text-slate-600 dark:text-gray-300">Record loan repayment details from borrowers</p>
        </div>

        {/* Success / Error Message */}
        {showSuccess && (
          <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 flex items-center gap-3 animate-fade-in">
            <CheckCircle className="w-6 h-6 text-green-600" />
            <div>
              <p className="font-semibold text-green-800 dark:text-green-300">Payment Recorded Successfully!</p>
              <p className="text-sm text-green-700 dark:text-green-400">The payment tracker has been updated.</p>
            </div>
          </div>
        )}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Loan & Borrower Information */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">

            <div className="flex items-center gap-3 mb-6">
              <div className="bg-blue-100 p-2 rounded-lg">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">Loan & Borrower Details</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-gray-300 mb-2">
                  Loan ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="loanId"
                  value={formData.loanId}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., LN001"
                  className="w-full px-4 py-3 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-gray-300 mb-2">
                  Borrower Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="borrowerName"
                  value={formData.borrowerName}
                  onChange={handleInputChange}
                  required
                  placeholder="Full name"
                  className="w-full px-4 py-3 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-gray-300 mb-2">
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  name="mobileNumber"
                  value={formData.mobileNumber}
                  onChange={handleInputChange}
                  required
                  placeholder="+91 98765 43210"
                  className="w-full px-4 py-3 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Payment Details */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-green-100 p-2 rounded-lg">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">Payment Information</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-gray-300 mb-2">
                  Payment Date <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="date"
                    name="paymentDate"
                    value={formData.paymentDate}
                    onChange={handleInputChange}
                    required
                    className="w-full pl-10 pr-4 py-3 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-gray-300 mb-2">
                  Payment Amount (EMI) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 font-medium">₹</span>
                  <input
                    type="number"
                    name="paymentAmount"
                    value={formData.paymentAmount}
                    onChange={handleInputChange}
                    required
                    step="0.01"
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-3 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-gray-300 mb-2">
                  Late Fee (if any)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 font-medium">₹</span>
                  <input
                    type="number"
                    name="lateFee"
                    value={formData.lateFee}
                    onChange={handleInputChange}
                    step="0.01"
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-3 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-gray-300 mb-2">
                  Penalty Amount (if any)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 font-medium">₹</span>
                  <input
                    type="number"
                    name="penaltyAmount"
                    value={formData.penaltyAmount}
                    onChange={handleInputChange}
                    step="0.01"
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-3 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700 dark:text-gray-200">Total Amount Paid</span>
                    <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      ₹{formData.totalPaid || '0.00'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Mode Details */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-purple-100 p-2 rounded-lg">
                <CreditCard className="w-5 h-5 text-purple-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">Payment Mode</h2>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-gray-300 mb-2">
                  Select Payment Mode <span className="text-red-500">*</span>
                </label>
                <select
                  name="paymentMode"
                  value={formData.paymentMode}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >

                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                  <option value="upi">UPI</option>
                  <option value="neft">NEFT/RTGS</option>
                  <option value="imps">IMPS</option>
                  <option value="card">Debit/Credit Card</option>
                </select>
              </div>

              {/* Conditional fields based on payment mode */}
              {formData.paymentMode !== 'cash' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-gray-300 mb-2">
                      Transaction ID / Reference Number
                    </label>
                    <input
                      type="text"
                      name="transactionId"
                      value={formData.transactionId}
                      onChange={handleInputChange}
                      placeholder="Enter transaction ID"
                      className="w-full px-4 py-3 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  {(formData.paymentMode === 'neft' || formData.paymentMode === 'imps' || formData.paymentMode === 'cheque') && (
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-gray-300 mb-2">
                        Bank Name
                      </label>
                      <input
                        type="text"
                        name="bankName"
                        value={formData.bankName}
                        onChange={handleInputChange}
                        placeholder="Enter bank name"
                        className="w-full px-4 py-3 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  )}

                  {formData.paymentMode === 'cheque' && (
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-gray-300 mb-2">
                        Cheque Number
                      </label>
                      <input
                        type="text"
                        name="chequeNumber"
                        value={formData.chequeNumber}
                        onChange={handleInputChange}
                        placeholder="Enter cheque number"
                        className="w-full px-4 py-3 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  )}

                  {formData.paymentMode === 'upi' && (
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-gray-300 mb-2">
                        UPI ID
                      </label>
                      <input
                        type="text"
                        name="upiId"
                        value={formData.upiId}
                        onChange={handleInputChange}
                        placeholder="example@upi"
                        className="w-full px-4 py-3 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Additional Information */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-orange-100 p-2 rounded-lg">
                <FileText className="w-5 h-5 text-orange-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">Additional Details</h2>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-gray-300 mb-2">
                  Receipt Number
                </label>
                <input
                  type="text"
                  name="receiptNumber"
                  value={formData.receiptNumber}
                  onChange={handleInputChange}
                  placeholder="Auto-generated or manual entry"
                  className="w-full px-4 py-3 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-gray-300 mb-2">
                  Payment Proof / Screenshot
                </label>
                <div className="relative">
                  <input
                    type="file"
                    onChange={handleFileChange}
                    accept="image/*,.pdf"
                    className="hidden"
                    id="paymentProof"
                  />
                  <label
                    htmlFor="paymentProof"
                    className="flex items-center justify-center w-full px-4 py-8 border-2 border-dashed border-slate-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="text-center">
                      <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm font-medium text-slate-700 dark:text-gray-200">
                        {fileName || 'Click to upload payment proof'}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                        PNG, JPG, PDF up to 10MB
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-gray-300 mb-2">
                  Remarks / Notes
                </label>
                <textarea
                  name="remarks"
                  value={formData.remarks}
                  onChange={handleInputChange}
                  rows={4}
                  placeholder="Add any additional notes about this payment..."
                  className="w-full px-4 py-3 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex items-center justify-end gap-4">
              <button
                type="button"
                className="px-6 py-3 border border-slate-300 dark:border-gray-600 text-slate-700 dark:text-gray-200 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className={`px-8 py-3 rounded-lg transition-colors flex items-center gap-2 font-medium shadow-sm ${submitting ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
              >
                <Save className="w-5 h-5" />
              {submitting ? 'Recording...' : 'Record Payment'}
              </button>
          </div>
        </form>

        {/* Information Note */}
        <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-300">
            <p className="font-semibold mb-1">Important Notes:</p>
            <ul className="list-disc list-inside space-y-1 text-blue-700 dark:text-blue-400">
              <li>Ensure all payment details are accurate before submission</li>
              <li>Upload payment proof for non-cash transactions</li>
              <li>The Payment Tracker will be updated automatically upon submission</li>
              <li>Receipt will be generated for the borrower's record</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Payment;