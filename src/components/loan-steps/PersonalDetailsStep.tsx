import React from 'react';
import { LoanFormData } from '../ApplyLoanModal';

interface PersonalDetailsStepProps {
  formData: LoanFormData;
  setFormData: React.Dispatch<React.SetStateAction<LoanFormData>>;
  errors: Record<string, string>;
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

export default function PersonalDetailsStep({ formData, setFormData, errors }: PersonalDetailsStepProps) {
  const validateAadhaar = (value: string) => {
    return /^\d{12}$/.test(value.replace(/\s/g, ''));
  };

  const validatePAN = (value: string) => {
    return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(value);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            First Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.firstName}
            onChange={(e) => setFormData((prev) => ({ ...prev, firstName: e.target.value }))}
            placeholder="Ravi"
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
          />
          {errors.firstName && <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Last Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.lastName}
            onChange={(e) => setFormData((prev) => ({ ...prev, lastName: e.target.value }))}
            placeholder="Kumar"
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
          />
          {errors.lastName && <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Father's / Mother's / Spouse Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.fatherMotherSpouseName}
          onChange={(e) => setFormData((prev) => ({ ...prev, fatherMotherSpouseName: e.target.value }))}
          placeholder="Rajesh Kumar"
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
        />
        {errors.fatherMotherSpouseName && <p className="text-red-500 text-sm mt-1">{errors.fatherMotherSpouseName}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Date of Birth <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          value={formData.dateOfBirth}
          onChange={(e) => setFormData((prev) => ({ ...prev, dateOfBirth: e.target.value }))}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
        {errors.dateOfBirth && <p className="text-red-500 text-sm mt-1">{errors.dateOfBirth}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Aadhaar Number <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.aadhaarNumber}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, '');
            setFormData((prev) => ({ ...prev, aadhaarNumber: value }));
          }}
          placeholder="123456789012"
          maxLength={12}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
        />
        {errors.aadhaarNumber && <p className="text-red-500 text-sm mt-1">{errors.aadhaarNumber}</p>}
        {formData.aadhaarNumber && !validateAadhaar(formData.aadhaarNumber) && (
          <p className="text-orange-500 text-sm mt-1">Aadhaar must be 12 digits</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          PAN Number <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.panNumber}
          onChange={(e) => setFormData((prev) => ({ ...prev, panNumber: e.target.value.toUpperCase() }))}
          placeholder="ABCDE1234F"
          maxLength={10}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
        />
        {errors.panNumber && <p className="text-red-500 text-sm mt-1">{errors.panNumber}</p>}
        {formData.panNumber && !validatePAN(formData.panNumber) && (
          <p className="text-orange-500 text-sm mt-1">Invalid PAN format (e.g., ABCDE1234F)</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Gender <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.gender}
            onChange={(e) => setFormData((prev) => ({ ...prev, gender: e.target.value }))}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
          {errors.gender && <p className="text-red-500 text-sm mt-1">{errors.gender}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Marital Status <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.maritalStatus}
            onChange={(e) => setFormData((prev) => ({ ...prev, maritalStatus: e.target.value }))}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">Select Status</option>
            <option value="Single">Single</option>
            <option value="Married">Married</option>
            <option value="Widowed">Widowed</option>
            <option value="Divorced">Divorced</option>
          </select>
          {errors.maritalStatus && <p className="text-red-500 text-sm mt-1">{errors.maritalStatus}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Occupation <span className="text-red-500">*</span>
        </label>
        <select
          value={formData.occupation}
          onChange={(e) => setFormData((prev) => ({ ...prev, occupation: e.target.value }))}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="">Select Occupation</option>
          <option value="Salaried">Salaried</option>
          <option value="Self-employed">Self-employed</option>
          <option value="Business">Entrepreneur</option>
          <option value="Retail Trader">Retail Trader</option>
          <option value="Others">Others</option>
        </select>
        {errors.occupation && <p className="text-red-500 text-sm mt-1">{errors.occupation}</p>}
      </div>

      {formData.occupation === 'Others' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Please Specify <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.occupationOther}
            onChange={(e) => setFormData((prev) => ({ ...prev, occupationOther: e.target.value }))}
            placeholder="Enter your occupation"
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">This will be saved as your occupation.</p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Introduced By (DSA / Agent Name & Code)
        </label>
        <input
          type="text"
          value={formData.introducedBy}
          onChange={(e) => setFormData((prev) => ({ ...prev, introducedBy: e.target.value }))}
          placeholder="Agent Name - AG001"
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Email ID <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          value={formData.emailId}
          onChange={(e) => setFormData((prev) => ({ ...prev, emailId: e.target.value }))}
          placeholder="ravi.kumar@example.com"
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
        />
        {errors.emailId && <p className="text-red-500 text-sm mt-1">{errors.emailId}</p>}
      </div>
    </div>
  );
}
