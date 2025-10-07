import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import LoanDetailsStep from './loan-steps/LoanDetailsStep';
import PersonalDetailsStep from './loan-steps/PersonalDetailsStep';
import ContactAddressStep from './loan-steps/ContactAddressStep';
import ReferencesStep from './loan-steps/ReferencesStep';
import DocumentsStep from './loan-steps/DocumentsStep';
import DeclarationStep from './loan-steps/DeclarationStep';

interface ApplyLoanModalProps {
  onClose: () => void;
}

export interface LoanFormData {
  interestScheme: string;
  goldPriceLockDate: string;
  proformaInvoice: File | null;
  downPaymentDetails: string;
  loanAmount: string;
  tenure: string;
  processingFee: number;

  firstName: string;
  lastName: string;
  fatherMotherSpouseName: string;
  dateOfBirth: string;
  aadhaarNumber: string;
  panNumber: string;
  gender: string;
  maritalStatus: string;
  occupation: string;
  occupationOther: string;
  introducedBy: string;
  emailId: string;

  address: string;
  pinCode: string;
  landmark: string;
  permanentAddress: string;
  mobilePrimary: string;
  mobileAlternative: string;

  reference1Name: string;
  reference1Address: string;
  reference1Contact: string;
  reference1Relationship: string;
  reference2Name: string;
  reference2Address: string;
  reference2Contact: string;
  reference2Relationship: string;

  aadhaarCopy: File | null;
  panCopy: File | null;
  utilityBill: File | null;
  bankStatement: File | null;
  photo: File | null;

  declarationAccepted: boolean;
}

const initialFormData: LoanFormData = {
  interestScheme: '',
  goldPriceLockDate: '',
  proformaInvoice: null,
  downPaymentDetails: '',
  loanAmount: '',
  tenure: '',
  processingFee: 0,

  firstName: '',
  lastName: '',
  fatherMotherSpouseName: '',
  dateOfBirth: '',
  aadhaarNumber: '',
  panNumber: '',
  gender: '',
  maritalStatus: '',
  occupation: '',
  occupationOther: '',
  introducedBy: '',
  emailId: '',

  address: '',
  pinCode: '',
  landmark: '',
  permanentAddress: '',
  mobilePrimary: '',
  mobileAlternative: '',

  reference1Name: '',
  reference1Address: '',
  reference1Contact: '',
  reference1Relationship: '',
  reference2Name: '',
  reference2Address: '',
  reference2Contact: '',
  reference2Relationship: '',

  aadhaarCopy: null,
  panCopy: null,
  utilityBill: null,
  bankStatement: null,
  photo: null,

  declarationAccepted: false,
};

export default function ApplyLoanModal({ onClose }: ApplyLoanModalProps) {
  const { profile } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<LoanFormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const totalSteps = 6;

  const steps = [
    { number: 1, title: 'Loan Details', component: LoanDetailsStep },
    { number: 2, title: 'Personal Details', component: PersonalDetailsStep },
    { number: 3, title: 'Contact & Address', component: ContactAddressStep },
    { number: 4, title: 'References', component: ReferencesStep },
    { number: 5, title: 'Documents', component: DocumentsStep },
    { number: 6, title: 'Declaration', component: DeclarationStep },
  ];

  const CurrentStepComponent = steps[currentStep - 1].component;

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
      setErrors({});
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setErrors({});
    }
  };

  const uploadFile = async (file: File, folderName: string, fileName: string): Promise<string> => {
    const filePath = `${folderName}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('loan_documents')
      .upload(filePath, file, { upsert: true });

    if (uploadError) throw uploadError;

    return filePath;
  };

  const handleSubmit = async () => {
    if (!profile) return;

    setLoading(true);
    try {
      const folderName = `${formData.firstName}_${formData.lastName}`;

      const { data: loanData, error: loanError } = await supabase
        .from('loans')
        .insert({
          user_id: profile.id,
          first_name: formData.firstName,
          last_name: formData.lastName,
          father_mother_spouse_name: formData.fatherMotherSpouseName,
          date_of_birth: formData.dateOfBirth,
          aadhaar_number: formData.aadhaarNumber,
          pan_number: formData.panNumber,
          gender: formData.gender,
          marital_status: formData.maritalStatus,
          occupation: formData.occupation === 'Others' ? formData.occupationOther : formData.occupation,
          introduced_by: formData.introducedBy,
          email_id: formData.emailId,
          address: formData.address,
          pin_code: formData.pinCode,
          landmark: formData.landmark,
          permanent_address: formData.permanentAddress || formData.address,
          mobile_primary: formData.mobilePrimary,
          mobile_alternative: formData.mobileAlternative,
          reference1_name: formData.reference1Name,
          reference1_address: formData.reference1Address,
          reference1_contact: formData.reference1Contact,
          reference1_relationship: formData.reference1Relationship,
          reference2_name: formData.reference2Name,
          reference2_address: formData.reference2Address,
          reference2_contact: formData.reference2Contact,
          reference2_relationship: formData.reference2Relationship,
          interest_scheme: formData.interestScheme,
          gold_price_lock_date: formData.goldPriceLockDate,
          down_payment_details: formData.downPaymentDetails,
          loan_amount: parseFloat(formData.loanAmount),
          tenure: parseInt(formData.tenure),
          processing_fee: formData.processingFee,
          status: 'Pending',
          declaration_accepted: formData.declarationAccepted,
        })
        .select()
        .single();

      if (loanError) throw loanError;

      const documents = [
        { file: formData.aadhaarCopy, type: 'Aadhaar Copy' },
        { file: formData.panCopy, type: 'PAN Copy' },
        { file: formData.utilityBill, type: 'Utility Bill' },
        { file: formData.bankStatement, type: 'Bank Statement' },
        { file: formData.photo, type: 'Passport Photo' },
        { file: formData.proformaInvoice, type: 'Proforma Invoice' },
      ];

      for (const doc of documents) {
        if (doc.file) {
          const filePath = await uploadFile(doc.file, folderName, `${loanData.id}_${doc.type}_${doc.file.name}`);

          await supabase.from('loan_documents').insert({
            loan_id: loanData.id,
            document_type: doc.type,
            file_name: doc.file.name,
            file_path: filePath,
            file_size: doc.file.size,
          });
        }
      }

      alert('Loan application submitted successfully!');
      onClose();
      window.location.reload();
    } catch (error: any) {
      console.error('Error submitting loan:', error);
      alert(error.message || 'Failed to submit loan application');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Apply for Loan</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Step {currentStep} of {totalSteps}: {steps[currentStep - 1].title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              {steps.map((step) => (
                <div
                  key={step.number}
                  className={`flex-1 h-2 rounded-full mx-1 ${
                    step.number <= currentStep ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                />
              ))}
            </div>
          </div>

          <CurrentStepComponent
            formData={formData}
            setFormData={setFormData}
            errors={errors}
            setErrors={setErrors}
          />
        </div>

        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 1}
            className="flex items-center space-x-2 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-5 h-5" />
            <span>Previous</span>
          </button>

          <div className="text-sm text-gray-500 dark:text-gray-400">
            {currentStep} / {totalSteps}
          </div>

          {currentStep < totalSteps ? (
            <button
              onClick={handleNext}
              className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <span>Next</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading || !formData.declarationAccepted}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting...' : 'Submit Application'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
