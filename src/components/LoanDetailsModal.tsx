import { useEffect, useMemo, useState } from 'react';
import { X, Download, FileText } from 'lucide-react';
import { LoanApplication, LoanDocument, supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import VerificationModal from './VerificationModal';
import DisbursementModal, { DisbursementData } from './DisbursementModal';

interface LoanDetailsModalProps {
  loan: LoanApplication;
  onClose: () => void;
  showActions?: boolean;
  onAccept?: () => void;
  onReject?: () => void;
  onStatusChange?: (loanId: string, newStatus: LoanApplication['status']) => void;
}

export default function LoanDetailsModal({ loan, onClose, showActions, onAccept, onReject, onStatusChange }: LoanDetailsModalProps) {
  const { profile } = useAuth();
  const [documents, setDocuments] = useState<LoanDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [localStatus, setLocalStatus] = useState<LoanApplication['status']>(loan.status);
  const [openVerify, setOpenVerify] = useState(false);
  const [openDisburse, setOpenDisburse] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, [loan.id]);

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('loan_documents')
        .select('*')
        .eq('loan_id', loan.id);

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  // ---------------- Document Upload Section ----------------
  const requiredTypes = ['Appraisal Slip','Utility Bill','Income Proof','Address Proof'] as const;
  type ReqType = typeof requiredTypes[number];
  const [docFiles, setDocFiles] = useState<Record<ReqType, File | null>>({
    'Appraisal Slip': null,
    'Utility Bill': null,
    'Income Proof': null,
    'Address Proof': null,
  });
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);

  const docsComplete = useMemo(() => {
    const have = new Set(documents.map(d => d.document_type));
    return requiredTypes.every(t => have.has(t));
  }, [documents]);

  const loanDocsAlreadyUploaded = (loan as any).documents_uploaded === true || docsComplete;
  const isAdmin = (profile?.role === 'admin');
  const canShowUpload = localStatus === 'Accepted' && !isAdmin;

  const handleVerified = () => {
    setLocalStatus('Verified');
    onStatusChange?.(loan.id, 'Verified');
  };

  const performVerification = async () => {
    try {
      const { error } = await supabase
        .from('loans')
        .update({ status: 'Verified', updated_at: new Date().toISOString() })
        .eq('id', loan.id);
      if (error) throw error;
      handleVerified();
      setOpenVerify(false);
    } catch (e) {
      console.error('Failed to verify loan', e);
      alert('Failed to verify loan.');
    }
  };

  const handleDisbursed = async (data: DisbursementData) => {
    try {
      // Save disbursement details
      await supabase.from('loan_disbursements').insert({
        loan_id: loan.id,
        disbursement_date: data.disbursement_date,
        amount_disbursed: data.amount_disbursed,
        transaction_reference: data.transaction_reference,
        disbursement_proof_url: data.disbursement_proof_url,
        disbursement_remarks: data.disbursement_remarks,
        created_at: new Date().toISOString(),
      });
      // Update loan status
      const { error } = await supabase
        .from('loans')
        .update({ status: 'Loan Disbursed', updated_at: new Date().toISOString() })
        .eq('id', loan.id);
      if (error) throw error;
      setLocalStatus('Loan Disbursed');
      onStatusChange?.(loan.id, 'Loan Disbursed');
      setOpenDisburse(false);
    } catch (e) {
      console.error('Failed to save disbursement', e);
      alert('Failed to save disbursement.');
    }
  };

  const onPick = (type: ReqType, file: File | null) => {
    if (!file) {
      setDocFiles(prev => ({ ...prev, [type]: null }));
      return;
    }
    if (file.type !== 'application/pdf') {
      alert('Only PDF files are allowed');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Max file size is 5MB');
      return;
    }
    setDocFiles(prev => ({ ...prev, [type]: file }));
  };

  const allSelected = requiredTypes.every(t => !!docFiles[t]);

  const handleDocsUpload = async () => {
    if (!canShowUpload || loanDocsAlreadyUploaded) return;
    if (!allSelected) {
      alert('Please select all 4 required documents.');
      return;
    }
    setUploading(true);
    setUploadMsg(null);
    try {
      const folder = `${loan.first_name}_${loan.last_name}/loan_${loan.id}`;
      const toUpload: Array<{ type: ReqType; file: File; path: string }>= [];
      for (const type of requiredTypes) {
        const f = docFiles[type]!;
        const safeType = type.replace(/\s+/g,'_');
        const path = `${folder}/${safeType}_${f.name}`; // retain original file name after type prefix
        const { error } = await supabase.storage
          .from('loan_documents')
          .upload(path, f, { upsert: true, contentType: 'application/pdf', cacheControl: '3600' });
        if (error) throw error;
        toUpload.push({ type, file: f, path });
      }

      // Insert mappings into loan_documents table
      if (toUpload.length > 0) {
        const payload = toUpload.map(u => ({
          loan_id: loan.id,
          document_type: u.type,
          file_name: u.file.name,
          file_path: u.path,
          file_size: u.file.size,
        }));
        const { error: insErr } = await supabase.from('loan_documents').insert(payload);
        if (insErr) throw insErr;
      }

      // Mark loan as docs uploaded
      await supabase.from('loans').update({
        documents_uploaded: true,
        documents_uploaded_at: new Date().toISOString(),
      }).eq('id', loan.id);

      setUploadMsg('All documents uploaded successfully.');
      // refresh list
      await fetchDocuments();
    } catch (e) {
      console.error('Upload failed', e);
      alert('Failed to upload documents');
    } finally {
      setUploading(false);
    }
  };

  const downloadDocument = async (doc: LoanDocument) => {
    try {
      // Try loan_documents bucket first, then fallback to documents
      let data: Blob | null = null;
      let error: any = null;
      {
        const res = await supabase.storage.from('loan_documents').download(doc.file_path);
        data = res.data as any;
        error = res.error as any;
      }
      if (error || !data) {
        const res2 = await supabase.storage.from('documents').download(doc.file_path);
        data = res2.data as any;
        error = res2.error as any;
        if (error || !data) throw error || new Error('No data');
      }

      // Sanitize filename to avoid filesystem issues
      const sanitize = (s: string) => s.replace(/[^\w\-\.\s]/g, '_').replace(/\s+/g, ' ').trim();
      const fullName = sanitize(`${loan.first_name} ${loan.last_name}`);
      const original = sanitize(doc.file_name);
      const fileName = `${fullName} - ${original}`;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading document:', error);
      alert('Failed to download document');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Accepted':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'Verified':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'Loan Disbursed':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      case 'Rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Loan Application Details</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Application ID: {loan.application_number || loan.id.substring(0, 8)}
              <span className="ml-3">| Applied On: {new Date(loan.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: '2-digit' })}</span>
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
            <span className={`inline-flex px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(localStatus)}`}>
              Status: {localStatus}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="col-span-2 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-3">Loan Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Loan Amount</p>
                  <p className="font-semibold text-gray-900 dark:text-white">₹{loan.loan_amount.toLocaleString('en-IN')}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Tenure</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{loan.tenure} months</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Interest Scheme</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{loan.interest_scheme}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Processing Fee</p>
                  <p className="font-semibold text-gray-900 dark:text-white">₹{loan.processing_fee.toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Personal Details</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Full Name</p>
                  <p className="text-gray-900 dark:text-white">{loan.first_name} {loan.last_name}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Father/Mother/Spouse</p>
                  <p className="text-gray-900 dark:text-white">{loan.father_mother_spouse_name}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Date of Birth</p>
                  <p className="text-gray-900 dark:text-white">{new Date(loan.date_of_birth).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Gender</p>
                  <p className="text-gray-900 dark:text-white">{loan.gender}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Marital Status</p>
                  <p className="text-gray-900 dark:text-white">{loan.marital_status}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Contact Details</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Email</p>
                  <p className="text-gray-900 dark:text-white">{loan.email_id}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Mobile (Primary)</p>
                  <p className="text-gray-900 dark:text-white">{loan.mobile_primary}</p>
                </div>
                {loan.mobile_alternative && (
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Mobile (Alternative)</p>
                    <p className="text-gray-900 dark:text-white">{loan.mobile_alternative}</p>
                  </div>
                )}
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Address</p>
                  <p className="text-gray-900 dark:text-white">{loan.address}, {loan.pin_code}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Reference 1</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Name</p>
                  <p className="text-gray-900 dark:text-white">{loan.reference1_name}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Contact</p>
                  <p className="text-gray-900 dark:text-white">{loan.reference1_contact}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Relationship</p>
                  <p className="text-gray-900 dark:text-white">{loan.reference1_relationship}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Reference 2</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Name</p>
                  <p className="text-gray-900 dark:text-white">{loan.reference2_name}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Contact</p>
                  <p className="text-gray-900 dark:text-white">{loan.reference2_contact}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Relationship</p>
                  <p className="text-gray-900 dark:text-white">{loan.reference2_relationship}</p>
                </div>
              </div>
            </div>

            <div className="col-span-2">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Documents</h3>
              {loading ? (
                <p className="text-gray-500 dark:text-gray-400">Loading documents...</p>
              ) : documents.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">No documents found</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {documents.map((doc) => (
                    <button
                      key={doc.id}
                      onClick={() => downloadDocument(doc)}
                      className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-left"
                    >
                      <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {doc.document_type}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {doc.file_size ? `${(doc.file_size / 1024).toFixed(2)} KB` : 'N/A'}
                        </p>
                      </div>
                      <Download className="w-4 h-4 text-gray-400" />
                    </button>
                  ))}
                </div>
              )}

              {/* Upload section (merchant only) */}
              <div className="mt-6 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Add Documents</h4>
                {!canShowUpload && (
                  <p className="text-sm text-gray-600 dark:text-gray-300">N/A — Loan must be accepted by admin to add documents.</p>
                )}
                {canShowUpload && loanDocsAlreadyUploaded && (
                  <p className="text-sm text-green-600">Documents  added for this loan.</p>
                )}
                {canShowUpload && !loanDocsAlreadyUploaded && (
                  <div className="space-y-3">
                    {requiredTypes.map((t) => (
                      <div key={t} className="flex items-center justify-between gap-3">
                        <label className="text-sm text-gray-700 dark:text-gray-300 w-40">{t}</label>
                        <input
                          type="file"
                          accept="application/pdf"
                          onChange={(e) => onPick(t, e.target.files?.[0] || null)}
                          className="flex-1 text-sm"
                        />
                      </div>
                    ))}
                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        onClick={handleDocsUpload}
                        disabled={!allSelected || uploading}
                        className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
                      >
                        {uploading ? 'Uploading...' : 'Submit Documents'}
                      </button>
                    </div>
                    {uploadMsg && <p className="text-sm text-green-600">{uploadMsg}</p>}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Pending actions */}
        {showActions && localStatus === 'Pending' && (
          <div className="flex items-center justify-end space-x-4 p-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onReject}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Reject
            </button>
            <button
              onClick={onAccept}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Accept
            </button>
          </div>
        )}

        {/* Admin actions sequence: show only when eligible */}
        {isAdmin && (
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
            {/* Show Verification only when docs uploaded and status Accepted */}
            {(loanDocsAlreadyUploaded && localStatus === 'Accepted') && (
              <button
                onClick={() => setOpenVerify(true)}
                className="px-4 py-2 rounded text-white bg-blue-600 hover:bg-blue-700"
              >
                Verification
              </button>
            )}
            {/* Show Loan Disbursed only after verification */}
            {localStatus === 'Verified' && (
              <button
                onClick={() => setOpenDisburse(true)}
                className="px-4 py-2 rounded text-white bg-purple-600 hover:bg-purple-700"
              >
                Loan Disburse
              </button>
            )}
          </div>
        )}

        {openVerify && (
          <VerificationModal
            loan={{ ...loan, status: localStatus }}
            onClose={() => setOpenVerify(false)}
            onVerify={performVerification}
          />
        )}

        {openDisburse && (
          <DisbursementModal
            loan={{ ...loan, status: localStatus }}
            onClose={() => setOpenDisburse(false)}
            onConfirm={handleDisbursed}
          />
        )}
      </div>
    </div>
  );
}