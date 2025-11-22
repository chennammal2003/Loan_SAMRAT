import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { LoanFormData } from '../ApplyLoanModal';

interface DeclarationStepProps {
  formData: LoanFormData;
  setFormData: React.Dispatch<React.SetStateAction<LoanFormData>>;
  errors: Record<string, string>;
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

export default function DeclarationStep({ formData, setFormData }: DeclarationStepProps) {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-blue-50 to-green-50 dark:from-blue-900/20 dark:to-green-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl p-6">
        <div className="flex items-start space-x-4 mb-6">
          <CheckCircle2 className="w-8 h-8 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1" />
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Application Summary</h3>
            <p className="text-gray-600 dark:text-gray-300">
              Please review your application details before final submission
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
            <p className="text-gray-500 dark:text-gray-400 mb-1">Applicant Name</p>
            <p className="font-semibold text-gray-900 dark:text-white">
              {formData.firstName} {formData.lastName}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
            <p className="text-gray-500 dark:text-gray-400 mb-1">Loan Amount</p>
            <p className="font-semibold text-gray-900 dark:text-white">
              ₹{formData.loanAmount ? Number(formData.loanAmount).toLocaleString('en-IN') : '0'}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
            <p className="text-gray-500 dark:text-gray-400 mb-1">Tenure</p>
            <p className="font-semibold text-gray-900 dark:text-white">
              {formData.tenure} Months
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
            <p className="text-gray-500 dark:text-gray-400 mb-1">Processing Fee</p>
            <p className="font-semibold text-gray-900 dark:text-white">
              ₹{formData.processingFee.toFixed(2)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
            <p className="text-gray-500 dark:text-gray-400 mb-1">Contact</p>
            <p className="font-semibold text-gray-900 dark:text-white">
              {formData.mobilePrimary}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
            <p className="text-gray-500 dark:text-gray-400 mb-1">Email</p>
            <p className="font-semibold text-gray-900 dark:text-white truncate">
              {formData.emailId}
            </p>
          </div>
          {formData.referralCode && (
            <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg border border-green-200 dark:border-green-800">
              <p className="text-gray-500 dark:text-gray-400 mb-1">Referral Code</p>
              <p className="font-semibold text-green-700 dark:text-green-300">
                ✓ {formData.referralCode}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Declaration & Undertaking</h3>

        <div className="space-y-4 mb-6 text-sm text-gray-600 dark:text-gray-300">
          <p>I hereby declare and undertake that:</p>

          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>All information provided in this application is true, accurate, and complete to the best of my knowledge.</li>
            <li>I understand that any false or misleading information may result in the rejection of my loan application or cancellation of the approved loan.</li>
            <li>I authorize the company to verify the information provided and conduct necessary background checks.</li>
            <li>I have read and understood all terms and conditions associated with this loan application.</li>
            <li>I agree to provide any additional documents or information as may be required during the processing of this application.</li>
            <li>I understand that the submission of this application does not guarantee loan approval.</li>
            <li>I consent to the use of my personal information for the purpose of loan processing and verification.</li>
          </ul>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <label className="flex items-start space-x-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={formData.declarationAccepted}
              onChange={(e) => setFormData((prev) => ({ ...prev, declarationAccepted: e.target.checked }))}
              className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
              I have read and agree to the above declaration and undertaking. I confirm that all the information provided is accurate and I accept full responsibility for the same. <span className="text-red-500">*</span>
            </span>
          </label>

          {!formData.declarationAccepted && (
            <p className="text-orange-600 dark:text-orange-400 text-sm mt-4 flex items-center">
              <span className="mr-2">⚠️</span>
              You must accept the declaration to proceed with submission
            </p>
          )}
        </div>
      </div>

      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
        <p className="text-sm text-green-800 dark:text-green-300 flex items-center">
          <CheckCircle2 className="w-5 h-5 mr-2" />
          Once you submit, your application will be reviewed by our team. You will receive updates via email and SMS.
        </p>
      </div>
    </div>
  );
}
