import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { LoanFormData } from '../ApplyLoanModal';
import { Check, AlertCircle } from 'lucide-react';

interface ReferralCodeStepProps {
  formData: LoanFormData;
  setFormData: (data: LoanFormData) => void;
  errors: Record<string, string>;
  setErrors: (errors: Record<string, string>) => void;
  merchantId?: string;
  merchantName?: string;
}

export default function ReferralCodeStep({
  formData,
  setFormData,
  errors,
  setErrors,
  merchantId,
  merchantName,
}: ReferralCodeStepProps) {
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    message: string;
    discount?: number;
  } | null>(null);

  const handleReferralCodeChange = (value: string) => {
    setFormData({ ...formData, referralCode: value.toUpperCase() });
    setValidationResult(null);
    if (errors.referralCode) {
      const newErrors = { ...errors };
      delete newErrors.referralCode;
      setErrors(newErrors);
    }
  };

  const validateReferralCode = async () => {
    if (!formData.referralCode) {
      setValidationResult(null);
      return;
    }

    if (!merchantId) {
      setValidationResult({
        valid: false,
        message: 'Merchant information not found. Please try again.',
      });
      return;
    }

    setValidating(true);
    try {
      // Query merchant_profiles directly to validate referral code
      const { data: merchantData, error: merchantError } = await supabase
        .from('merchant_profiles')
        .select('referral_code, business_name, owner_name')
        .eq('merchant_id', merchantId)
        .single();

      if (merchantError) {
        console.error('Error fetching merchant:', merchantError);
        setValidationResult({
          valid: false,
          message: 'Error validating code. Please try again.',
        });
        return;
      }

      if (!merchantData) {
        setValidationResult({
          valid: false,
          message: 'Merchant profile not found.',
        });
        return;
      }

      // Check if referral code matches merchant's code
      const merchantCode = merchantData.referral_code?.toUpperCase().trim();
      const enteredCode = formData.referralCode.toUpperCase().trim();

      if (merchantCode && merchantCode === enteredCode) {
        // Code is valid
        setValidationResult({
          valid: true,
          message: `✓ Valid! This referral code from ${merchantData.business_name || merchantData.owner_name || 'this merchant'} gives you 10% discount`,
          discount: 10,
        });
      } else if (!merchantCode) {
        // Merchant has no referral code set
        setValidationResult({
          valid: false,
          message: `This merchant does not have a referral code active. Please contact them to get one.`,
        });
      } else {
        // Code doesn't match
        setValidationResult({
          valid: false,
          message: `Invalid referral code for this merchant. Please verify and try again.`,
        });
      }
    } catch (err) {
      console.error('Error validating referral code:', err);
      setValidationResult({
        valid: false,
        message: 'Error validating code. Please try again.',
      });
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Referral Code (Optional)
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          If you have a referral code from a merchant or partner, enter it here to apply special discounts or offers to your loan application.
        </p>
      </div>

      {merchantName && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <span className="font-semibold">Applying through:</span> {merchantName}
          </p>
          <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
            Only referral codes from this merchant will be valid
          </p>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Referral Code
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={formData.referralCode}
              onChange={(e) => handleReferralCodeChange(e.target.value)}
              placeholder="Enter referral code (e.g., CHENNA-E106)"
              className="flex-1 px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 dark:bg-gray-700 dark:text-white bg-white"
            />
            <button
              onClick={validateReferralCode}
              disabled={!formData.referralCode || validating}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
            >
              {validating ? 'Validating...' : 'Validate'}
            </button>
          </div>
          {errors.referralCode && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-2">{errors.referralCode}</p>
          )}
        </div>

        {validationResult && (
          <div
            className={`flex items-start gap-3 p-4 rounded-lg border-2 ${
              validationResult.valid
                ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800'
            }`}
          >
            {validationResult.valid ? (
              <Check className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <p
                className={`font-medium ${
                  validationResult.valid
                    ? 'text-green-800 dark:text-green-200'
                    : 'text-red-800 dark:text-red-200'
                }`}
              >
                {validationResult.valid ? '✓ ' : '✗ '}
                {validationResult.message}
              </p>
              {validationResult.valid && validationResult.discount && validationResult.discount > 0 && (
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                  {validationResult.discount}% discount will be applied to your loan processing fees
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <h4 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-2">💡 Tip</h4>
        <ul className="text-sm text-yellow-800 dark:text-yellow-300 space-y-1">
          <li>• Referral codes are optional - you can proceed without one</li>
          <li>• Make sure to enter the code correctly (codes are case-insensitive)</li>
          <li>• Referral code must belong to the merchant you're applying through</li>
          <li>• Some codes may have expiration dates or limited usage</li>
          <li>• Discounts from referral codes apply to your loan processing fees</li>
        </ul>
      </div>
    </div>
  );
}
