import React from 'react';
import { LoanFormData } from '../ApplyLoanModal';

interface ReferencesStepProps {
  formData: LoanFormData;
  setFormData: React.Dispatch<React.SetStateAction<LoanFormData>>;
  errors: Record<string, string>;
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

export default function ReferencesStep({ formData, setFormData, errors }: ReferencesStepProps) {
  const validateMobile = (value: string) => {
    return /^[6-9]\d{9}$/.test(value);
  };

  return (
    <div className="space-y-8">
      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
        <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-4">Reference 1</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.reference1Name}
              onChange={(e) => setFormData((prev) => ({ ...prev, reference1Name: e.target.value }))}
              placeholder="Amit Sharma"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
            />
            {errors.reference1Name && <p className="text-red-500 text-sm mt-1">{errors.reference1Name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Address <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.reference1Address}
              onChange={(e) => setFormData((prev) => ({ ...prev, reference1Address: e.target.value }))}
              placeholder="456, Park Street, Mumbai"
              rows={2}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
            />
            {errors.reference1Address && <p className="text-red-500 text-sm mt-1">{errors.reference1Address}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Contact Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.reference1Contact}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                setFormData((prev) => ({ ...prev, reference1Contact: value }));
              }}
              placeholder="9123456789"
              maxLength={10}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
            />
            {errors.reference1Contact && <p className="text-red-500 text-sm mt-1">{errors.reference1Contact}</p>}
            {formData.reference1Contact && !validateMobile(formData.reference1Contact) && (
              <p className="text-orange-500 text-sm mt-1">Invalid mobile number</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Relationship <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.reference1Relationship}
              onChange={(e) => setFormData((prev) => ({ ...prev, reference1Relationship: e.target.value }))}
              placeholder="Friend / Colleague / Relative"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
            />
            {errors.reference1Relationship && <p className="text-red-500 text-sm mt-1">{errors.reference1Relationship}</p>}
          </div>
        </div>
      </div>

      <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
        <h3 className="font-semibold text-green-900 dark:text-green-300 mb-4">Reference 2</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.reference2Name}
              onChange={(e) => setFormData((prev) => ({ ...prev, reference2Name: e.target.value }))}
              placeholder="Priya Verma"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
            />
            {errors.reference2Name && <p className="text-red-500 text-sm mt-1">{errors.reference2Name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Address <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.reference2Address}
              onChange={(e) => setFormData((prev) => ({ ...prev, reference2Address: e.target.value }))}
              placeholder="789, Lake View, Delhi"
              rows={2}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
            />
            {errors.reference2Address && <p className="text-red-500 text-sm mt-1">{errors.reference2Address}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Contact Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.reference2Contact}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                setFormData((prev) => ({ ...prev, reference2Contact: value }));
              }}
              placeholder="8234567890"
              maxLength={10}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
            />
            {errors.reference2Contact && <p className="text-red-500 text-sm mt-1">{errors.reference2Contact}</p>}
            {formData.reference2Contact && !validateMobile(formData.reference2Contact) && (
              <p className="text-orange-500 text-sm mt-1">Invalid mobile number</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Relationship <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.reference2Relationship}
              onChange={(e) => setFormData((prev) => ({ ...prev, reference2Relationship: e.target.value }))}
              placeholder="Friend / Colleague / Relative"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
            />
            {errors.reference2Relationship && <p className="text-red-500 text-sm mt-1">{errors.reference2Relationship}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
