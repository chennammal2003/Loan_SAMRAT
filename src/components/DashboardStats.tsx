import React, { useEffect, useState } from 'react';
import { FileText, CheckCircle, Clock, XCircle } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { supabase, LoanApplication } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface DashboardStatsProps {
  onSelectStatus?: (status: 'All' | 'Accepted' | 'Pending' | 'Rejected') => void;
}

export default function DashboardStats({ onSelectStatus }: DashboardStatsProps) {
  const { profile } = useAuth();
  const [loans, setLoans] = useState<LoanApplication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      fetchLoans();
    }
  }, [profile]);

  const fetchLoans = async () => {
    if (!profile) return;

    try {
      let query = supabase.from('loans').select('*');

      if (profile.role === 'merchant') {
        query = query.eq('user_id', profile.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLoans(data || []);
    } catch (error) {
      console.error('Error fetching loans:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalLoans = loans.length;
  const acceptedLoans = loans.filter(l => l.status === 'Accepted').length;
  const pendingLoans = loans.filter(l => l.status === 'Pending').length;
  const rejectedLoans = loans.filter(l => l.status === 'Rejected').length;

  const pieData = [
    { name: 'Accepted', value: acceptedLoans, color: '#34d399' }, // green-400 (lighter)
    { name: 'Pending', value: pendingLoans, color: '#fbbf24' },   // yellow-400 (lighter)
    { name: 'Rejected', value: rejectedLoans, color: '#f87171' }, // red-400 (lighter)
  ];
  // Avoid label overlap by not rendering zero-value slices
  const pieDataFiltered = pieData.filter(d => d.value > 0);

  const monthlyData = React.useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();

    const monthlyCounts = months.map((month, index) => {
      const count = loans.filter(loan => {
        const loanDate = new Date(loan.created_at);
        return loanDate.getMonth() === index && loanDate.getFullYear() === currentYear;
      }).length;

      return {
        month,
        loans: count,
      };
    });

    return monthlyCounts;
  }, [loans]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <button
          onClick={() => onSelectStatus?.('All')}
          className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg text-left hover:ring-2 ring-blue-200"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-sm">Total Loans</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{totalLoans}</p>
        </button>

        <button
          onClick={() => onSelectStatus?.('Accepted')}
          className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg text-left hover:ring-2 ring-green-200"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-sm">Accepted</p>
          <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">{acceptedLoans}</p>
        </button>

        <button
          onClick={() => onSelectStatus?.('Pending')}
          className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg text-left hover:ring-2 ring-yellow-200"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-sm">Pending</p>
          <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400 mt-2">{pendingLoans}</p>
        </button>

        <button
          onClick={() => onSelectStatus?.('Rejected')}
          className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg text-left hover:ring-2 ring-red-200"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
              <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-sm">Rejected</p>
          <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-2">{rejectedLoans}</p>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Loan Status Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieDataFiltered}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.name}: ${entry.value}`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {pieDataFiltered.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Monthly Loan Applications</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="loans" fill="#60a5fa" name="Loan Applications" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {loans.length === 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6 text-center">
          <FileText className="w-16 h-16 mx-auto mb-4 text-blue-600 dark:text-blue-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Data Available</h3>
          <p className="text-gray-600 dark:text-gray-400">
            {profile?.role === 'merchant'
              ? "Start by applying for your first loan!"
              : "No loan applications have been submitted yet."}
          </p>
        </div>
      )}
    </div>
  );
}
