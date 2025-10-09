import { useEffect, useState } from 'react';
import { X, FileText, Download } from 'lucide-react';
import { LoanDocument, supabase } from '../lib/supabase';

interface DocsModalProps {
  loanId: string;
  fullName: string; // for filename
  onClose: () => void;
}

export default function DocsModal({ loanId, fullName, onClose }: DocsModalProps) {
  const [docs, setDocs] = useState<LoanDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('loan_documents')
          .select('*')
          .eq('loan_id', loanId)
          .order('uploaded_at', { ascending: true });
        if (error) throw error;
        setDocs(data || []);
      } catch (e) {
        console.error('Failed to load docs', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [loanId]);

  const download = async (doc: LoanDocument) => {
    try {
      // Try loan_documents bucket first, fallback to documents
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

      const sanitize = (s: string) => s.replace(/[^\w\-\.\s]/g, '_').replace(/\s+/g, ' ').trim();
      const fileName = `${sanitize(fullName)} - ${sanitize(doc.file_name)}`;

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
          ) : docs.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-300">No documents uploaded.</p>
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
