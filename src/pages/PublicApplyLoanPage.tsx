import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import LoanDetailsStep from '../components/loan-steps/LoanDetailsStep';
import PersonalDetailsStep from '../components/loan-steps/PersonalDetailsStep';
import ContactAddressStep from '../components/loan-steps/ContactAddressStep';
import ReferencesStep from '../components/loan-steps/ReferencesStep';
import DocumentsStep from '../components/loan-steps/DocumentsStep';
import DeclarationStep from '../components/loan-steps/DeclarationStep';
import type { LoanFormData } from '../components/ApplyLoanModal';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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

export default function PublicApplyLoanPage() {
  const { linkId } = useParams();
  const [valid, setValid] = useState<boolean | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<LoanFormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [submitted, setSubmitted] = useState(false);

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

  useEffect(() => {
    const checkLink = async () => {
      if (!linkId) return setValid(false);
      const { data, error } = await supabase
        .from('loan_share_links')
        .select('id, is_active, expires_at')
        .eq('link_id', linkId)
        .maybeSingle();
      if (error) {
        setValid(false);
        return;
      }
      const ok = !!data && data.is_active === true && (!data.expires_at || new Date(data.expires_at) > new Date());
      setValid(ok);
      if (ok) {
        try { await supabase.rpc('track_share_link_open', { p_link_id: linkId }); } catch {}
      }
    };
    checkLink();
  }, [linkId]);

  // Validation for public flow: do NOT require files
  const computeErrors = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!formData.interestScheme) e.interestScheme = 'Required';
    if (!formData.goldPriceLockDate) e.goldPriceLockDate = 'Required';
    if (!formData.loanAmount) e.loanAmount = 'Required';
    if (!formData.tenure) e.tenure = 'Required';
    if (!formData.gstAccepted) e.gstAccepted = 'Please accept GST charges';
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
    if (!formData.address) e.address = 'Required';
    if (!formData.pinCode || !/^\d{6}$/.test(formData.pinCode)) e.pinCode = 'Enter valid 6-digit PIN';
    if (!formData.mobilePrimary || !/^[6-9]\d{9}$/.test(formData.mobilePrimary)) e.mobilePrimary = 'Enter valid mobile number';
    if (!formData.reference1Name) e.reference1Name = 'Required';
    if (!formData.reference1Address) e.reference1Address = 'Required';
    if (!formData.reference1Contact || !/^[6-9]\d{9}$/.test(formData.reference1Contact)) e.reference1Contact = 'Enter valid contact';
    if (!formData.reference1Relationship) e.reference1Relationship = 'Required';
    if (!formData.reference2Name) e.reference2Name = 'Required';
    if (!formData.reference2Address) e.reference2Address = 'Required';
    if (!formData.reference2Contact || !/^[6-9]\d{9}$/.test(formData.reference2Contact)) e.reference2Contact = 'Enter valid contact';
    if (!formData.reference2Relationship) e.reference2Relationship = 'Required';
    if (!formData.declarationAccepted) e.declarationAccepted = 'Please accept declaration';
    return e;
  };

  const isFormValid = useMemo(() => Object.keys(computeErrors()).length === 0, [formData]);

  // Validate only the current step to allow navigation through pages
  const computeStepErrors = (step: number): Record<string, string> => {
    const e: Record<string, string> = {};
    if (step === 1) {
      if (!formData.interestScheme) e.interestScheme = 'Required';
      if (!formData.goldPriceLockDate) e.goldPriceLockDate = 'Required';
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
    // Step 5 (Documents) – in public flow, files are optional, so no gating here
    if (step === 6) {
      if (!formData.declarationAccepted) e.declarationAccepted = 'Please accept declaration';
    }
    return e;
  };

  const handleNext = () => {
    if (currentStep < totalSteps) {
      const stepErrors = computeStepErrors(currentStep);
      setErrors(stepErrors);
      if (Object.keys(stepErrors).length === 0) setCurrentStep((s) => s + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep((s) => s - 1);
      setErrors({});
    }
  };

  const handleSubmit = async () => {
    if (!linkId) return;
    const e = computeErrors();
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc('submit_loan_via_share_link', {
        p_link_id: linkId,
        p_payload: {
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
          declaration_accepted: formData.declarationAccepted,
        },
      });
      if (error) throw error;
      // Email webhook (non-blocking): submission confirmation
      try {
        const emailWebhook = import.meta.env.VITE_EMAIL_WEBHOOK_URL as string | undefined;
        if (emailWebhook) {
          const payload = {
            to: formData.emailId,
            stage: 'submitted',
            applicant: {
              firstName: formData.firstName,
              lastName: formData.lastName,
              email: formData.emailId,
              mobile: formData.mobilePrimary,
              address: formData.address,
              pinCode: formData.pinCode,
            },
            loan: {
              amount: parseFloat(formData.loanAmount),
              tenure: parseInt(formData.tenure),
              interestScheme: formData.interestScheme,
              processingFee: formData.processingFee,
              goldPriceLockDate: formData.goldPriceLockDate,
            },
            references: [
              { name: formData.reference1Name, contact: formData.reference1Contact, relationship: formData.reference1Relationship },
              { name: formData.reference2Name, contact: formData.reference2Contact, relationship: formData.reference2Relationship },
            ],
            documents: [],
          };
          fetch(emailWebhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }).catch(() => {});
        }
      } catch {}
      setToast({
        type: 'success',
        message:
          'Loan has been submitted. Please wait for admin acceptance. Once accepted, you can add the documents. After admin verification, the loan  Amoutn will be disbursed.'
      });
      setSubmitted(true);
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Failed to submit loan application' });
    } finally {
      setSubmitting(false);
    }
  };

  if (valid === null) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!valid) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
        <div className="max-w-xl w-full bg-white dark:bg-gray-800 rounded-xl p-8 shadow">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Invalid or Inactive Link</h1>
          <p className="text-gray-600 dark:text-gray-300">This loan application link is not available.</p>
        </div>
      </div>
    );
  }

  // After successful submit, show centered message screen
  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
        <div className="max-w-xl w-full bg-white dark:bg-gray-800 rounded-xl p-8 shadow text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Loan Submitted</h1>
          <p className="text-gray-700 dark:text-gray-300">
            Loan has been submitted. Please wait for admin acceptance. Once accepted, you can add the documents. After admin verification, the loan will be disbursed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-5xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Apply for Loan</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Public application link</p>
        </div>

        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            {steps.map((s) => (
              <div key={s.number} className={`flex-1 h-2 rounded-full mx-1 ${s.number <= currentStep ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`} />
            ))}
          </div>

          <CurrentStepComponent
            formData={formData}
            setFormData={setFormData}
            errors={errors}
            setErrors={setErrors}
          />
        </div>

        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <button onClick={handlePrevious} disabled={currentStep === 1} className="flex items-center gap-2 px-6 py-3 rounded-lg bg-gray-200 dark:bg-gray-700 disabled:opacity-50">
            <ChevronLeft className="w-5 h-5" /> Previous
          </button>
          <div className="text-sm text-gray-500 dark:text-gray-400">{currentStep} / {totalSteps}</div>
          {currentStep < totalSteps ? (
            <button onClick={handleNext} className="flex items-center gap-2 px-6 py-3 rounded-lg bg-blue-600 text-white">
              Next <ChevronRight className="w-5 h-5" />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={submitting || !isFormValid} className="px-6 py-3 rounded-lg bg-green-600 text-white disabled:opacity-50">
              Submit Application
            </button>
          )}
        </div>
      </div>

      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded shadow-lg ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          <div className="flex items-center gap-3">
            <span className="font-medium">{toast.type === 'success' ? 'Success' : 'Error'}</span>
            <span className="opacity-90">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
