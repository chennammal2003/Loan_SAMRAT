import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

const APPROVAL_TYPES = ['Instant', 'Manual', 'Credit Score Based'] as const;
const NBFC_TYPES = ['Loan Company', 'Gold Loan', 'Microfinance', 'Housing Finance', 'Two-Wheeler', 'Consumer Durable', 'Other'] as const;
const REPAYMENT_FREQUENCIES = ['Monthly', 'Weekly', 'Fortnightly'] as const;
const INTEREST_TYPES = ['Reducing Balance', 'Flat'] as const;
const KYC_METHODS = ['Aadhaar eKYC', 'PAN Verification', 'Manual Upload'] as const;
const DISBURSEMENT_MODES = ['Bank Transfer', 'UPI', 'Wallet', 'Cheque'] as const;
const STORAGE_BUCKET = 'compliance';
const TABS = [
  'Basic NBFC Details',
  'Financial Parameters',
  'Loan & Tenure Configuration',
  'Approval & Disbursement Settings',
  'Integration & Compliance',
  'Additional Notes',
] as const;

export default function NbfcSetup({ embedded = false }: { embedded?: boolean }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [interestRate, setInterestRate] = useState<string>('');
  const [processingFeeFlat, setProcessingFeeFlat] = useState<string>('');
  const [processingFeePercent, setProcessingFeePercent] = useState<string>('');
  const [preclosureChargePercent, setPreclosureChargePercent] = useState<string>('');
  const [latePaymentFeePercent, setLatePaymentFeePercent] = useState<string>('');
  const [documentationCharges, setDocumentationCharges] = useState<string>('');
  const [gstApplicable, setGstApplicable] = useState<boolean>(false);

  const [approvalType, setApprovalType] = useState<typeof APPROVAL_TYPES[number]>('Instant');
  const [avgApprovalTime, setAvgApprovalTime] = useState('');
  const [kycMethod, setKycMethod] = useState<typeof KYC_METHODS[number]>('Aadhaar eKYC');
  const [disbursementModes, setDisbursementModes] = useState<string[]>([]);

  const [notes, setNotes] = useState('');

  // Company basics
  const [cinNumber, setCinNumber] = useState('');
  const [rbiLicenseNumber, setRbiLicenseNumber] = useState('');
  const [nbfcType, setNbfcType] = useState<typeof NBFC_TYPES[number]>('Loan Company');
  const [yearOfIncorporation, setYearOfIncorporation] = useState<string>('');
  const [headOfficeAddress, setHeadOfficeAddress] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [officialEmail, setOfficialEmail] = useState('');

  // Loan config
  const [loanTypes, setLoanTypes] = useState<string[]>([]);
  const [loanTypeInput, setLoanTypeInput] = useState('');
  const [minLoanAmount, setMinLoanAmount] = useState<string>('');
  const [maxLoanAmount, setMaxLoanAmount] = useState<string>('');
  const [tenureOptions, setTenureOptions] = useState<number[]>([]);
  const [tenureInput, setTenureInput] = useState<string>('');
  const [repaymentFrequency, setRepaymentFrequency] = useState<typeof REPAYMENT_FREQUENCIES[number]>('Monthly');
  const [interestType, setInterestType] = useState<typeof INTEREST_TYPES[number]>('Reducing Balance');

  // Integration URLs (uploads to be added later)
  const [rbiCertificateUrl, setRbiCertificateUrl] = useState('');
  const [panGstDocUrl, setPanGstDocUrl] = useState('');
  const [gstCertificateUrl, setGstCertificateUrl] = useState('');
  const [digitalSignatureUrl, setDigitalSignatureUrl] = useState('');
  const [rbiFile, setRbiFile] = useState<File | null>(null);
  const [panGstFile, setPanGstFile] = useState<File | null>(null);
  const [gstFile, setGstFile] = useState<File | null>(null);
  const [dscFile, setDscFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!profile) return;
      // Only NBFC role (admin) is expected to use this
      if (profile.role !== 'admin') {
        navigate('/dashboard', { replace: true });
        return;
      }
      // Load existing profile to support editing
      const { data, error } = await supabase
        .from('nbfc_profiles')
        .select('*')
        .eq('nbfc_id', profile.id)
        .maybeSingle();
      if (cancelled) return;
      if (!error && data) {
        // Prefill all fields for editing
        setName(data.name || '');
        setInterestRate(String(data.interest_rate ?? ''));
        setProcessingFeeFlat(String(data.processing_fee ?? ''));
        setProcessingFeePercent(String(data.processing_fee_percent ?? ''));
        setPreclosureChargePercent(data.preclosure_charge_percent != null ? String(data.preclosure_charge_percent) : '');
        setLatePaymentFeePercent(data.late_payment_fee_percent != null ? String(data.late_payment_fee_percent) : '');
        setDocumentationCharges(data.documentation_charges != null ? String(data.documentation_charges) : '');
        setGstApplicable(!!data.gst_applicable);

        setApprovalType((data.approval_type as any) || 'Instant');
        setAvgApprovalTime(data.average_approval_time || '');
        setKycMethod((data.kyc_method as any) || 'Aadhaar eKYC');
        setDisbursementModes(Array.isArray(data.disbursement_modes) ? data.disbursement_modes : (data.disbursement_modes?.map?.((x: any)=>x) || []));

        setNotes(data.notes || '');
        setTenureOptions(Array.isArray(data.tenure_options) ? data.tenure_options : (data.tenure_options?.map?.((x: any)=>Number(x)) || []));
        setRepaymentFrequency((data.repayment_frequency as any) || 'Monthly');
        setInterestType((data.interest_type as any) || 'Reducing Balance');

        setCinNumber(data.cin_number || '');
        setRbiLicenseNumber(data.rbi_license_number || '');
        setNbfcType((data.nbfc_type as any) || 'Loan Company');
        setYearOfIncorporation(data.year_of_incorporation != null ? String(data.year_of_incorporation) : '');
        setHeadOfficeAddress(data.head_office_address || '');
        setContactNumber(data.contact_number || '');
        setOfficialEmail(data.official_email || '');

        setLoanTypes(Array.isArray(data.loan_types) ? data.loan_types : (data.loan_types?.map?.((x: any)=>String(x)) || []));
        setMinLoanAmount(data.min_loan_amount != null ? String(data.min_loan_amount) : '');
        setMaxLoanAmount(data.max_loan_amount != null ? String(data.max_loan_amount) : '');

        setRbiCertificateUrl(data.rbi_certificate_url || '');
        setPanGstDocUrl(data.pan_gst_doc_url || '');
        setGstCertificateUrl(data.gst_certificate_url || '');
        setDigitalSignatureUrl(data.digital_signature_url || '');
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [profile?.id, profile?.role, navigate]);

  const canSubmit = useMemo(() => {
    const ir = Number(interestRate);
    const pfFlat = Number(processingFeeFlat || 0);
    const pfPct = Number(processingFeePercent || 0);
    const minAmt = minLoanAmount ? Number(minLoanAmount) : 0;
    const maxAmt = maxLoanAmount ? Number(maxLoanAmount) : 0;
    const approvalValid = APPROVAL_TYPES.includes(approvalType);
    const loanAmtValid = !minLoanAmount || !maxLoanAmount || maxAmt >= minAmt;
    const pfPctValid = !Number.isNaN(pfPct) && pfPct >= 0 && pfPct <= 100;
    const preclosePct = preclosureChargePercent ? Number(preclosureChargePercent) : 0;
    const lateFeePct = latePaymentFeePercent ? Number(latePaymentFeePercent) : 0;
    const precloseValid = Number.isNaN(preclosePct) ? false : (preclosePct >= 0 && preclosePct <= 100);
    const lateFeeValid = Number.isNaN(lateFeePct) ? false : (lateFeePct >= 0 && lateFeePct <= 100);
    return !!name && !Number.isNaN(ir) && ir >= 0 && !Number.isNaN(pfFlat) && pfFlat >= 0 && pfPctValid && precloseValid && lateFeeValid && approvalValid && loanAmtValid && tenureOptions.length > 0;
  }, [name, interestRate, processingFeeFlat, processingFeePercent, preclosureChargePercent, latePaymentFeePercent, approvalType, tenureOptions, minLoanAmount, maxLoanAmount]);

  const addTenureFromInput = () => {
    const v = Number(tenureInput.trim());
    if (!Number.isNaN(v) && v > 0 && Number.isInteger(v)) {
      setTenureOptions(prev => (prev.includes(v) ? prev : [...prev, v].sort((a,b)=>a-b)));
      setTenureInput('');
    }
  };
  const removeTenure = (t: number) => {
    setTenureOptions(prev => prev.filter(x => x !== t));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      // Upload selected files first to get URLs
      setUploading(true);
      const uploadFile = async (file: File | null, fname: string): Promise<string | null> => {
        if (!file) return null;
        const ext = file.name.split('.').pop() || 'bin';
        const path = `nbfc/${profile.id}/${fname}.${ext}`;
        const { data: up, error: upErr } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(path, file, { upsert: true, contentType: file.type || 'application/octet-stream' });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(up.path);
        return pub.publicUrl || null;
      };

      const rbiUrl = await uploadFile(rbiFile, 'rbi_certificate');
      const panGstUrl = await uploadFile(panGstFile, 'pan_or_gst_doc');
      const gstUrl = await uploadFile(gstFile, 'gst_certificate');
      const dscUrl = await uploadFile(dscFile, 'digital_signature');
      setUploading(false);

      const ir = Number(interestRate);
      const pfFlat = Number(processingFeeFlat || 0);
      const pfPct = Number(processingFeePercent || 0);
      const preclosePct = preclosureChargePercent ? Number(preclosureChargePercent) : null;
      const lateFeePct = latePaymentFeePercent ? Number(latePaymentFeePercent) : null;
      const docFees = documentationCharges ? Number(documentationCharges) : null;
      const minAmt = minLoanAmount ? Number(minLoanAmount) : null;
      const maxAmt = maxLoanAmount ? Number(maxLoanAmount) : null;

      const payload = {
        nbfc_id: profile.id,
        name,
        interest_rate: ir,
        default_tenure: null,
        processing_fee: pfFlat,
        processing_fee_percent: pfPct,
        preclosure_charge_percent: preclosePct,
        late_payment_fee_percent: lateFeePct,
        documentation_charges: docFees,
        gst_applicable: gstApplicable,

        approval_type: approvalType,
        average_approval_time: avgApprovalTime || null,
        kyc_method: kycMethod,
        disbursement_modes: disbursementModes,

        notes: notes || '',
        tenure_options: tenureOptions,
        repayment_frequency: repaymentFrequency,
        interest_type: interestType,

        cin_number: cinNumber || null,
        rbi_license_number: rbiLicenseNumber || null,
        nbfc_type: nbfcType,
        year_of_incorporation: yearOfIncorporation ? Number(yearOfIncorporation) : null,
        head_office_address: headOfficeAddress || null,
        contact_number: contactNumber || null,
        official_email: officialEmail || null,

        loan_types: loanTypes,
        min_loan_amount: minAmt,
        max_loan_amount: maxAmt,

        rbi_certificate_url: (rbiUrl ?? rbiCertificateUrl) || null,
        pan_gst_doc_url: (panGstUrl ?? panGstDocUrl) || null,
        gst_certificate_url: (gstUrl ?? gstCertificateUrl) || null,
        digital_signature_url: (dscUrl ?? digitalSignatureUrl) || null,

        updated_at: new Date().toISOString(),
      } as const;

      const { error } = await supabase
        .from('nbfc_profiles')
        .upsert(payload, { onConflict: 'nbfc_id' });

      if (error) throw error;

      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Failed to save NBFC profile');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className={`${embedded ? '' : 'min-h-screen bg-gray-50 dark:bg-gray-900'} flex items-center justify-center`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${embedded ? '' : 'min-h-screen bg-gray-50 dark:bg-gray-900'} ${embedded ? '' : 'flex items-start justify-center p-4 md:p-8'}`}>
      <div className={`${embedded ? '' : 'w-full max-w-3xl'} bg-white dark:bg-gray-800 shadow rounded-xl overflow-hidden`}>
        {!embedded && (
          <div className="bg-orange-600 text-white px-6 py-5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold">Add NBFC Details</h1>
                <p className="text-orange-100">Enter the financial institution information — company basics, financial parameters, loan configuration, approval settings and integration info.</p>
              </div>
              <button onClick={toggleTheme} className="inline-flex items-center px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 transition">
                <span className="text-sm">{theme === 'dark' ? 'Dark' : 'Light'}</span>
              </button>
            </div>
          </div>
        )}
        <div className={`${embedded ? 'p-0' : 'p-6'}`}>

        {error && (
          <div className="mb-4 p-3 rounded bg-red-50 text-red-700 border border-red-200">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="mb-4 flex flex-wrap gap-2">
          {TABS.map((t, idx) => (
            <button
              key={t}
              type="button"
              onClick={()=>setActiveTab(idx)}
              className={`px-3 py-1.5 rounded-full text-sm border ${activeTab===idx ? 'bg-orange-600 text-white border-orange-600' : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-orange-50 dark:hover:bg-gray-800'}`}
            >
              {idx+1}. {t}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="space-y-8">
          {/* 1. Basic NBFC Details */}
          {activeTab===0 && (
          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">1. Basic NBFC Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">NBFC Name</label>
                <input value={name} onChange={(e)=>setName(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2" placeholder="Enter NBFC name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">NBFC Type</label>
                <select value={nbfcType} onChange={(e)=>setNbfcType(e.target.value as any)} className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2">
                  {NBFC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">CIN / Registration Number</label>
                <input value={cinNumber} onChange={(e)=>setCinNumber(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2" placeholder="e.g., U12345MH2020PLC000001" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">RBI License Number</label>
                <input value={rbiLicenseNumber} onChange={(e)=>setRbiLicenseNumber(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2" placeholder="e.g., 13.01234" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Year of Incorporation</label>
                <input type="number" inputMode="numeric" value={yearOfIncorporation} onChange={(e)=>setYearOfIncorporation(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2" placeholder="e.g., 2018" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Official Email</label>
                <input type="email" value={officialEmail} onChange={(e)=>setOfficialEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2" placeholder="e.g., contact@nbfc.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Contact Number</label>
                <input value={contactNumber} onChange={(e)=>setContactNumber(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2" placeholder="e.g., +91 98765 43210" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Head Office Address</label>
                <input value={headOfficeAddress} onChange={(e)=>setHeadOfficeAddress(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2" placeholder="Address" />
              </div>
            </div>
          </section>
          )}

          {/* 2. Financial Parameters */}
          {activeTab===1 && (
          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">2. Financial Parameters</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Interest Rate (% p.a)</label>
                <input type="number" step="0.01" min={0} value={interestRate} onChange={(e)=>setInterestRate(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2" placeholder="e.g., 12.50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Processing Fee (Flat ₹)</label>
                <input type="number" step="0.01" min={0} value={processingFeeFlat} onChange={(e)=>setProcessingFeeFlat(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2" placeholder="e.g., 500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Processing Fee (%)</label>
                <input type="number" step="0.01" min={0} max={100} value={processingFeePercent} onChange={(e)=>setProcessingFeePercent(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2" placeholder="e.g., 1.50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Pre-closure Charge (%)</label>
                <input type="number" step="0.01" min={0} max={100} value={preclosureChargePercent} onChange={(e)=>setPreclosureChargePercent(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2" placeholder="e.g., 2.00" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Late Payment Fee (%)</label>
                <input type="number" step="0.01" min={0} max={100} value={latePaymentFeePercent} onChange={(e)=>setLatePaymentFeePercent(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2" placeholder="e.g., 3.00" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Documentation Charges (₹)</label>
                <input type="number" step="0.01" min={0} value={documentationCharges} onChange={(e)=>setDocumentationCharges(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2" placeholder="e.g., 250" />
              </div>
              <div className="flex items-center gap-3 mt-6">
                <input id="gst-applicable" type="checkbox" checked={gstApplicable} onChange={(e)=>setGstApplicable(e.target.checked)} className="h-4 w-4" />
                <label htmlFor="gst-applicable" className="text-sm font-medium text-gray-700 dark:text-gray-300">GST Applicable</label>
              </div>
            </div>
          </section>
          )}

          {/* 3. Loan & Tenure Configuration */}
          {activeTab===2 && (
          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">3. Loan & Tenure Configuration</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Minimum Loan Amount (₹)</label>
                <input type="number" step="0.01" min={0} value={minLoanAmount} onChange={(e)=>setMinLoanAmount(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2" placeholder="e.g., 10000" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Maximum Loan Amount (₹)</label>
                <input type="number" step="0.01" min={0} value={maxLoanAmount} onChange={(e)=>setMaxLoanAmount(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2" placeholder="e.g., 500000" />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tenure Options (months)</label>
              <div className="mt-1 flex gap-2">
                <input
                  value={tenureInput}
                  onChange={(e)=>setTenureInput(e.target.value)}
                  onKeyDown={(e)=>{ if (e.key === 'Enter') { e.preventDefault(); addTenureFromInput(); } }}
                  className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2"
                  placeholder="Enter tenure in months (e.g., 12)"
                />
                <button type="button" onClick={addTenureFromInput} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">Add</button>
              </div>
              <div className="mt-2">
                {tenureOptions.length === 0 ? (
                  <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">No tenure options added yet.</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {tenureOptions.map(t => (
                      <span key={t} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                        {t} months
                        <button type="button" onClick={()=>removeTenure(t)} className="text-blue-600 hover:text-blue-800">×</button>
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Press Enter in the tenure input to add quickly.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Repayment Frequency</label>
                <select value={repaymentFrequency} onChange={(e)=>setRepaymentFrequency(e.target.value as any)} className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2">
                  {REPAYMENT_FREQUENCIES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Interest Type</label>
                <select value={interestType} onChange={(e)=>setInterestType(e.target.value as any)} className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2">
                  {INTEREST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Loan Types (multiple)</label>
              <div className="mt-1 flex gap-2">
                <input value={loanTypeInput} onChange={(e)=>setLoanTypeInput(e.target.value)} onKeyDown={(e)=>{ if (e.key === 'Enter') { e.preventDefault(); if (loanTypeInput.trim()) { setLoanTypes(prev => prev.includes(loanTypeInput.trim()) ? prev : [...prev, loanTypeInput.trim()]); setLoanTypeInput(''); } } }} className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2" placeholder="e.g., Personal, Gold" />
                <button type="button" onClick={()=>{ if (loanTypeInput.trim()) { setLoanTypes(prev => prev.includes(loanTypeInput.trim()) ? prev : [...prev, loanTypeInput.trim()]); setLoanTypeInput(''); } }} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">Add</button>
              </div>
              <div className="mt-2">
                {loanTypes.length === 0 ? (
                  <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">No loan types added yet.</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {loanTypes.map(t => (
                      <span key={t} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {t}
                        <button type="button" onClick={()=>setLoanTypes(prev => prev.filter(x => x !== t))} className="text-emerald-700 hover:text-emerald-900">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
          )}

          {/* 4. Approval & Disbursement Settings */}
          {activeTab===3 && (
          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">4. Approval & Disbursement Settings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Approval Type</label>
                <select value={approvalType} onChange={(e)=>setApprovalType(e.target.value as any)} className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2">
                  {APPROVAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Average Approval Time</label>
                <input value={avgApprovalTime} onChange={(e)=>setAvgApprovalTime(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2" placeholder="e.g., 2 hours, 1 day" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">KYC Method</label>
                <select value={kycMethod} onChange={(e)=>setKycMethod(e.target.value as any)} className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2">
                  {KYC_METHODS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Disbursement Modes</label>
                <div className="mt-2 flex flex-wrap gap-3">
                  {DISBURSEMENT_MODES.map((m) => (
                    <label key={m} className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input type="checkbox" checked={disbursementModes.includes(m)} onChange={(e)=>{
                        setDisbursementModes(prev => e.target.checked ? [...prev, m] : prev.filter(x => x !== m));
                      }} />
                      <span>{m}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </section>
          )}

          {/* 5. Integration & Compliance Information */}
          {activeTab===4 && (
          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">5. Integration & Compliance Information</h2>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">RBI Certificate (PDF)</label>
                <div className="mt-1 flex items-center gap-3">
                  <input type="file" accept="application/pdf,image/*" onChange={(e)=>setRbiFile(e.target.files?.[0] || null)} />
                  {rbiCertificateUrl ? <a href={rbiCertificateUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm">Download current</a> : null}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">PAN or GST Document</label>
                <div className="mt-1 flex items-center gap-3">
                  <input type="file" accept="application/pdf,image/*" onChange={(e)=>setPanGstFile(e.target.files?.[0] || null)} />
                  {panGstDocUrl ? <a href={panGstDocUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm">Download current</a> : null}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">GST Certificate</label>
                <div className="mt-1 flex items-center gap-3">
                  <input type="file" accept="application/pdf,image/*" onChange={(e)=>setGstFile(e.target.files?.[0] || null)} />
                  {gstCertificateUrl ? <a href={gstCertificateUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm">Download current</a> : null}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Digital Signature File (optional)</label>
                <div className="mt-1 flex items-center gap-3">
                  <input type="file" accept="application/pdf,.pfx,.p12,image/*" onChange={(e)=>setDscFile(e.target.files?.[0] || null)} />
                  {digitalSignatureUrl ? <a href={digitalSignatureUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm">Download current</a> : null}
                </div>
              </div>
              {(uploading || submitting) && (
                <p className="text-xs text-gray-500 dark:text-gray-400">{uploading ? 'Uploading documents...' : 'Saving...'}</p>
              )}
            </div>
          </section>
          )}

          {/* 6. Additional Notes */}
          {activeTab===5 && (
          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">6. Additional Notes</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes / Special Schemes / Internal Remarks</label>
              <textarea value={notes} onChange={(e)=>setNotes(e.target.value)} rows={3} className="mt-1 w-full rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" placeholder="Any additional information..." />
            </div>
          </section>
          )}

          <div className="pt-2 flex items-center justify-between gap-3">
            <div className="flex gap-2">
              <button type="button" onClick={()=>setActiveTab((t)=>Math.max(0,t-1))} disabled={activeTab===0} className={`px-4 py-2 rounded border ${activeTab===0 ? 'cursor-not-allowed bg-gray-100 dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700' : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>Previous</button>
              <button type="button" onClick={()=>setActiveTab((t)=>Math.min(TABS.length-1,t+1))} disabled={activeTab===TABS.length-1} className={`px-4 py-2 rounded border ${activeTab===TABS.length-1 ? 'cursor-not-allowed bg-gray-100 dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700' : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>Next</button>
            </div>
            {activeTab === TABS.length - 1 && (
              <button type="submit" disabled={!canSubmit || submitting} className={`inline-flex items-center justify-center px-4 py-2 rounded text-white ${(!canSubmit || submitting) ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {submitting ? 'Saving...' : 'Save NBFC Details'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
    </div>
  );
}
