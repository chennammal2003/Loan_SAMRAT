import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FileText, LogOut, Moon, Sun, Plus, List, Package, User, HandCoins, Share2, CreditCard, TrendingUp } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import ApplyLoanModal from './ApplyLoanModal';
import ShareLinkModal from './ShareLinkModal.tsx';
import LoanDetails from './LoanDetails';
import MerchantDisbursedLoans from './MerchantDisbursedLoans';
import ProductDescription from './ProductDescription';
import MerchantProfilePanel from './MerchantProfilePanel';
import DashboardStats from './DashboardStats';
import MerchantProfileGate from './MerchantProfileGate';
import Payment from './payment';
import MerchantPaymentTracker from './MerchantPaymentTracker';

type ActiveTab = 'home' | 'apply' | 'loans' | 'disbursed' | 'payment' | 'paymentTracker' | 'products';

export default function MerchantDashboard() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showProfilePanel, setShowProfilePanel] = useState(false);
  const [loanInitialFilter, setLoanInitialFilter] = useState<'All' | 'Pending' | 'Accepted' | 'Rejected'>('All');
  const [showProfileSetup, setShowProfileSetup] = useState(true);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/signin');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleApplyLoan = () => {
    setShowApplyModal(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      <aside className="w-64 bg-white dark:bg-gray-800 shadow-lg sticky top-0 h-screen flex flex-col overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white">Loan Portal</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Merchant</p>
            </div>
          </div>
        </div>

        <nav className="p-4 space-y-2">
          <button
            onClick={() => setActiveTab('home')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'home'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <FileText className="w-5 h-5" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={handleApplyLoan}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Apply Loan</span>
          </button>

          <button
            onClick={() => setShowShareModal(true)}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <Share2 className="w-5 h-5" />
            <span>Share Apply Link</span>
          </button>

          <button
            onClick={() => { setLoanInitialFilter('All'); setActiveTab('loans'); }}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'loans'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <List className="w-5 h-5" />
            <span>Loan Details</span>
          </button>

          <button
            onClick={() => setActiveTab('disbursed')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'disbursed'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <HandCoins className="w-5 h-5" />
            <span>Disbursed Loans</span>
          </button>

          <button
            onClick={() => setActiveTab('paymentTracker')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'paymentTracker'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <TrendingUp className="w-5 h-5" />
            <span>Payment Tracker</span>
          </button>

          <button
            onClick={() => setActiveTab('payment')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'payment'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <CreditCard className="w-5 h-5" />
            <span>Payment Details</span>
          </button>

          <button
            onClick={() => setActiveTab('products')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'products'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <Package className="w-5 h-5" />
            <span>Product Description</span>
          </button>

          {/* New: Profile item opens slide-over panel */}
          <button
            onClick={() => setShowProfilePanel(true)}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
              showProfilePanel
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <User className="w-5 h-5" />
            <span>My Profile</span>
          </button>
        </nav>

        <div className="mt-auto w-64 p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="mb-4">
            <div className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{profile?.username}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{profile?.email}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <header className="bg-white dark:bg-gray-800 shadow-sm">
          <div className="px-8 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {activeTab === 'home' && 'Dashboard'}
              {activeTab === 'loans' && 'My Loan Applications'}
              {activeTab === 'disbursed' && 'My Disbursed Loans'}
              {activeTab === 'payment' && 'Payment Entry'}
              {activeTab === 'paymentTracker' && 'My Payment Tracker'}
              {activeTab === 'products' && 'Product Information'}
            </h1>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5 text-yellow-400" />}
            </button>
          </div>
        </header>

        <div className="p-8">
          {activeTab === 'home' && (
            <DashboardStats
              onSelectStatus={(status) => {
                setLoanInitialFilter(status);
                setActiveTab('loans');
              }}
            />
          )}
          {activeTab === 'loans' && <LoanDetails initialStatusFilter={loanInitialFilter} />}
          {activeTab === 'disbursed' && <MerchantDisbursedLoans />}
          {activeTab === 'payment' && (
            <div className="space-y-6">
              <Payment />
            </div>
          )}
          {activeTab === 'paymentTracker' && (
            <div className="space-y-6">
              <MerchantPaymentTracker />
            </div>
          )}
          {activeTab === 'products' && (
            <div className="space-y-6">
              <ProductDescription />
            </div>
          )}
        </div>
      </main>

      {showApplyModal && (
        <ApplyLoanModal
          onClose={() => setShowApplyModal(false)}
          onSuccess={() => {
            setShowApplyModal(false);
            setLoanInitialFilter('All');
            setActiveTab('loans');
          }}
        />
      )}

      {showShareModal && (
        <ShareLinkModal onClose={() => setShowShareModal(false)} />
      )}

      {/* Slide-over Profile Panel opens on the opposite side (right) */}
      <MerchantProfilePanel open={showProfilePanel} onClose={() => setShowProfilePanel(false)} />

      {/* First-time merchant profile setup gate (auto-skips if already completed) */}
      {showProfileSetup && (
        <MerchantProfileGate onDone={() => setShowProfileSetup(false)} />
      )}
    </div>
  );
}
