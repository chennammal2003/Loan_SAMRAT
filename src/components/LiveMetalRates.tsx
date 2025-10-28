import { useEffect, useState } from 'react';
import { fetchMetalRates, type MetalRates } from '../lib/metals';

export default function LiveMetalRates() {
  const [rates, setRates] = useState<MetalRates | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const load = async () => {
      try {
        const data = await fetchMetalRates(ctrl.signal);
        setRates(data);
        setError(null);
      } catch (e: any) {
        setError(e?.message || 'Failed to load metal rates');
      }
    };
    load();
    const id = setInterval(load, 60_000); // refresh every 60s
    return () => {
      ctrl.abort();
      clearInterval(id);
    };
  }, []);

  if (error) {
    return (
      <div className="text-xs text-red-600 dark:text-red-400">{error}</div>
    );
  }

  if (!rates) {
    return (
      <div className="text-xs text-gray-500 dark:text-gray-400">Loading metal rates…</div>
    );
  }

  const g24 = rates.perGram.gold24k;
  const g22 = rates.perGram.gold22k;
  const ag = rates.perGram.silver;
  const g20 = g24 * (20 / 24);
  const g18 = g24 * (18 / 24);

  return (
    <div className="flex items-center gap-4 text-sm">
      <div className="px-2 py-1 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800" title={`Per 10g: ₹${(g24*10).toFixed(2)}`}>
        24K: ₹{g24.toFixed(2)}/g
      </div>
      <div className="px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800" title={`Per 10g: ₹${(g22*10).toFixed(2)}`}>
        22K: ₹{g22.toFixed(2)}/g
      </div>
      <div className="px-2 py-1 rounded-lg bg-amber-50/60 dark:bg-amber-900/10 text-amber-700 dark:text-amber-300 border border-amber-200/70 dark:border-amber-800/50" title={`Per 10g: ₹${(g20*10).toFixed(2)}`}>
        20K: ₹{g20.toFixed(2)}/g
      </div>
      <div className="px-2 py-1 rounded-lg bg-amber-50/40 dark:bg-amber-900/5 text-amber-700 dark:text-amber-300 border border-amber-200/50 dark:border-amber-800/30" title={`Per 10g: ₹${(g18*10).toFixed(2)}`}>
        18K: ₹{g18.toFixed(2)}/g
      </div>
      <div className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-gray-700 text-slate-800 dark:text-gray-200 border border-slate-200 dark:border-gray-600">
        Silver: ₹{ag.toFixed(2)}/g
      </div>
    </div>
  );
}
