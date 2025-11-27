import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useEffect, useState } from 'react';

export default function LoanApplyPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const location = useLocation();
  const tenure = (location.state as any)?.tenure as number | undefined;
  const emi = (location.state as any)?.emi as number | undefined;
  const amount = (location.state as any)?.amount as number | undefined;
  const downPayment = (location.state as any)?.downPayment as number | undefined;
  const productId = (location.state as any)?.productId as string | undefined;
  const productName = (location.state as any)?.productName as string | undefined;
  const productImage = (location.state as any)?.productImage as string | undefined;
  const productCategory = (location.state as any)?.productCategory as string | undefined;
  const productPrice = (location.state as any)?.productPrice as number | undefined;
  const merchantId = (location.state as any)?.merchantId as string | undefined;

  const [form, setForm] = useState({
    full_name: profile?.username || '',
    email: profile?.email || '',
    phone: '',
    alt_phone: '',
    address: '',
    pan: '',
    aadhaar: '',
    occupation: '',
    pin_code: '',
    dob: '',
    guardian_name: '',
    monthly_income: '',
    referral_code: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const [bank, setBank] = useState({
    account_number: '',
    ifsc_code: '',
    bank_name: '',
  });

  const [docFiles, setDocFiles] = useState({
    aadhaarCopy: null as File | null,
    panCopy: null as File | null,
    utilityBill: null as File | null,
    bankStatement: null as File | null,
    photo: null as File | null,
  });
  const [docErrors, setDocErrors] = useState<{ [k: string]: string }>({});
  const [merchantInfo, setMerchantInfo] = useState<{ owner_name?: string | null; business_name?: string | null; referral_code?: string | null } | null>(null);
  const [merchantError, setMerchantError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!merchantId) return;
      try {
        const { data, error } = await supabase
          .from('merchant_profiles')
          .select('owner_name,business_name,referral_code')
          .eq('merchant_id', merchantId)
          .maybeSingle();
        if (error) throw error;
        if (!cancelled) setMerchantInfo(data as any);
      } catch (e) {
        console.error('Failed to load merchant info', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [merchantId]);

  const submit = async () => {
    setSubmitting(true);
    try {
      if (!user) {
        setSubmitting(false);
        return;
      }

      const fullName = (form.full_name || '').trim();
      const [firstNameRaw, ...restName] = fullName.split(' ');
      const first_name = firstNameRaw || 'Customer';
      const last_name = restName.join(' ') || 'Name';

      const loan_amount = amount ?? 0;
      const tenureVal = tenure ?? 0;
      const dpAmount = downPayment ?? 0;
      const basePrice = typeof productPrice === 'number' ? productPrice : loan_amount;
      const dpPercentage = basePrice > 0 ? (dpAmount / basePrice) * 100 : 0;

      const monthlyEmi = emi ?? 0;
      const totalPayable = monthlyEmi * tenureVal;
      const interestAmount = Math.max(totalPayable - loan_amount, 0);

      const goldPriceLockDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

      // Validate merchant referral code if provided
      if (merchantId && form.referral_code.trim()) {
        const code = form.referral_code.trim();
        try {
          const { data, error } = await supabase
            .from('merchant_profiles')
            .select('referral_code')
            .eq('merchant_id', merchantId)
            .maybeSingle();
          if (error) throw error;
          const stored = (data as any)?.referral_code?.trim();
          if (!stored || stored !== code) {
            setMerchantError('Invalid referral code for this merchant.');
            setSubmitting(false);
            return;
          }
          setMerchantError(null);
        } catch (e) {
          console.error('Failed to validate referral code', e);
          setMerchantError('Could not validate referral code. Please try again.');
          setSubmitting(false);
          return;
        }
      } else {
        setMerchantError(null);
      }

      const payload = {
        user_id: user.id,
        first_name,
        last_name,
        email_id: form.email,
        mobile_primary: form.phone,
        mobile_alternative: form.alt_phone || null,
        address: form.address,
        pin_code: form.pin_code,
        date_of_birth: form.dob || goldPriceLockDate,
        father_mother_spouse_name: form.guardian_name || 'Not provided',
        aadhaar_number: form.aadhaar,
        pan_number: form.pan,
        occupation: form.occupation,
        monthly_income: form.monthly_income ? Number(form.monthly_income) : null,
        employment_type: null,
        loan_purpose: null,
        loan_amount,
        tenure: tenureVal,
        processing_fee: 0,
        status: 'Pending',
        declaration_accepted: true,
        interest_scheme: 'Standard',
        gold_price_lock_date: goldPriceLockDate,
        reference1_name: 'Not provided',
        reference1_address: 'Not provided',
        reference1_contact: '0000000000',
        reference1_relationship: 'Friend',
        reference2_name: 'Not provided',
        reference2_address: 'Not provided',
        reference2_contact: '0000000000',
        reference2_relationship: 'Friend',
        bank_name: bank.bank_name || null,
        account_number: bank.account_number || null,
        ifsc_code: bank.ifsc_code || null,
        product_id: productId ?? null,
        product_name: productName || 'Product',
        product_image_url: productImage || '',
        product_price: basePrice,
        product_category: productCategory ?? null,
        merchant_id: merchantId ?? null,
        introduced_by: merchantInfo?.business_name || merchantInfo?.owner_name || null,
        downpayment_percentage: dpPercentage,
        downpayment_amount: dpAmount,
        referral_code: form.referral_code.trim() || null,
      } as any;

      const { data, error } = await supabase
        .from('product_loans')
        .insert([payload])
        .select('id')
        .single();

      if (error) {
        console.error('Failed to create product loan', error);
        setSubmitting(false);
        return;
      }

      const loanId = (data as any)?.id as string | undefined;

      console.log('Product loan created successfully with ID:', loanId);

      // Upload documents if provided
      if (loanId) {
        console.log('=== DOCUMENT UPLOAD PROCESS STARTED ===');
        console.log('Loan ID:', loanId);
        console.log('User ID:', user?.id);
        console.log('User Email:', user?.email);
        
        const displayNameRaw = profile?.full_name || profile?.username || form.full_name || 'Customer';
        const safeDisplay = displayNameRaw.replace(/[^A-Za-z0-9]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
        const folder = `${safeDisplay || 'Customer'}_${user.id}`;
        
        console.log('Storage folder:', folder);
        
        const uploads: { label: string; key: keyof typeof docFiles }[] = [
          { label: 'Aadhaar Copy', key: 'aadhaarCopy' },
          { label: 'PAN Copy', key: 'panCopy' },
          { label: 'Utility Bill', key: 'utilityBill' },
          { label: 'Bank Statement', key: 'bankStatement' },
          { label: 'Photo', key: 'photo' },
        ];

        const records: { 
          document_type: string
          file_name: string
          file_path: string
          file_size: number
          storage_path: string
        }[] = [];

        let uploadedCount = 0;
        let failedCount = 0;

        for (const u of uploads) {
          const file = docFiles[u.key];
          if (!file) {
            console.log(`✓ Skipping ${u.label} - not provided`);
            continue;
          }

          console.log(`\n📄 Processing ${u.label}...`);
          console.log(`  File: ${file.name}`);
          console.log(`  Size: ${(file.size / 1024).toFixed(2)} KB`);

          // Validate file size
          const maxSize = 5 * 1024 * 1024; // 5MB
          if (file.size > maxSize) {
            const errorMsg = `File size must be less than 5MB (current: ${(file.size / (1024 * 1024)).toFixed(2)}MB)`;
            setDocErrors((prev) => ({ ...prev, [u.key]: errorMsg }));
            console.error(`  ✗ ${errorMsg}`);
            failedCount++;
            continue;
          }

          // Create storage path
          const safeLabel = u.label.replace(/\s+/g, '_').replace(/[^A-Za-z0-9_]/g, '');
          const timestamp = new Date().getTime();
          const path = `${folder}/${safeLabel}_${loanId}_${timestamp}_${file.name}`;
          
          console.log(`  Storage path: ${path}`);

          // Upload to Supabase Storage
          try {
            const { error: uploadError, data: uploadData } = await supabase.storage
              .from('loan_documents')
              .upload(path, file, { 
                upsert: true, 
                cacheControl: '3600',
                contentType: file.type || 'application/octet-stream'
              });

            if (uploadError) {
              console.error(`  ✗ Upload failed:`, uploadError.message);
              failedCount++;
              continue;
            }

            console.log(`  ✓ Uploaded to storage successfully`);
            console.log(`  Upload data:`, uploadData);

            // Generate public URL
            const { data: publicUrlData } = supabase.storage
              .from('loan_documents')
              .getPublicUrl(path);
            
            const publicUrl = publicUrlData?.publicUrl;
            console.log(`  Public URL: ${publicUrl?.substring(0, 80)}...`);

            records.push({
              document_type: u.label,
              file_name: file.name,
              file_path: publicUrl || path, // Store public URL, fallback to relative path
              file_size: file.size,
              storage_path: path
            });
            
            uploadedCount++;
          } catch (err: any) {
            console.error(`  ✗ Error uploading ${u.label}:`, err.message);
            failedCount++;
          }
        }

        console.log(`\n📊 Upload Summary: ${uploadedCount} uploaded, ${failedCount} failed`);

        // Save metadata to database
        if (records.length > 0) {
          console.log(`\n💾 Saving ${records.length} document records to database...`);
          console.log('Record details:');
          records.forEach((r, i) => {
            console.log(`  [${i + 1}] ${r.document_type} - ${r.file_name} (${(r.file_size / 1024).toFixed(2)} KB)`);
          });
          
          const insertRecords = records.map((r) => ({
            loan_id: loanId,
            loan_type: 'product',
            document_type: r.document_type,
            file_name: r.file_name,
            file_path: r.file_path,
            file_size: r.file_size,
            created_by: user?.id,
          }));

          console.log('Insert payload:', JSON.stringify(insertRecords, null, 2));

          const { data: insertedData, error: docErr } = await supabase
            .from('loan_documents')
            .insert(insertRecords)
            .select();

          if (docErr) {
            console.error('✗ Failed to save loan documents metadata:');
            console.error('  Error message:', docErr.message);
            console.error('  Error code:', docErr.code);
            console.error('  Error details:', docErr.details);
            console.error('  Error hint:', docErr.hint);
          } else {
            console.log('✓ Documents metadata saved successfully');
            console.log(`  Inserted ${insertedData?.length || records.length} records`);
            console.log('  Database response:', insertedData);
          }
        } else {
          console.warn('⚠ No documents were successfully uploaded to storage');
        }

        console.log('=== DOCUMENT UPLOAD PROCESS COMPLETED ===\n');
      }

      navigate('/customer/loans', { state: { justApplied: true } });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow dark:shadow-lg p-6">
        <h1 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Loan Application</h1>
        <div className="mb-4 p-4 rounded-lg bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700">
          <div className="font-semibold text-gray-900 dark:text-white">Selected Tenure</div>
          <div className="text-sm text-gray-700 dark:text-gray-300">{tenure ?? '-'} Months · EMI: ₹{(emi ?? 0).toLocaleString('en-IN')}</div>
        </div>

        {merchantId && (
          <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
            <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Merchant Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Owner Name</label>
                <input
                  value={merchantInfo?.owner_name || ''}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Business Name</label>
                <input
                  value={merchantInfo?.business_name || ''}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Referral Code</label>
                <input
                  value={form.referral_code}
                  onChange={(e)=> setForm({...form, referral_code: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  placeholder="Enter referral code if provided by merchant"
                />
                {merchantError && (
                  <p className="text-xs text-red-500 dark:text-red-400 mt-1">{merchantError}</p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
            <input value={form.full_name} onChange={(e)=> setForm({...form, full_name: e.target.value})} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400" />
          </div>
          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Email</label>
            <input value={form.email} onChange={(e)=> setForm({...form, email: e.target.value})} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400" />
          </div>
          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Phone</label>
            <input value={form.phone} onChange={(e)=> setForm({...form, phone: e.target.value})} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400" />
          </div>
          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Alternative Phone Number</label>
            <input value={form.alt_phone} onChange={(e)=> setForm({...form, alt_phone: e.target.value})} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400" />
          </div>
          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Address</label>
            <input value={form.address} onChange={(e)=> setForm({...form, address: e.target.value})} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400" />
          </div>
          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">PAN Number</label>
            <input value={form.pan} onChange={(e)=> setForm({...form, pan: e.target.value})} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400" />
          </div>
          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Aadhaar Number</label>
            <input value={form.aadhaar} onChange={(e)=> setForm({...form, aadhaar: e.target.value})} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400" />
          </div>
          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Pin Code</label>
            <input value={form.pin_code} onChange={(e)=> setForm({...form, pin_code: e.target.value})} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400" />
          </div>
          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Date of Birth</label>
            <input type="date" value={form.dob} onChange={(e)=> setForm({...form, dob: e.target.value})} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400" />
          </div>
          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Father/Mother/Spouse Name</label>
            <input value={form.guardian_name} onChange={(e)=> setForm({...form, guardian_name: e.target.value})} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400" />
          </div>
          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Occupation</label>
            <input value={form.occupation} onChange={(e)=> setForm({...form, occupation: e.target.value})} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400" />
          </div>
          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Monthly Income</label>
            <input
              type="number"
              value={form.monthly_income}
              onChange={(e)=> setForm({...form, monthly_income: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            />
          </div>
        </div>

        {/* Loan Details Summary */}
        <div className="mt-6 border border-green-300 dark:border-green-700 rounded-lg p-4 bg-green-50 dark:bg-green-900/20">
          <h2 className="text-sm font-semibold mb-3 text-gray-900 dark:text-white">Loan Details</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-600 dark:text-gray-400">Loan Amount (Principal)</p>
              <p className="font-semibold text-gray-900 dark:text-white">₹{(amount ?? 0).toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400">Downpayment</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                ₹{(downPayment ?? 0).toLocaleString('en-IN')}
              </p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400">Tenure (Months)</p>
              <p className="font-semibold text-gray-900 dark:text-white">{tenure ?? '-'}</p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400">Monthly EMI</p>
              <p className="font-semibold text-gray-900 dark:text-white">₹{(emi ?? 0).toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400">Interest Amount</p>
              <p className="font-semibold text-gray-900 dark:text-white">₹{(() => {
                const loanAmt = amount ?? 0;
                const t = tenure ?? 0;
                const mEmi = emi ?? 0;
                const total = mEmi * t;
                const interest = Math.max(total - loanAmt, 0);
                return interest.toLocaleString('en-IN');
              })()}</p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400">Total Amount</p>
              <p className="font-semibold text-gray-900 dark:text-white">₹{(() => {
                const t = tenure ?? 0;
                const mEmi = emi ?? 0;
                const total = mEmi * t;
                return total.toLocaleString('en-IN');
              })()}</p>
            </div>
          </div>
        </div>

        {/* Bank Details */}
        <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
          <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Bank Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Account Number</label>
              <input
                value={bank.account_number}
                onChange={(e)=> setBank({...bank, account_number: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">IFSC Code</label>
              <input
                value={bank.ifsc_code}
                onChange={(e)=> setBank({...bank, ifsc_code: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Bank Name</label>
              <input
                value={bank.bank_name}
                onChange={(e)=> setBank({...bank, bank_name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
          <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Upload Documents</h2>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">Supported: PDF, JPG, PNG. Max 5MB per file.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: 'Aadhaar Copy', key: 'aadhaarCopy' as const },
              { label: 'PAN Copy', key: 'panCopy' as const },
              { label: 'Latest Utility Bill / Gas Bill / Rental Agreement', key: 'utilityBill' as const },
              { label: 'Bank Passbook / Statement (Last 6 months)', key: 'bankStatement' as const },
              { label: 'Passport Size Photo', key: 'photo' as const },
            ].map((field) => {
              const file = docFiles[field.key];
              return (
                <div key={field.key} className="space-y-1">
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">{field.label}</label>
                  <input
                    type="file"
                    accept={field.key === 'photo' ? '.jpg,.jpeg,.png' : '.pdf,.jpg,.jpeg,.png'}
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      setDocErrors((prev) => ({ ...prev, [field.key]: '' }));
                      if (!f) {
                        setDocFiles((prev) => ({ ...prev, [field.key]: null }));
                        return;
                      }
                      if (f.size > 5 * 1024 * 1024) {
                        setDocErrors((prev) => ({ ...prev, [field.key]: 'File size must be less than 5MB' }));
                        return;
                      }
                      setDocFiles((prev) => ({ ...prev, [field.key]: f }));
                    }}
                    className="w-full text-sm text-gray-900 dark:text-white file:px-3 file:py-2 file:border file:border-gray-300 dark:file:border-gray-600 file:rounded file:bg-gray-100 dark:file:bg-gray-700 file:text-gray-900 dark:file:text-white file:cursor-pointer"
                  />
                  {file && (
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {file.name} ({(file.size / 1024).toFixed(2)} KB)
                    </p>
                  )}
                  {docErrors[field.key] && (
                    <p className="text-xs text-red-500">{docErrors[field.key]}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button disabled={submitting} onClick={submit} className="px-5 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold">Submit</button>
          <button onClick={()=> navigate(-1)} className="px-5 py-2.5 rounded-lg border">Back</button>
        </div>
      </div>
    </div>
  );
}
