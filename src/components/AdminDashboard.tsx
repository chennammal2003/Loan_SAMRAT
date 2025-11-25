import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Shield, LogOut, Moon, Sun, List, CheckCircle, Users, HandCoins, TrendingUp, Package, FileText, Settings as SettingsIcon, Building2 } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import ManageLoans from './ManageLoans';
import AcceptedLoans from './AcceptedLoans';
import DisbursedLoans from './DisbursedLoans';
import MerchantDetails from './MerchantDetails';
import DashboardStats from './DashboardStats';
import PaymentTracker from './paymentTracker';
import ProductsAdmin from './admin/ProductsAdmin';
import AdminProductLoans from './AdminProductLoans';
import Settings from './Settings';
import AdminNotificationsPanel from './AdminNotificationsPanel';
import AdminActiveTieUps from './AdminActiveTieUps';
import NbfcMerchantsView from './NbfcMerchantsView';
import NbfcPaymentTracker from './NbfcPaymentTracker';

type ActiveTab = 'home' | 'manage' | 'accepted' | 'disbursed' | 'payments' | 'merchants' | 'products' | 'productLoans' | 'settings' | 'nbfcMerchants' | 'nbfcPayments';

export default function AdminDashboard() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [manageInitialFilter, setManageInitialFilter] = useState<'All' | 'Pending' | 'Accepted' | 'Rejected'>('All');
  const [showProfileModal, setShowProfileModal] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/signin');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-gray-50 dark:bg-gray-900 flex">
      <aside className="w-64 bg-white dark:bg-gray-800 shadow-lg flex flex-col h-full overflow-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white">Loan Portal</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Admin</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setActiveTab('home')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'home'
                ? 'bg-orange-600 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <Shield className="w-5 h-5" />
            <span>Dashboard</span>
          </button>

          

          <button
            onClick={() => setActiveTab('products')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'products'
                ? 'bg-orange-600 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <Package className="w-5 h-5" />
            <span>Products</span>
          </button>

          <button
            onClick={() => setActiveTab('productLoans')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'productLoans'
                ? 'bg-orange-600 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <FileText className="w-5 h-5" />
            <span>Product Loans</span>
          </button>

          <button
            onClick={() => { setManageInitialFilter('All'); setActiveTab('manage'); }}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'manage'
                ? 'bg-orange-600 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <List className="w-5 h-5" />
            <span>Manage Loans</span>
          </button>

          <button
            onClick={() => setActiveTab('accepted')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'accepted'
                ? 'bg-orange-600 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <CheckCircle className="w-5 h-5" />
            <span>Accepted Loans</span>
          </button>

          <button
            onClick={() => setActiveTab('disbursed')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'disbursed'
                ? 'bg-orange-600 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <HandCoins className="w-5 h-5" />
            <span>Disbursed Loans</span>
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'payments'
                ? 'bg-orange-600 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <TrendingUp className="w-5 h-5" />
            <span>Payment Tracker</span>
          </button>

          <button
            onClick={() => setActiveTab('merchants')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'merchants'
                ? 'bg-orange-600 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <Users className="w-5 h-5" />
            <span>Merchant Details</span>
          </button>

          {profile?.role === 'nbfc_admin' && (
            <>
              <div className="px-4 py-2 mt-4 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">NBFC Management</div>
              <button
                onClick={() => setActiveTab('nbfcMerchants')}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === 'nbfcMerchants'
                    ? 'bg-orange-600 text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Building2 className="w-5 h-5" />
                <span>Tied Merchants</span>
              </button>
              <button
                onClick={() => setActiveTab('nbfcPayments')}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === 'nbfcPayments'
                    ? 'bg-orange-600 text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <TrendingUp className="w-5 h-5" />
                <span>Tied Loans</span>
              </button>
            </>
          )}

          <button
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'settings'
                ? 'bg-orange-600 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <SettingsIcon className="w-5 h-5" />
            <span>Settings</span>
          </button>
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="mb-4">
            <div className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{profile?.username}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{profile?.email}</p>
            </div>
            <button
              onClick={() => setShowProfileModal(true)}
              className="mt-3 w-full px-4 py-2 text-sm rounded-lg bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-100"
            >
              My Profile
            </button>
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
              {activeTab === 'products' && 'Products'}
              {activeTab === 'productLoans' && 'Product Loans'}
              {activeTab === 'manage' && 'Manage Loans'}
              {activeTab === 'accepted' && 'Accepted Loans'}
              {activeTab === 'disbursed' && 'Disbursed Loans'}
              {activeTab === 'payments' && 'Payment Tracker'}
              {activeTab === 'merchants' && 'Merchants'}
              {activeTab === 'nbfcMerchants' && 'Tied-Up Merchants'}
              {activeTab === 'nbfcPayments' && 'Tied Loans Payment Tracker'}
              {activeTab === 'settings' && 'Settings'}
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
            <div className="space-y-6">
              <AdminNotificationsPanel />
              <AdminActiveTieUps />
              <DashboardStats
                onSelectStatus={(status) => {
                  setManageInitialFilter(status);
                  setActiveTab('manage');
                }}
              />
            </div>
          )}
          {activeTab === 'products' && <ProductsAdmin />}
          {activeTab === 'productLoans' && <AdminProductLoans />}
          {activeTab === 'manage' && <ManageLoans initialStatusFilter={manageInitialFilter} />}
          {activeTab === 'accepted' && <AcceptedLoans />}
          {activeTab === 'disbursed' && <DisbursedLoans />}
          {activeTab === 'payments' && <PaymentTracker />}
          {activeTab === 'merchants' && <MerchantDetails />}
          {activeTab === 'nbfcMerchants' && <NbfcMerchantsView />}
          {activeTab === 'nbfcPayments' && <NbfcPaymentTracker />}
          {activeTab === 'settings' && <Settings role="admin" />}
        </div>
      </main>

      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowProfileModal(false)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">My Profile</h3>
              
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-500 dark:text-gray-400">Username</p>
                <p className="font-medium text-gray-900 dark:text-white">{profile?.username || '-'}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Email</p>
                <p className="font-medium text-gray-900 dark:text-white">{profile?.email || '-'}</p>
              </div>
            </div>
            <div className="mt-5 text-right">
              <button onClick={() => setShowProfileModal(false)} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}