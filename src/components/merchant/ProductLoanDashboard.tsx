import { useState } from 'react';
import ProductLoanStatusTracker from './ProductLoanStatusTracker';
import { FileText, TrendingUp } from 'lucide-react';

const sampleLoans = [
  {
    id: '1',
    first_name: 'Rajesh',
    last_name: 'Kumar',
    product_name: '22K Gold Chain - 20g',
    loan_amount: 85000,
    status: 'Product Delivered' as const,
    accepted_at: '2025-01-15T10:30:00Z',
    verified_at: '2025-01-16T14:20:00Z',
    disbursed_at: '2025-01-18T11:00:00Z',
    delivered_at: '2025-01-20T16:45:00Z',
    created_at: '2025-01-14T09:00:00Z',
  },
  {
    id: '2',
    first_name: 'Priya',
    last_name: 'Sharma',
    product_name: 'Diamond Ring - 1.5 Carat',
    loan_amount: 125000,
    status: 'Loan Disbursed' as const,
    accepted_at: '2025-01-18T09:15:00Z',
    verified_at: '2025-01-19T15:30:00Z',
    disbursed_at: '2025-01-22T10:00:00Z',
    delivered_at: null,
    created_at: '2025-01-17T11:20:00Z',
  },
  {
    id: '3',
    first_name: 'Amit',
    last_name: 'Patel',
    product_name: 'Gold Bangles Set - 50g',
    loan_amount: 210000,
    status: 'Verified' as const,
    accepted_at: '2025-01-20T08:45:00Z',
    verified_at: '2025-01-21T16:00:00Z',
    disbursed_at: null,
    delivered_at: null,
    created_at: '2025-01-19T10:30:00Z',
  },
  {
    id: '4',
    first_name: 'Sneha',
    last_name: 'Reddy',
    product_name: 'Platinum Necklace',
    loan_amount: 95000,
    status: 'Accepted' as const,
    accepted_at: '2025-01-23T14:20:00Z',
    verified_at: null,
    disbursed_at: null,
    delivered_at: null,
    created_at: '2025-01-22T09:00:00Z',
  },
  {
    id: '5',
    first_name: 'Vikram',
    last_name: 'Singh',
    product_name: 'Gold Earrings - 12g',
    loan_amount: 52000,
    status: 'Pending' as const,
    accepted_at: null,
    verified_at: null,
    disbursed_at: null,
    delivered_at: null,
    created_at: '2025-01-24T11:15:00Z',
  },
  {
    id: '6',
    first_name: 'Meera',
    last_name: 'Iyer',
    product_name: 'Silver Anklets',
    loan_amount: 18000,
    status: 'Rejected' as const,
    accepted_at: null,
    verified_at: null,
    disbursed_at: null,
    delivered_at: null,
    created_at: '2025-01-20T13:00:00Z',
  },
];

export default function ProductLoanDashboard() {
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredLoans = filterStatus === 'all'
    ? sampleLoans
    : sampleLoans.filter(loan => loan.status === filterStatus);

  const stats = {
    total: sampleLoans.length,
    pending: sampleLoans.filter(l => l.status === 'Pending').length,
    accepted: sampleLoans.filter(l => l.status === 'Accepted').length,
    verified: sampleLoans.filter(l => l.status === 'Verified').length,
    disbursed: sampleLoans.filter(l => l.status === 'Loan Disbursed').length,
    delivered: sampleLoans.filter(l => l.status === 'Product Delivered').length,
    rejected: sampleLoans.filter(l => l.status === 'Rejected').length,
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-600" />
            Product Loan Status Tracker
          </h1>
          <p className="mt-2 text-gray-600">
            Track your product loan applications through every stage
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Applications</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-gray-400" />
            </div>
          </div>

          <div className="bg-yellow-50 rounded-lg shadow-sm border border-yellow-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-700">Pending</p>
                <p className="text-2xl font-bold text-yellow-900 mt-1">{stats.pending}</p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 rounded-lg shadow-sm border border-green-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700">Delivered</p>
                <p className="text-2xl font-bold text-green-900 mt-1">{stats.delivered}</p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg shadow-sm border border-blue-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700">In Progress</p>
                <p className="text-2xl font-bold text-blue-900 mt-1">
                  {stats.accepted + stats.verified + stats.disbursed}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              All ({stats.total})
            </button>
            <button
              onClick={() => setFilterStatus('Pending')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === 'Pending'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Pending ({stats.pending})
            </button>
            <button
              onClick={() => setFilterStatus('Accepted')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === 'Accepted'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Accepted ({stats.accepted})
            </button>
            <button
              onClick={() => setFilterStatus('Verified')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === 'Verified'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Verified ({stats.verified})
            </button>
            <button
              onClick={() => setFilterStatus('Loan Disbursed')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === 'Loan Disbursed'
                  ? 'bg-teal-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Disbursed ({stats.disbursed})
            </button>
            <button
              onClick={() => setFilterStatus('Product Delivered')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === 'Product Delivered'
                  ? 'bg-green-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Delivered ({stats.delivered})
            </button>
            <button
              onClick={() => setFilterStatus('Rejected')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === 'Rejected'
                  ? 'bg-red-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Rejected ({stats.rejected})
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredLoans.map((loan) => (
            <ProductLoanStatusTracker key={loan.id} loan={loan} />
          ))}
        </div>

        {filteredLoans.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No loans found with the selected status</p>
          </div>
        )}
      </div>
    </div>
  );
}
