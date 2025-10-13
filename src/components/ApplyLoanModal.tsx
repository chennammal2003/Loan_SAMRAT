import { useMemo, useState } from 'react';
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
  onSuccess?: () => void; // called after successful submission
}

export interface LoanFormData {
  interestScheme: string;
  goldPriceLockDate: string;
  proformaInvoice: File | null;
  downPaymentDetails: string;
  loanAmount: string;
  tenure: string;
  processingFee: number;
  gstAccepted: boolean;

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
  gstAccepted: false,

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

export default function ApplyLoanModal({ onClose, onSuccess }: ApplyLoanModalProps) {
  const { profile } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<LoanFormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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

  const requiredFiles: Array<keyof LoanFormData> = useMemo(
    () => ['aadhaarCopy', 'panCopy', 'utilityBill', 'bankStatement', 'photo', 'proformaInvoice'],
    []
  );

  const computeErrors = (): Record<string, string> => {
    const newErrors: Record<string, string> = {};

    // Step 1: Loan Details
    if (!formData.interestScheme) newErrors.interestScheme = 'Required';
    if (!formData.goldPriceLockDate) newErrors.goldPriceLockDate = 'Required';
    if (!formData.proformaInvoice) newErrors.proformaInvoice = 'Required';
    if (!formData.loanAmount) newErrors.loanAmount = 'Required';
    if (!formData.tenure) newErrors.tenure = 'Required';
    if (!formData.gstAccepted) newErrors.gstAccepted = 'Please accept GST charges';

    // Step 2: Personal Details
    if (!formData.firstName) newErrors.firstName = 'Required';
    if (!formData.lastName) newErrors.lastName = 'Required';
    if (!formData.fatherMotherSpouseName) newErrors.fatherMotherSpouseName = 'Required';
    if (!formData.dateOfBirth) newErrors.dateOfBirth = 'Required';
    if (!formData.aadhaarNumber || !/^\d{12}$/.test(formData.aadhaarNumber)) newErrors.aadhaarNumber = 'Enter valid 12-digit Aadhaar';
    if (!formData.panNumber || !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.panNumber)) newErrors.panNumber = 'Enter valid PAN';
    if (!formData.gender) newErrors.gender = 'Required';
    if (!formData.maritalStatus) newErrors.maritalStatus = 'Required';
    if (!formData.occupation) newErrors.occupation = 'Required';
    if (formData.occupation === 'Others' && !formData.occupationOther) newErrors.occupationOther = 'Please specify';
    if (!formData.emailId || !/.+@.+\..+/.test(formData.emailId)) newErrors.emailId = 'Enter valid email';

    // Step 3: Contact & Address
    if (!formData.address) newErrors.address = 'Required';
    if (!formData.pinCode || !/^\d{6}$/.test(formData.pinCode)) newErrors.pinCode = 'Enter valid 6-digit PIN';
    if (!formData.mobilePrimary || !/^[6-9]\d{9}$/.test(formData.mobilePrimary)) newErrors.mobilePrimary = 'Enter valid mobile number';

    // Step 4: References
    if (!formData.reference1Name) newErrors.reference1Name = 'Required';
    if (!formData.reference1Address) newErrors.reference1Address = 'Required';
    if (!formData.reference1Contact || !/^[6-9]\d{9}$/.test(formData.reference1Contact)) newErrors.reference1Contact = 'Enter valid contact';
    if (!formData.reference1Relationship) newErrors.reference1Relationship = 'Required';
    if (!formData.reference2Name) newErrors.reference2Name = 'Required';
    if (!formData.reference2Address) newErrors.reference2Address = 'Required';
    if (!formData.reference2Contact || !/^[6-9]\d{9}$/.test(formData.reference2Contact)) newErrors.reference2Contact = 'Enter valid contact';
    if (!formData.reference2Relationship) newErrors.reference2Relationship = 'Required';

    // Step 5: Documents
    requiredFiles.forEach((field) => {
      if (!formData[field]) newErrors[field as string] = 'Required';
    });

    // Step 6: Declaration
    if (!formData.declarationAccepted) newErrors.declarationAccepted = 'Please accept declaration';

    return newErrors;
  };

  const currentErrors = useMemo(() => computeErrors(), [formData]);
  const isFormValid = Object.keys(currentErrors).length === 0;

  // Compute only current step errors for gating Next
  const computeStepErrors = (step: number): Record<string, string> => {
    const e: Record<string, string> = {};
    if (step === 1) {
      if (!formData.interestScheme) e.interestScheme = 'Required';
      if (!formData.goldPriceLockDate) e.goldPriceLockDate = 'Required';
      if (!formData.proformaInvoice) e.proformaInvoice = 'Required';
      if (!formData.loanAmount) e.loanAmount = 'Required';
      if (!formData.tenure) e.tenure = 'Required';
      if (!formData.gstAccepted) e.gstAccepted = 'Please accept GST charges';
    }
    if (step === 2) {
      if (!formData.firstName) e.firstName = 'Required';
      if (!formData.lastName) e.lastName = 'Required';
      if (!formData.fatherMotherSpouseName) e.fatherMotherSpouseName = 'Required';
      if (!formData.dateOfBirth) e.dateOfBirth = 'Required';
      if (!formData.aadhaarNumber || !/^\d{12}$/.test(formData.aadhaarNumber)) e.aadhaarNumber = 'Enter valid 12-digit Aadhaar';
      if (!formData.panNumber || !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.panNumber)) e.panNumber = 'Enter valid PAN';
      if (!formData.gender) e.gender = 'Required';
      if (!formData.maritalStatus) e.maritalStatus = 'Required';
      if (!formData.occupation) e.occupation = 'Required';
      if (formData.occupation === 'Others' && !formData.occupationOther) e.occupationOther = 'Please specify';
      if (!formData.emailId || !/.+@.+\..+/.test(formData.emailId)) e.emailId = 'Enter valid email';
    }
    if (step === 3) {
      if (!formData.address) e.address = 'Required';
      if (!formData.pinCode || !/^\d{6}$/.test(formData.pinCode)) e.pinCode = 'Enter valid 6-digit PIN';
      if (!formData.mobilePrimary || !/^[6-9]\d{9}$/.test(formData.mobilePrimary)) e.mobilePrimary = 'Enter valid mobile number';
    }
    if (step === 4) {
      if (!formData.reference1Name) e.reference1Name = 'Required';
      if (!formData.reference1Address) e.reference1Address = 'Required';
      if (!formData.reference1Contact || !/^[6-9]\d{9}$/.test(formData.reference1Contact)) e.reference1Contact = 'Enter valid contact';
      if (!formData.reference1Relationship) e.reference1Relationship = 'Required';
      if (!formData.reference2Name) e.reference2Name = 'Required';
      if (!formData.reference2Address) e.reference2Address = 'Required';
      if (!formData.reference2Contact || !/^[6-9]\d{9}$/.test(formData.reference2Contact)) e.reference2Contact = 'Enter valid contact';
      if (!formData.reference2Relationship) e.reference2Relationship = 'Required';
    }
    if (step === 5) {
      (['aadhaarCopy','panCopy','utilityBill','bankStatement','photo','proformaInvoice'] as Array<keyof LoanFormData>).forEach((k) => {
        if (!formData[k]) e[k as string] = 'Required';
      });
    }
    if (step === 6) {
      if (!formData.declarationAccepted) e.declarationAccepted = 'Please accept declaration';
    }
    return e;
  };

  // Check uniqueness in DB for Personal Details (Step 2)
  const checkDuplicatePersonalDetails = async (): Promise<Record<string, string>> => {
    const dupErrors: Record<string, string> = {};
    try {
      // 1) Full Name uniqueness (first_name + last_name)
      if (formData.firstName && formData.lastName) {
        const { count: nameCount, error: nameErr } = await supabase
          .from('loans')
          .select('id', { count: 'exact', head: true })
          .ilike('first_name', formData.firstName)
          .ilike('last_name', formData.lastName);
        if (!nameErr && (nameCount || 0) > 0) {
          dupErrors.firstName = 'Name already exists';
          dupErrors.lastName = 'Name already exists';
        }
      }

      // 2) PAN uniqueness
      if (formData.panNumber) {
        const { count: panCount, error: panErr } = await supabase
          .from('loans')
          .select('id', { count: 'exact', head: true })
          .eq('pan_number', formData.panNumber);
        if (!panErr && (panCount || 0) > 0) {
          dupErrors.panNumber = 'PAN Number already exists';
        }
      }

      // 3) Aadhaar uniqueness
      if (formData.aadhaarNumber) {
        const { count: aadhaarCount, error: aadhaarErr } = await supabase
          .from('loans')
          .select('id', { count: 'exact', head: true })
          .eq('aadhaar_number', formData.aadhaarNumber);
        if (!aadhaarErr && (aadhaarCount || 0) > 0) {
          dupErrors.aadhaarNumber = 'Aadhaar Number already exists';
        }
      }
    } catch (e) {
      // Ignore network errors here; allow submit flow to surface issues later
    }
    return dupErrors;
  };

  const handleNext = async () => {
    if (currentStep < totalSteps) {
      // Validate current step fields first
      const stepErrors = computeStepErrors(currentStep);
      // For Step 2, also enforce uniqueness checks against DB
      let dupErrors: Record<string, string> = {};
      if (currentStep === 2) {
        dupErrors = await checkDuplicatePersonalDetails();
      }
      const combined = { ...stepErrors, ...dupErrors };
      setErrors(combined);
      if (Object.keys(combined).length === 0) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setErrors({});
    }
  };

  const uploadFile = async (file: File, folderName: string, fileName: string): Promise<{ path: string; publicUrl: string }> => {
    const filePath = `${folderName}/${fileName}`;

    // Note: @supabase/supabase-js upload does not expose progress callbacks; we mark 100% when done
    setUploadProgress((p) => ({ ...p, [fileName]: 10 }));
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file, { upsert: true, contentType: file.type || undefined, cacheControl: '3600' });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('documents').getPublicUrl(filePath);
    const publicUrl = data.publicUrl;
    setUploadProgress((p) => ({ ...p, [fileName]: 100 }));
    return { path: filePath, publicUrl };
  };

  const handleSubmit = async () => {
    if (!profile) return;

    setLoading(true);
    try {
      const newErrors = computeErrors();
      setErrors(newErrors);
      if (Object.keys(newErrors).length > 0) {
        setLoading(false);
        setToast({ type: 'error', message: 'Please complete all required fields.' });
        return;
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const folderName = `${profile.id}/${formData.firstName}_${formData.lastName}/${timestamp}`;

      const documents = [
        { file: formData.aadhaarCopy, type: 'Aadhaar Copy' },
        { file: formData.panCopy, type: 'PAN Copy' },
        { file: formData.utilityBill, type: 'Utility Bill' },
        { file: formData.bankStatement, type: 'Bank Statement' },
        { file: formData.photo, type: 'Passport Photo' },
        { file: formData.proformaInvoice, type: 'Proforma Invoice' },
      ];
      const uploadedFiles: Array<{ type: string; file: File; path: string; publicUrl: string }> = [];
      try {
        // 1) Upload all files first
        for (const doc of documents) {
          if (doc.file) {
            const safeType = doc.type.replace(/\s+/g, '_');
            const uniqueName = `${safeType}_${doc.file.name}`;
            const { path, publicUrl } = await uploadFile(doc.file, folderName, uniqueName);
            uploadedFiles.push({ type: doc.type, file: doc.file, path, publicUrl });
          }
        }

        // Ensure at least the required ones exist
        const missingRequired = documents.filter(d => d.file && !uploadedFiles.find(u => u.file === d.file));
        if (missingRequired.length > 0) {
          throw new Error('Some documents failed to upload.');
        }

        // 2) Insert loan after successful uploads
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

        if (loanError || !loanData) throw loanError || new Error('Failed to create loan');

        // 3) Insert loan_documents mapping
        if (uploadedFiles.length > 0) {
          const docsPayload = uploadedFiles.map((u) => ({
            loan_id: loanData.id,
            document_type: u.type,
            file_name: u.file.name,
            file_path: u.path,
            file_size: u.file.size,
          }));
          const { error: docsError } = await supabase.from('loan_documents').insert(docsPayload);
          if (docsError) throw docsError;
        }

        // Show confirmation for 3 seconds, then close and navigate
        setToast({
          type: 'success',
          message:
            'Loan has been submitted. Please wait for admin acceptance. Once accepted, you can add the documents. After admin verification, the loan will be disbursed.'
        });
        await new Promise((r) => setTimeout(r, 3000));
        onClose();
        onSuccess?.();
      } catch (innerErr) {
        // Cleanup: delete uploaded files if any part fails before success
        if (uploadedFiles.length > 0) {
          try {
            await supabase.storage.from('documents').remove(uploadedFiles.map((u) => u.path));
          } catch (cleanupErr) {
            console.error('Cleanup failed (files):', cleanupErr);
          }
        }
        throw innerErr;
      }
    } catch (error: any) {
      console.error('Error submitting loan:', error);
      setToast({ type: 'error', message: error.message || 'Failed to submit loan application' });
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

          {currentStep === 5 && (
            <div className="mt-6 space-y-2">
              {Object.entries(uploadProgress).map(([name, prog]) => (
                <div key={name} className="w-full">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{name}</span>
                    <span>{prog}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded">
                    <div className="h-2 bg-blue-600 rounded" style={{ width: `${prog}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
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
            !loading && (
              <button
                onClick={handleSubmit}
                disabled={loading || !isFormValid}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Submit Application
              </button>
            )
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded shadow-lg ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          <div className="flex items-center space-x-3">
            <span className="font-medium">{toast.type === 'success' ? 'Success' : 'Error'}</span>
            <span className="opacity-90">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
