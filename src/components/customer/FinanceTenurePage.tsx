import { useLocation, useNavigate } from 'react-router-dom';

export default function FinanceTenurePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const price = (location.state as any)?.price as number | undefined;

  const amount = typeof price === 'number' ? price : (location.state as any)?.subtotal ?? 0;
  const rates = 0.12; // 12% p.a. example
  const options = [6, 12, 18, 24, 30, 36];

  const calcEmi = (months: number) => {
    const r = rates / 12;
    const P = amount;
    if (!P || !months) return 0;
    const pow = Math.pow(1 + r, months);
    return Math.round((P * r * pow) / (pow - 1));
  };

  return (
    <div className="max-w-xl mx-auto p-6">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow p-6">
        <h1 className="text-xl font-bold mb-1">Select Tenure</h1>
        <p className="text-sm text-gray-500 mb-4">Choose your preferred tenure</p>
        <div className="text-sm text-gray-600 mb-4">Product Price: ₹{amount.toLocaleString('en-IN')} · Interest: 12% p.a.</div>
        <div className="space-y-3">
          {options.map(m => (
            <button key={m} className="w-full text-left px-4 py-3 rounded-lg bg-amber-100 hover:bg-amber-200" onClick={() => navigate('/customer/loan-apply', { state: { tenure: m, emi: calcEmi(m), amount } })}>
              <div className="flex items-center justify-between">
                <div className="font-semibold">{m} Months</div>
                <div className="text-right">
                  <div className="text-sm">EMI: ₹{calcEmi(m).toLocaleString('en-IN')}</div>
                  <div className="text-xs text-gray-600">Total: ₹{(calcEmi(m) * m).toLocaleString('en-IN')}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
