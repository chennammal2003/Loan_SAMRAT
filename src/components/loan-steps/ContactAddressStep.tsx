import React from 'react';
import { LoanFormData } from '../ApplyLoanModal';

interface ContactAddressStepProps {
  formData: LoanFormData;
  setFormData: React.Dispatch<React.SetStateAction<LoanFormData>>;
  errors: Record<string, string>;
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

export default function ContactAddressStep({ formData, setFormData, errors }: ContactAddressStepProps) {
  const validatePinCode = (value: string) => {
    return /^\d{6}$/.test(value);
  };

  const validateMobile = (value: string) => {
    return /^[6-9]\d{9}$/.test(value);
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Address <span className="text-red-500">*</span>
        </label>
        <textarea
          value={formData.address}
          onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
          placeholder="123, MG Road, Bangalore"
          rows={3}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
        />
        {errors.address && <p className="text-red-500 text-sm mt-1">{errors.address}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            PIN Code <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.pinCode}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '');
              setFormData((prev) => ({ ...prev, pinCode: value }));
            }}
            placeholder="560001"
            maxLength={6}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
          />
          {errors.pinCode && <p className="text-red-500 text-sm mt-1">{errors.pinCode}</p>}
          {formData.pinCode && !validatePinCode(formData.pinCode) && (
            <p className="text-orange-500 text-sm mt-1">PIN code must be 6 digits</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Landmark
          </label>
          <input
            type="text"
            value={formData.landmark}
            onChange={(e) => setFormData((prev) => ({ ...prev, landmark: e.target.value }))}
            placeholder="Near City Mall"
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Permanent Address (if different from above)
        </label>
        <textarea
          value={formData.permanentAddress}
          onChange={(e) => setFormData((prev) => ({ ...prev, permanentAddress: e.target.value }))}
          placeholder="Leave empty if same as current address"
          rows={3}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Mobile Number (Primary) <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.mobilePrimary}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, '');
            setFormData((prev) => ({ ...prev, mobilePrimary: value }));
          }}
          placeholder="9876543210"
          maxLength={10}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
        />
        {errors.mobilePrimary && <p className="text-red-500 text-sm mt-1">{errors.mobilePrimary}</p>}
        {formData.mobilePrimary && !validateMobile(formData.mobilePrimary) && (
          <p className="text-orange-500 text-sm mt-1">Invalid mobile number</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Mobile Number (Alternative)
        </label>
        <input
          type="text"
          value={formData.mobileAlternative}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, '');
            setFormData((prev) => ({ ...prev, mobileAlternative: value }));
          }}
          placeholder="8765432109"
          maxLength={10}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
        />
        {formData.mobileAlternative && !validateMobile(formData.mobileAlternative) && (
          <p className="text-orange-500 text-sm mt-1">Invalid mobile number</p>
        )}
      </div>
    </div>
  );
}
