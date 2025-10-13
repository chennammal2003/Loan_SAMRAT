import { useEffect, useMemo, useState } from 'react';
import { X, Link as LinkIcon, Copy, Loader2, RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface ShareLinkModalProps {
  onClose: () => void;
}

export default function ShareLinkModal({ onClose }: ShareLinkModalProps) {
  const { profile } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'generate' | 'manage'>('generate');

  type LinkRow = {
    id: string;
    link_id: string;
    created_at: string;
    is_active: boolean;
    opens_count: number;
    submissions_count: number;
    pending_count: number;
    accepted_count: number;
    rejected_count: number;
  };
  const [rows, setRows] = useState<LinkRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [linkIds, setLinkIds] = useState<string[]>([]);

  const generate = async () => {
    if (!profile) return;
    setGenerating(true);
    setError(null);
    try {
      const linkId = crypto.randomUUID();
      const { error: insertErr } = await supabase.from('loan_share_links').insert({
        link_id: linkId,
        created_by: profile.id,
      });
      if (insertErr) throw insertErr;
      const origin = window.location.origin;
      setLinkUrl(`${origin}/apply-loan/${linkId}`);
      await fetchRows();
    } catch (e: any) {
      setError(e.message || 'Failed to generate link');
    } finally {
      setGenerating(false);
    }
  };

  const copy = async () => {
    if (!linkUrl) return;
    await navigator.clipboard.writeText(linkUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const fetchRows = async () => {
    if (!profile) return;
    setLoadingRows(true);
    try {
      // Primary: use RPC if present
      const { data, error } = await supabase.rpc('get_share_link_stats');
      if (!error && Array.isArray(data)) {
        const list = data as LinkRow[];
        setRows(list);
        setLinkIds(list.map((r) => r.id));
        return;
      }

      // Fallback: manual fetch & aggregate
      const { data: links, error: linkErr } = await supabase
        .from('loan_share_links')
        .select('id, link_id, created_at, is_active, opens_count, submissions_count')
        .eq('created_by', profile.id)
        .order('created_at', { ascending: false });
      if (linkErr) throw linkErr;

      const ids = (links || []).map((l) => l.id);
      setLinkIds(ids);
      if (ids.length === 0) {
        setRows([]);
        return;
      }
      const { data: loanRows, error: loanErr } = await supabase
        .from('loans')
        .select('id, status, share_link_id')
        .in('share_link_id', ids);
      if (loanErr) throw loanErr;

      const grouped: Record<string, { pending: number; accepted: number; rejected: number }> = {};
      (loanRows || []).forEach((ln: any) => {
        const key = ln.share_link_id as string;
        if (!grouped[key]) grouped[key] = { pending: 0, accepted: 0, rejected: 0 };
        if (ln.status === 'Pending') grouped[key].pending++;
        else if (ln.status === 'Accepted') grouped[key].accepted++;
        else if (ln.status === 'Rejected') grouped[key].rejected++;
      });

      const composed: LinkRow[] = (links || []).map((l: any) => ({
        id: l.id,
        link_id: l.link_id,
        created_at: l.created_at,
        is_active: l.is_active,
        opens_count: l.opens_count,
        submissions_count: l.submissions_count,
        pending_count: grouped[l.id]?.pending || 0,
        accepted_count: grouped[l.id]?.accepted || 0,
        rejected_count: grouped[l.id]?.rejected || 0,
      }));
      setRows(composed);
    } catch (e) {
      // Keep empty state on failure
    } finally {
      setLoadingRows(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'manage') fetchRows();
  }, [activeTab]);

  // Realtime updates: update when links or related loans change
  useEffect(() => {
    if (activeTab !== 'manage' || !profile) return;
    const linkCh = supabase
      .channel(`share-links-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loan_share_links', filter: `created_by=eq.${profile.id}` }, () => {
        fetchRows();
      })
      .subscribe();

    const loanCh = supabase
      .channel('share-links-loans')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loans' }, (payload) => {
        const newId = (payload.new as any)?.share_link_id as string | undefined;
        const oldId = (payload.old as any)?.share_link_id as string | undefined;
        if ((newId && linkIds.includes(newId)) || (oldId && linkIds.includes(oldId))) {
          fetchRows();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(linkCh);
      supabase.removeChannel(loanCh);
    };
  }, [activeTab, profile, linkIds.join(',')]);

  const toggleActive = async (r: LinkRow) => {
    const { error } = await supabase
      .from('loan_share_links')
      .update({ is_active: !r.is_active })
      .eq('link_id', r.link_id);
    if (!error) fetchRows();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <LinkIcon className="w-5 h-5" /> Share Loan Application Link
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="px-6 pt-4 flex gap-2">
          <button onClick={() => setActiveTab('generate')} className={`px-3 py-2 rounded-lg text-sm ${activeTab==='generate' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>Generate</button>
          <button onClick={() => setActiveTab('manage')} className={`px-3 py-2 rounded-lg text-sm ${activeTab==='manage' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>Manage</button>
        </div>

        {activeTab === 'generate' && (
          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Generate a unique public link that opens the Apply Loan form without login. Submissions will appear under your account.
            </p>

            {!linkUrl ? (
              <button
                onClick={generate}
                disabled={generating || !profile}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {generating && <Loader2 className="w-4 h-4 animate-spin" />} Generate Link
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                    value={linkUrl}
                    readOnly
                  />
                  <button onClick={copy} className="px-3 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600">
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                {copied && <p className="text-green-600 text-sm">Copied!</p>}
              </div>
            )}

            {error && <p className="text-red-600 text-sm">{error}</p>}
          </div>
        )}

        {activeTab === 'manage' && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600 dark:text-gray-300">Your share links and performance.</p>
              <button onClick={fetchRows} className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600">
                <RefreshCw className={`w-4 h-4 ${loadingRows ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="max-h-80 overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                  <tr>
                    <th className="text-left px-3 py-2">Link</th>
                    <th className="text-left px-3 py-2">Opens</th>
                    <th className="text-left px-3 py-2">Submissions</th>
                    <th className="text-left px-3 py-2">Pending</th>
                    <th className="text-left px-3 py-2">Accepted</th>
                    <th className="text-left px-3 py-2">Rejected</th>
                    <th className="text-left px-3 py-2">Active</th>
                    <th className="text-left px-3 py-2">Copy</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const url = `${window.location.origin}/apply-loan/${r.link_id}`;
                    return (
                      <tr key={r.id} className="border-t border-gray-200 dark:border-gray-700">
                        <td className="px-3 py-2">
                          <div className="max-w-[260px] truncate" title={url}>{url}</div>
                          <div className="text-xs text-gray-500">{new Date(r.created_at).toLocaleString()}</div>
                        </td>
                        <td className="px-3 py-2">{r.opens_count}</td>
                        <td className="px-3 py-2">{r.submissions_count}</td>
                        <td className="px-3 py-2">{r.pending_count}</td>
                        <td className="px-3 py-2">{r.accepted_count}</td>
                        <td className="px-3 py-2">{r.rejected_count}</td>
                        <td className="px-3 py-2">
                          <button onClick={() => toggleActive(r)} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-100 dark:bg-gray-700">
                            {r.is_active ? <ToggleRight className="w-4 h-4 text-green-600" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                            <span className="text-xs">{r.is_active ? 'Active' : 'Inactive'}</span>
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          <button onClick={() => navigator.clipboard.writeText(url)} className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700">
                            <Copy className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && !loadingRows && (
                    <tr>
                      <td className="px-3 py-6 text-center text-gray-500" colSpan={8}>No links yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
