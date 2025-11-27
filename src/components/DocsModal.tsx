import { useEffect, useState } from 'react';
import { X, FileText, Download } from 'lucide-react';
import { LoanDocument, supabase } from '../lib/supabase';

interface DocsModalProps {
  loanId: string;  // Required: loan_id to fetch documents
  fullName: string; // for filename
  onClose: () => void;
  loanType?: 'general' | 'product';
  onlyAdditional?: boolean;
}

export default function DocsModal({ loanId, fullName, onClose, loanType = 'general', onlyAdditional = false }: DocsModalProps) {
  const [docs, setDocs] = useState<LoanDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        
        if (!loanId) {
          setError('No loan ID provided');
          setLoading(false);
          return;
        }
        
        console.log(`Starting document fetch with loan_id: ${loanId}, loanType: ${loanType}`);
        
        // Build query - filter by loan_id
        let query = supabase
          .from('loan_documents')
          .select('*')
          .eq('loan_id', loanId);

        console.log(`Built query filtering by loan_id: ${loanId}`);

        // Filter by loan_type if specified
        if (loanType === 'product') {
          query = query.or('loan_type.eq.product,loan_type.is.null');
          console.log('Added product loan type filter (product OR NULL)');
        } else if (loanType === 'general') {
          query = query.eq('loan_type', 'general');
          console.log('Added general loan type filter');
        }

        query = query.order('uploaded_at', { ascending: true });
        console.log('Added ordering by uploaded_at');
        
        const { data, error: queryError } = await query;
        
        if (queryError) {
          console.error('Document fetch error:', {
            message: queryError.message,
            code: queryError.code,
            details: queryError.details,
            hint: queryError.hint,
            loanId,
            loanType,
          });
          throw queryError;
        }

        console.log('Documents fetched successfully:', {
          count: data?.length || 0,
          loanId,
          loanType,
          documents: data?.map(d => ({ id: d.id, type: d.document_type, name: d.file_name }))
        });

        let result = data || [];
        
        // If no documents found, debug
        if (!result || result.length === 0) {
          console.warn(`No documents found for loan_id: ${loanId}`);
          
          // Check if any documents exist for this loan
          const { data: debugData } = await supabase
            .from('loan_documents')
            .select('*')
            .eq('loan_id', loanId);
          
          if (debugData && debugData.length > 0) {
            console.log(`Found ${debugData.length} total documents for this loan:`, debugData);
            console.log('Loan types:', debugData.map(d => ({ doc_type: d.document_type, loan_type: d.loan_type })));
          } else {
            console.log(`No documents at all for loan_id: ${loanId}`);
          }
        }
        
        if (onlyAdditional) {
          if (loanType === 'general') {
            const additionalSet = new Set<string>(['Appraisal Slip', 'Income Proof', 'Address Proof', 'Utility Bill']);
            result = result.filter(d => additionalSet.has(d.document_type));
          }
        }
        
        console.log('Setting docs state with', result.length, 'documents');
        setDocs(result);
      } catch (e: any) {
        console.error('Failed to load docs', e);
        setError(e.message || 'Failed to load documents');
      } finally {
        setLoading(false);
      }
    })();
  }, [loanId, loanType, onlyAdditional]);

  const download = async (doc: LoanDocument) => {
    try {
      const sanitize = (s: string) => s.replace(/[^\w\-\.\s]/g, '_').replace(/\s+/g, ' ').trim();
      const fileName = `${sanitize(fullName)} - ${sanitize(doc.file_name)}`;

      const normalizePath = (raw: string, bucket: 'loan_documents' | 'documents') => {
        // If it's a full URL, try to extract the path after the bucket name
        try {
          if (/^https?:\/\//i.test(raw)) {
            const url = new URL(raw);
            const idx = url.pathname.indexOf(`/${bucket}/`);
            if (idx !== -1) {
              return decodeURIComponent(url.pathname.substring(idx + (`/${bucket}/`).length));
            }
            // If cannot extract path for bucket, return empty to indicate URL usage
            return '';
          }
          // If the raw includes '/object/public/<bucket>/' or '/object/sign/<bucket>/' etc., strip before bucket
          const marker = `/${bucket}/`;
          const objIdx = raw.indexOf(marker);
          if (objIdx !== -1) return decodeURIComponent(raw.substring(objIdx + marker.length));
          // Already a relative path
          return raw.replace(/^\/+/, '');
        } catch {
          return raw;
        }
      };

      // If file_path is a full URL, attempt direct fetch for download to avoid opening viewer
      if (/^https?:\/\//i.test(doc.file_path)) {
        try {
          const resp = await fetch(doc.file_path, { credentials: 'omit' });
          if (resp.ok) {
            const blob = await resp.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            return;
          }
        } catch (_) {
          // fall through to open in new tab
        }
        // Fallback: open the URL (may preview depending on content type)
        const a = document.createElement('a');
        a.href = doc.file_path;
        a.download = fileName;
        a.target = '_blank';
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }

      // Try loan_documents bucket first, fallback to documents
      let data: Blob | null = null;
      let error: any = null;
      {
        const path1 = normalizePath(doc.file_path, 'loan_documents');
        const res = path1
          ? await supabase.storage.from('loan_documents').download(path1)
          : { data: null, error: new Error('No relative path for loan_documents') } as any;
        data = res.data as any;
        error = res.error as any;
      }
      if (error || !data) {
        const path2 = normalizePath(doc.file_path, 'documents');
        const res2 = path2
          ? await supabase.storage.from('documents').download(path2)
          : { data: null, error: new Error('No relative path for documents') } as any;
        data = res2.data as any;
        error = res2.error as any;
        if (error || !data) {
          // Fallback: try public URL
          const pub1 = supabase.storage.from('loan_documents').getPublicUrl(normalizePath(doc.file_path, 'loan_documents') || doc.file_path);
          if (pub1.data?.publicUrl) {
            const a = document.createElement('a');
            a.href = pub1.data.publicUrl;
            a.download = fileName;
            a.target = '_blank';
            a.rel = 'noopener';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            return;
          }
          const pub2 = supabase.storage.from('documents').getPublicUrl(normalizePath(doc.file_path, 'documents') || doc.file_path);
          if (pub2.data?.publicUrl) {
            const a = document.createElement('a');
            a.href = pub2.data.publicUrl;
            a.download = fileName;
            a.target = '_blank';
            a.rel = 'noopener';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            return;
          }
          // If bucket is private, try signed URL
          const pathSigned1 = normalizePath(doc.file_path, 'loan_documents') || doc.file_path;
          const signed1 = await supabase.storage.from('loan_documents').createSignedUrl(pathSigned1, 60);
          if (signed1.data?.signedUrl) {
            const a = document.createElement('a');
            a.href = signed1.data.signedUrl;
            a.download = fileName;
            a.target = '_blank';
            a.rel = 'noopener';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            return;
          }
          const pathSigned2 = normalizePath(doc.file_path, 'documents') || doc.file_path;
          const signed2 = await supabase.storage.from('documents').createSignedUrl(pathSigned2, 60);
          if (signed2.data?.signedUrl) {
            const a = document.createElement('a');
            a.href = signed2.data.signedUrl;
            a.download = fileName;
            a.target = '_blank';
            a.rel = 'noopener';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            return;
          }
          throw error || new Error('No data');
        }
      }

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Download failed', e);
      alert('Failed to download document');
    }
  };
 


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Documents</h3>
          <button onClick={onClose} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-4">
          {loading ? (
            <p className="text-sm text-gray-600 dark:text-gray-300">Loading...</p>
          ) : error ? (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-700 dark:text-red-300">⚠️ Error loading documents: {error}</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">Check browser console for details (F12)</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">Loan ID: {loanId}</p>
            </div>
          ) : docs.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-gray-600 dark:text-gray-300">No documents uploaded yet.</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Documents will appear here once you upload them with your loan application.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {docs.map((d) => (
                <button
                  key={d.id}
                  onClick={() => download(d)}
                  className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-left"
                >
                  <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{d.document_type}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{d.file_size ? `${(d.file_size/1024).toFixed(2)} KB` : 'N/A'}</p>
                  </div>
                  <Download className="w-4 h-4 text-gray-400" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div> 
      
    </div>
  );
}
