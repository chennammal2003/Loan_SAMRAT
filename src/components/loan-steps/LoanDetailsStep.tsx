import React, { useEffect } from 'react';
import { LoanFormData } from '../ApplyLoanModal';

interface LoanDetailsStepProps {
  formData: LoanFormData;
  setFormData: React.Dispatch<React.SetStateAction<LoanFormData>>;
  errors: Record<string, string>;
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

export default function LoanDetailsStep({ formData, setFormData, errors, setErrors }: LoanDetailsStepProps) {
  useEffect(() => {
    if (formData.loanAmount) {
      const amount = parseFloat(formData.loanAmount);
      const fee = amount * 0.03 * 1.18;
      setFormData((prev) => ({ ...prev, processingFee: fee }));
    }
  }, [formData.loanAmount]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrors((prev) => ({ ...prev, proformaInvoice: 'File size must be less than 5MB' }));
        return;
      }
      setFormData((prev) => ({ ...prev, proformaInvoice: file }));
      setErrors((prev) => ({ ...prev, proformaInvoice: '' }));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Interest Scheme <span className="text-red-500">*</span>
        </label>
        <select
          value={formData.interestScheme}
          onChange={(e) => setFormData((prev) => ({ ...prev, interestScheme: e.target.value }))}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="">Select Interest Scheme</option>
          <option value="12 gm">12 gm</option>
          <option value="6 gm">6 gm</option>
        </select>
        {errors.interestScheme && <p className="text-red-500 text-sm mt-1">{errors.interestScheme}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Gold Price Lock Date <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          value={formData.goldPriceLockDate}
          onChange={(e) => setFormData((prev) => ({ ...prev, goldPriceLockDate: e.target.value }))}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
        {errors.goldPriceLockDate && <p className="text-red-500 text-sm mt-1">{errors.goldPriceLockDate}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Proforma Invoice / Estimate <span className="text-red-500">*</span>
        </label>
        <input
          type="file"
          onChange={handleFileChange}
          accept=".pdf,.jpg,.jpeg,.png"
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">PDF, JPG, or PNG (Max 5MB)</p>
        {errors.proformaInvoice && <p className="text-red-500 text-sm mt-1">{errors.proformaInvoice}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Down Payment Details
        </label>
        <textarea
          value={formData.downPaymentDetails}
          onChange={(e) => setFormData((prev) => ({ ...prev, downPaymentDetails: e.target.value }))}
          placeholder="e.g., ₹10,000 paid via UPI"
          rows={3}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Loan Amount Required <span className="text-red-500">*</span>
        </label>
        <select
          value={formData.loanAmount}
          onChange={(e) => setFormData((prev) => ({ ...prev, loanAmount: e.target.value }))}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="">Select Loan Amount</option>
          <option value="60000">₹60,000</option>
          <option value="65000">₹65,000</option>
          <option value="70000">₹70,000</option>
        </select>
        {errors.loanAmount && <p className="text-red-500 text-sm mt-1">{errors.loanAmount}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Tenure <span className="text-red-500">*</span>
        </label>
        <select
          value={formData.tenure}
          onChange={(e) => setFormData((prev) => ({ ...prev, tenure: e.target.value }))}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="">Select Tenure</option>
          <option value="3">3 Months</option>
          <option value="6">6 Months</option>
          <option value="9">9 Months</option>
          <option value="12">12 Months</option>
        </select>
        {errors.tenure && <p className="text-red-500 text-sm mt-1">{errors.tenure}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Tenure-wise EMI Breakup
        </label>
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          {formData.loanAmount && formData.tenure ? (
            <div className="space-y-2">
              {(() => {
                const loanAmount = parseFloat(formData.loanAmount);
                const tenure = parseInt(formData.tenure);

                // EMI calculation using standard formula: EMI = P * r * (1+r)^n / ((1+r)^n - 1)
                // Where r = 0.03 (3% monthly interest rate), n = tenure in months, P = principal
                const calculateEMI = (principal: number, months: number, monthlyRate: number = 0.03) => {
                  const rate = monthlyRate;
                  const numerator = principal * rate * Math.pow(1 + rate, months);
                  const denominator = Math.pow(1 + rate, months) - 1;
                  return Math.round(numerator / denominator);
                };

                const emiAmount = calculateEMI(loanAmount, tenure);

                return (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <p><strong>{tenure} Months:</strong> ₹{emiAmount.toLocaleString('en-IN')} / month</p>
                    <p className="text-xs mt-1">Total Payable: ₹{(emiAmount * tenure).toLocaleString('en-IN')}</p>
                  </div>
                );
              })()}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">Select loan amount and tenure to see EMI breakup</p>
          )}
        </div>
      </div>

      <div>
        <label className="flex items-start space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.gstAccepted as unknown as boolean}
            onChange={(e) => setFormData((prev) => ({ ...prev, gstAccepted: e.target.checked }))}
            className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            I accept GST charges on the processing fee. <span className="text-red-500">*</span>
          </span>
        </label>
        {errors.gstAccepted && <p className="text-red-500 text-sm mt-1">{errors.gstAccepted}</p>}
      </div>
    </div>
  );
}
