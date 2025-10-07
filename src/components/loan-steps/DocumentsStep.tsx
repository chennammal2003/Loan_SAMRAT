import React from 'react';
import { Upload } from 'lucide-react';
import { LoanFormData } from '../ApplyLoanModal';

interface DocumentsStepProps {
  formData: LoanFormData;
  setFormData: React.Dispatch<React.SetStateAction<LoanFormData>>;
  errors: Record<string, string>;
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

export default function DocumentsStep({ formData, setFormData, errors, setErrors }: DocumentsStepProps) {
  const handleFileChange = (field: keyof LoanFormData, file: File | null) => {
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrors((prev) => ({ ...prev, [field]: 'File size must be less than 5MB' }));
        return;
      }
      setFormData((prev) => ({ ...prev, [field]: file }));
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const FileUploadField = ({
    label,
    field,
    accept = '.pdf,.jpg,.jpeg,.png',
    required = true
  }: {
    label: string;
    field: keyof LoanFormData;
    accept?: string;
    required?: boolean;
  }) => {
    const file = formData[field] as File | null;

    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        <div className="relative">
          <input
            type="file"
            onChange={(e) => handleFileChange(field, e.target.files?.[0] || null)}
            accept={accept}
            className="hidden"
            id={field as string}
          />
          <label
            htmlFor={field as string}
            className="flex items-center justify-center w-full px-4 py-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-colors bg-gray-50 dark:bg-gray-700/50"
          >
            <div className="text-center">
              <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400 dark:text-gray-500" />
              {file ? (
                <div>
                  <p className="text-sm text-green-600 dark:text-green-400 font-medium">{file.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Click to upload</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">PDF, JPG, PNG (Max 5MB)</p>
                </div>
              )}
            </div>
          </label>
        </div>
        {errors[field] && <p className="text-red-500 text-sm mt-1">{errors[field]}</p>}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <p className="text-sm text-yellow-800 dark:text-yellow-300">
          <strong>Important:</strong> All documents must be clear and readable. Supported formats: PDF, JPG, PNG. Maximum file size: 5MB per document.
        </p>
      </div>

      <FileUploadField label="Aadhaar Copy" field="aadhaarCopy" />
      <FileUploadField label="PAN Copy" field="panCopy" />
      <FileUploadField label="Latest Utility Bill / Gas Bill / Rental Agreement" field="utilityBill" />
      <FileUploadField label="Bank Passbook / Statement (Last 6 months)" field="bankStatement" />
      <FileUploadField label="Passport Size Photo" field="photo" accept=".jpg,.jpeg,.png" />

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-800 dark:text-blue-300">
          The Proforma Invoice has been uploaded in Step 1. All documents will be stored securely in your dedicated folder.
        </p>
      </div>
    </div>
  );
}
