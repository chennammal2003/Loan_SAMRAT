import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type Row = { id: string; email: string | null; role: string | null; created_at?: string | null };

export default function UsersAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase.from('profiles').select('id,email,role,created_at').order('created_at', { ascending: false });
        if (error) throw error;
        setRows((data as any[]) as Row[]);
      } catch (e: any) {
        setError(e?.message || 'Failed to load users');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow p-6">
        <h1 className="text-2xl font-bold mb-4">Users</h1>
        {loading ? (
          <div>Loading…</div>
        ) : error ? (
          <div className="text-red-600">{error}</div>
        ) : (
          <div className="overflow-auto border rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="text-left px-3 py-2">Email</th>
                  <th className="text-left px-3 py-2">Role</th>
                  <th className="text-left px-3 py-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2">{r.email}</td>
                    <td className="px-3 py-2">{r.role}</td>
                    <td className="px-3 py-2">{r.created_at ? new Date(r.created_at).toLocaleString() : '-'}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={3}>No users</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
