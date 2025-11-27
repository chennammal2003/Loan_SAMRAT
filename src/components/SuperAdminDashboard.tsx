import { useEffect, useMemo, useState } from 'react';
import { LogOut, Moon, Sun, Users, Shield, FileText, CheckCircle, AlertTriangle, HandCoins, Bell } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { StatCard } from './StatCard';
import { FilterBar } from './FilterBar';
import { UserTable } from './UserTable';
import { UserDetailsModal } from './UserDetailsModal';
import NotificationsPanel from './NotificationsPanel';
import type { UserType, UserProfile } from '../types';

type SuperAdminTab = 'users' | 'loans' | 'notifications';

interface DashboardStats {
  all: number;
  nbfc: number;
  merchants: number;
  customers: number;
}

interface LoanStats {
  total: number;
  pending: number;
  accepted: number;
  verified: number;
  disbursed: number;
  rejected: number;
}

interface LoanRow {
  id: string;
  application_number: string | null;
  first_name: string;
  last_name: string;
  loan_amount: number;
  status: string;
  verification_status: string | null;
  created_at: string;
  merchant_id: string | null;
  amount_disbursed: number | null;
}

interface ProductLoanRow {
  id: string;
  application_number?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  status?: string | null;
  created_at: string;
  loan_amount?: number | null;
  total_amount?: number | null;
  product_name?: string | null;
}

interface MerchantProfile {
  merchant_id: string;
  business_name?: string;
  owner_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  age?: number | null;
  business_type?: string;
  business_category?: string;
  gst_number?: string;
  pan_number?: string;
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
  upi_id?: string | null;
}

interface NBFCProfile {
  nbfc_id: string;
  name: string;
  interest_rate: number;
  default_tenure: number | null;
  processing_fee: number;
  approval_type: string;
  notes?: string | null;
  min_loan_amount?: number | null;
  max_loan_amount?: number | null;
  processing_fee_percent?: number | null;
  gst_applicable?: boolean;
  tenure_options?: any;
  loan_types?: any;
  cin_number?: string | null;
  rbi_license_number?: string | null;
  contact_number?: string | null;
  official_email?: string | null;
}

export default function SuperAdminDashboard() {
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<SuperAdminTab>('users');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<UserType>('all');
  const [stats, setStats] = useState<DashboardStats>({ all: 0, nbfc: 0, merchants: 0, customers: 0 });
  const [loanStats, setLoanStats] = useState<LoanStats>({
    total: 0,
    pending: 0,
    accepted: 0,
    verified: 0,
    disbursed: 0,
    rejected: 0,
  });

  const [loanRows, setLoanRows] = useState<LoanRow[]>([]);
  const [loanLoading, setLoanLoading] = useState(true);
  const [loanError, setLoanError] = useState<string | null>(null);

  const [productLoanStats, setProductLoanStats] = useState<LoanStats>({
    total: 0,
    pending: 0,
    accepted: 0,
    verified: 0,
    disbursed: 0,
    rejected: 0,
  });

  const [productLoanRows, setProductLoanRows] = useState<ProductLoanRow[]>([]);
  const [productLoanLoading, setProductLoanLoading] = useState(true);
  const [productLoanError, setProductLoanError] = useState<string | null>(null);

  const [loanViewType, setLoanViewType] = useState<'general' | 'product'>('general');

  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<MerchantProfile | NBFCProfile | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [showPendingDropdown, setShowPendingDropdown] = useState(false);

  const pendingApprovals = useMemo(() => {
    const pendingMerchants = users.filter(
      (u) => u.role === 'merchant' && u.is_active === false
    ).length;
    const pendingNbfc = users.filter(
      (u) => (u.role === 'nbfc_admin' || u.role === 'admin') && u.is_active === false
    ).length;
    return {
      merchants: pendingMerchants,
      nbfc: pendingNbfc,
      total: pendingMerchants + pendingNbfc,
    };
  }, [users]);

  const pendingUsersList = useMemo(
    () =>
      users.filter(
        (u) =>
          u.is_active === false &&
          (u.role === 'merchant' || u.role === 'nbfc_admin' || u.role === 'admin')
      ),
    [users]
  );

  useEffect(() => {
    fetchUsers();
    fetchLoans();
    fetchProductLoans();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (err) throw err;
      const list = (data || []) as UserProfile[];
      setUsers(list);

      const all = list.length;
      // Treat both classic nbfc_admin and admin as NBFC-related for Super Admin stats
      const nbfc = list.filter((u) => u.role === 'nbfc_admin' || u.role === 'admin').length;
      const merchants = list.filter((u) => u.role === 'merchant').length;
      // Treat both 'customer' and 'user' as customers in Super Admin stats
      const customers = list.filter((u) => u.role === 'customer' || u.role === 'user').length;
      setStats({ all, nbfc, merchants, customers });
    } catch (e: any) {
      setError(e?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const fetchLoans = async () => {
    setLoanLoading(true);
    setLoanError(null);
    try {
      const { data, error } = await supabase
        .from('loans')
        .select('id, application_number, first_name, last_name, loan_amount, status, verification_status, created_at, merchant_id, amount_disbursed');
      if (error) throw error;

      const rows = (data || []) as LoanRow[];
      setLoanRows(rows);
      const total = rows.length;
      const pending = rows.filter((r) => r.status === 'Pending').length;
      const accepted = rows.filter((r) => r.status === 'Accepted').length;
      const verified = rows.filter((r) => r.status === 'Verified').length;
      const disbursed = rows.filter((r) => r.status === 'Loan Disbursed').length;
      const rejected = rows.filter((r) => r.status === 'Rejected').length;

      setLoanStats({ total, pending, accepted, verified, disbursed, rejected });
    } catch (e) {
      console.error('Failed to load loan stats', e);
      setLoanError((e as any)?.message || 'Failed to load loan details');
    } finally {
      setLoanLoading(false);
    }
  };

  const fetchProductLoans = async () => {
    setProductLoanLoading(true);
    setProductLoanError(null);
    try {
      // STEP 1: Get all NBFC tie-ups to identify tied merchants
      const { data: tieupData, error: tieupError } = await supabase
        .from('nbfc_tieups')
        .select('merchant_id');

      if (tieupError) throw tieupError;

      // Extract unique merchant IDs that have NBFC tie-ups
      const tiedMerchantIds = Array.from(
        new Set((tieupData || []).map((t: any) => t.merchant_id))
      );

      // STEP 2: Fetch product loans ONLY for tied merchants
      if (tiedMerchantIds.length === 0) {
        // No tied merchants, show empty list
        setProductLoanRows([]);
        setProductLoanStats({
          total: 0,
          pending: 0,
          accepted: 0,
          verified: 0,
          disbursed: 0,
          rejected: 0,
        });
      } else {
        const { data, error } = await supabase
          .from('product_loans')
          .select('*')
          .in('merchant_id', tiedMerchantIds)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const rows = (data || []) as any[];
        const normalized: ProductLoanRow[] = rows.map((row) => ({
          id: row.id,
          application_number: row.application_number ?? null,
          first_name: row.first_name ?? null,
          last_name: row.last_name ?? null,
          status: row.status ?? null,
          created_at: row.created_at,
          loan_amount: row.loan_amount ?? null,
          total_amount: row.total_amount ?? null,
          product_name: row.product_name ?? null,
        }));

        setProductLoanRows(normalized);

        const total = normalized.length;
        const pending = normalized.filter((r) => r.status === 'Pending').length;
        const accepted = normalized.filter((r) => r.status === 'Accepted').length;
        const verified = normalized.filter((r) => r.status === 'Verified').length;
        const disbursed = normalized.filter((r) => r.status === 'Loan Disbursed').length;
        const rejected = normalized.filter((r) => r.status === 'Rejected').length;

        setProductLoanStats({ total, pending, accepted, verified, disbursed, rejected });
      }
    } catch (e) {
      console.error('Failed to load product loan stats', e);
      setProductLoanError((e as any)?.message || 'Failed to load product loan details');
    } finally {
      setProductLoanLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    let result = users;

    if (selectedType !== 'all') {
      if (selectedType === 'nbfc_admin') {
        // Show both admin and nbfc_admin users when NBFC filter is active
        result = result.filter((u) => u.role === 'nbfc_admin' || u.role === 'admin');
      } else if (selectedType === 'customer') {
        // Customer bucket should include both 'customer' and 'user' roles
        result = result.filter((u) => u.role === 'customer' || u.role === 'user');
      } else {
        result = result.filter((u) => u.role === selectedType);
      }
    }

    const q = searchQuery.trim().toLowerCase();
    if (!q) return result;

    return result.filter((u) => {
      const haystack = [
        (u as any).full_name,
        u.username,
        u.email,
        (u as any).phone,
        (u as any).mobile,
        (u as any).address,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [users, selectedType, searchQuery]);

  const handleApproveUserFromNotification = async (userId: string, userType: 'merchant' | 'nbfc') => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('id', userId);
      if (error) throw error;

      // Update local state so UI shows Approved immediately
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, is_active: true } : u)));
    } catch (e) {
      console.error('Failed to approve user from notification', e);
    }
  };

  const handleRejectUserFromNotification = async (userId: string, userType: 'merchant' | 'nbfc') => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', userId);
      if (error) throw error;

      // Update local state so UI shows Pending/Inactive immediately
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, is_active: false } : u)));
    } catch (e) {
      console.error('Failed to reject user from notification', e);
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
    try {
      // Prevent toggling customer status - customers must always be active
      const user = users.find((u) => u.id === userId);
      if (user?.role === 'customer') {
        console.warn('Cannot toggle status for customers - they must always remain active');
        return;
      }

      const { error: err } = await supabase
        .from('user_profiles')
        .update({ is_active: !currentStatus, updated_at: new Date().toISOString() })
        .eq('id', userId);
      if (err) throw err;
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, is_active: !currentStatus } : u)));
    } catch (e) {
      // Log only; you can add UI toast later if needed
      console.error('Failed to toggle status', e);
    }
  };

  const handleViewDetails = async (user: UserProfile) => {
    setSelectedDetails(null);

    // Try to enrich basic profile information using existing tables
    let enrichedUser: UserProfile = user;
    try {
      // 1) Default address (addresses table)
      const { data: addr } = await supabase
        .from('addresses')
        .select('line1, line2, city, state, pin_code, formatted_address, phone')
        .eq('user_id', user.id)
        .eq('is_default', true)
        .maybeSingle();

      if (addr) {
        const parts = [addr.formatted_address, addr.line1, addr.line2, addr.city, addr.state, addr.pin_code]
          .filter(Boolean)
          .map((p) => String(p).trim());
        const addressText = parts.join(', ');

        enrichedUser = {
          ...enrichedUser,
          // only override if empty in user_profiles
          address: (enrichedUser as any).address || addressText,
          phone: (enrichedUser as any).phone || (addr as any).phone || (enrichedUser as any).mobile,
        } as any;
      }

      // 2) If date_of_birth / mobile / phone / address are missing, try to infer from latest loan records
      if (
        !(enrichedUser as any).date_of_birth ||
        !(enrichedUser as any).mobile ||
        !(enrichedUser as any).phone ||
        !(enrichedUser as any).address
      ) {
        const { data: loan } = await supabase
          .from('loans')
          .select('date_of_birth, mobile_primary, phone, address, applicant_address, email, email_id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (loan) {
          enrichedUser = {
            ...enrichedUser,
            date_of_birth: (enrichedUser as any).date_of_birth || (loan as any).date_of_birth,
            mobile:
              (enrichedUser as any).mobile ||
              (loan as any).mobile_primary,
            phone:
              (enrichedUser as any).phone ||
              (loan as any).phone ||
              (loan as any).mobile_primary,
            address:
              (enrichedUser as any).address ||
              (loan as any).applicant_address ||
              (loan as any).address,
            // if somehow email is missing in user_profiles, try to hydrate from loans
            email:
              (enrichedUser as any).email ||
              (loan as any).email ||
              (loan as any).email_id,
          } as any;
        }
      }

      // 3) If still missing mobile, try product_loans
      if (
        !(enrichedUser as any).mobile ||
        !(enrichedUser as any).phone ||
        !(enrichedUser as any).address ||
        !(enrichedUser as any).date_of_birth
      ) {
        const { data: prodLoan } = await supabase
          .from('product_loans')
          .select('mobile_primary, address, date_of_birth, email_id')
          .eq('user_id', user.id as any)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (prodLoan) {
          enrichedUser = {
            ...enrichedUser,
            mobile: (enrichedUser as any).mobile || (prodLoan as any).mobile_primary,
            phone:
              (enrichedUser as any).phone ||
              (prodLoan as any).mobile_primary,
            address: (enrichedUser as any).address || (prodLoan as any).address,
            date_of_birth:
              (enrichedUser as any).date_of_birth ||
              (prodLoan as any).date_of_birth,
            email:
              (enrichedUser as any).email ||
              (prodLoan as any).email_id,
          } as any;
        }
      }
    } catch (e) {
      console.error('Failed to enrich user profile', e);
    }

    setSelectedUser(enrichedUser);

    if (user.role === 'merchant') {
      setDetailsLoading(true);
      try {
        const { data, error: err } = await supabase
          .from('merchant_profiles')
          .select('*')
          .eq('merchant_id', user.id)
          .maybeSingle();
        if (!err && data) {
          setSelectedDetails(data as MerchantProfile);
        }
      } catch (e) {
        console.error('Failed to load merchant profile', e);
      } finally {
        setDetailsLoading(false);
      }
    } else if (user.role === 'nbfc_admin' || user.role === 'admin') {
      setDetailsLoading(true);
      try {
        const { data, error: err } = await supabase
          .from('nbfc_profiles')
          .select('*')
          .eq('nbfc_id', user.id)
          .maybeSingle();
        if (!err && data) {
          setSelectedDetails(data as NBFCProfile);

          // Also hydrate base user profile with NBFC contact details when missing
          const enrichedFromNbfc = {
            ...enrichedUser,
            address:
              (enrichedUser as any).address ||
              (data as any).head_office_address ||
              (enrichedUser as any).address,
            phone:
              (enrichedUser as any).phone ||
              (data as any).contact_number ||
              (enrichedUser as any).mobile,
            email:
              (enrichedUser as any).email ||
              (data as any).official_email ||
              (enrichedUser as any).email,
          } as UserProfile;

          setSelectedUser(enrichedFromNbfc);
        }
      } catch (e) {
        console.error('Failed to load NBFC profile', e);
      } finally {
        setDetailsLoading(false);
      }
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/signin');
    } catch (e) {
      console.error('Error signing out', e);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      <aside className="w-72 bg-white dark:bg-gray-800 shadow-lg flex flex-col h-screen overflow-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white">Loan Portal</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Super Admin</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4">
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className={`w-full px-4 py-3 rounded-lg flex items-center space-x-3 text-sm font-medium transition-colors ${
                activeTab === 'users'
                  ? 'bg-gradient-to-r from-gray-900 to-gray-700 text-white'
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600'
              }`}
            >
              <Users className="w-5 h-5" />
              <span>User Management</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('loans')}
              className={`w-full px-4 py-3 rounded-lg flex items-center space-x-3 text-sm font-medium transition-colors ${
                activeTab === 'loans'
                  ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white'
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600'
              }`}
            >
              <FileText className="w-5 h-5" />
              <span>Loan Details</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('notifications')}
              className={`w-full px-4 py-3 rounded-lg flex items-center space-x-3 text-sm font-medium transition-colors ${
                activeTab === 'notifications'
                  ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white'
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600'
              }`}
            >
              <Bell className="w-5 h-5" />
              <span>Profile Notifications</span>
              {pendingApprovals.total > 0 && (
                <span className="inline-flex items-center justify-center rounded-full bg-red-600 text-white text-xs font-bold min-w-[1.25rem] px-1 py-0.5 ml-auto">
                  {pendingApprovals.total}
                </span>
              )}

          {activeTab === 'notifications' && (
            <NotificationsPanel
              onApproveUser={handleApproveUserFromNotification}
              onRejectUser={handleRejectUserFromNotification}
              onViewUserDetails={(userId) => {
                const u = users.find((usr) => usr.id === userId);
                if (u) {
                  handleViewDetails(u);
                }
              }}
            />
          )}
            </button>
          </div>
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
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

      <main className="flex-1 flex flex-col">
        <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-20">
          <div className="px-8 py-4 flex justify-between items-center relative">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Super Admin Dashboard</h1>
            <div className="flex items-center gap-4">
              {pendingApprovals.total > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setShowPendingDropdown((prev) => !prev);
                  }}
                  className="relative inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 border border-red-200 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300 dark:border-red-700"
                >
                  <Bell className="w-5 h-5" />
                  <span>Pending Approvals</span>
                  <span className="inline-flex items-center justify-center rounded-full bg-red-600 text-white text-xs font-bold min-w-[1.5rem] px-1 py-0.5">
                    {pendingApprovals.total}
                  </span>
                </button>
              )}
              {showPendingDropdown && pendingUsersList.length > 0 && (
                <div className="absolute right-8 top-14 z-30 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                  <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">Pending Users</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{pendingUsersList.length}</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {pendingUsersList.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setActiveTab('users');
                          if (u.role === 'merchant') {
                            setSelectedType('merchant');
                          } else {
                            setSelectedType('nbfc_admin');
                          }
                          setShowPendingDropdown(false);
                          handleViewDetails(u);
                        }}
                        className="w-full px-4 py-2 flex items-center justify-between text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                     >
                        <div>
                          <p className="font-medium text-gray-800 dark:text-gray-100">{u.username || u.email}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{u.email}</p>
                        </div>
                        <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 uppercase">
                          {u.role === 'merchant' ? 'MERCHANT' : 'NBFC ADMIN'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5 text-yellow-400" />}
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8 space-y-6">
          {activeTab === 'users' && (
            <>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              {/* User stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                  title="Total Users"
                  value={stats.all}
                  icon={Users}
                  gradient="from-slate-700 via-slate-600 to-slate-800"
                  iconBg="bg-white/15"
                />
                <StatCard
                  title="NBFC Admins"
                  value={stats.nbfc}
                  icon={Shield}
                  gradient="from-purple-600 via-purple-500 to-purple-700"
                  iconBg="bg-white/15"
                />
                <StatCard
                  title="Merchants"
                  value={stats.merchants}
                  icon={Users}
                  gradient="from-blue-600 via-blue-500 to-blue-700"
                  iconBg="bg-white/15"
                />
                <StatCard
                  title="Customers"
                  value={stats.customers}
                  icon={Users}
                  gradient="from-emerald-600 via-emerald-500 to-emerald-700"
                  iconBg="bg-white/15"
                />
              </div>

              {/* Search and filters */}
              <FilterBar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                selectedType={selectedType}
                onTypeChange={setSelectedType}
                stats={{
                  all: stats.all,
                  nbfc: stats.nbfc,
                  merchants: stats.merchants,
                  customers: stats.customers,
                }}
              />

              {/* User table */}
              <div className="mt-4 max-h-[calc(100vh-320px)] overflow-auto rounded-xl">
                {loading ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
                  </div>
                ) : (
                  <UserTable
                    users={filteredUsers}
                    onViewDetails={handleViewDetails}
                    onToggleStatus={handleToggleStatus}
                  />
                )}
              </div>
            </>
          )}

          {activeTab === 'loans' && (
            <>
              {(loanError || productLoanError) && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {loanError || productLoanError}
                </div>
              )}

              {/* Toggle between general loans and product loans */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="inline-flex rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
                  <button
                    type="button"
                    onClick={() => setLoanViewType('general')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      loanViewType === 'general'
                        ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                        : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                    }`}
                  >
                    General Loans
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoanViewType('product')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      loanViewType === 'product'
                        ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                        : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                    }`}
                  >
                    Product Loans
                  </button>
                </div>
              </div>

              {/* Loan pipeline stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mt-4">
                {loanViewType === 'general' ? (
                  <>
                    <StatCard
                      title="Total General Loans"
                      value={loanStats.total}
                      icon={FileText}
                      gradient="from-sky-600 via-sky-500 to-sky-700"
                      iconBg="bg-white/15"
                    />
                    <StatCard
                      title="Pending"
                      value={loanStats.pending}
                      icon={AlertTriangle}
                      gradient="from-amber-500 via-amber-400 to-amber-600"
                      iconBg="bg-white/15"
                    />
                    <StatCard
                      title="Accepted"
                      value={loanStats.accepted}
                      icon={CheckCircle}
                      gradient="from-blue-600 via-blue-500 to-blue-700"
                      iconBg="bg-white/15"
                    />
                    <StatCard
                      title="Verified"
                      value={loanStats.verified}
                      icon={Shield}
                      gradient="from-indigo-600 via-indigo-500 to-indigo-700"
                      iconBg="bg-white/15"
                    />
                    <StatCard
                      title="Disbursed"
                      value={loanStats.disbursed}
                      icon={HandCoins}
                      gradient="from-emerald-600 via-emerald-500 to-emerald-700"
                      iconBg="bg-white/15"
                    />
                  </>
                ) : (
                  <>
                    <StatCard
                      title="Total Product Loans"
                      value={productLoanStats.total}
                      icon={FileText}
                      gradient="from-pink-500 via-rose-500 to-fuchsia-600"
                      iconBg="bg-white/15"
                    />
                    <StatCard
                      title="Pending"
                      value={productLoanStats.pending}
                      icon={AlertTriangle}
                      gradient="from-amber-500 via-amber-400 to-amber-600"
                      iconBg="bg-white/15"
                    />
                    <StatCard
                      title="Accepted" 
                      value={productLoanStats.accepted}
                      icon={CheckCircle}
                      gradient="from-blue-600 via-blue-500 to-blue-700"
                      iconBg="bg-white/15"
                    />
                    <StatCard
                      title="Verified"
                      value={productLoanStats.verified}
                      icon={Shield}
                      gradient="from-indigo-600 via-indigo-500 to-indigo-700"
                      iconBg="bg-white/15"
                    />
                    <StatCard
                      title="Disbursed"
                      value={productLoanStats.disbursed}
                      icon={HandCoins}
                      gradient="from-emerald-600 via-emerald-500 to-emerald-700"
                      iconBg="bg-white/15"
                    />
                  </>
                )}
              </div>

              {/* Loans table */}
              <div className="mt-4 max-h-[calc(100vh-320px)] overflow-auto rounded-xl">
                {(loanViewType === 'general' ? loanLoading : productLoanLoading) ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                    <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-200">Application #</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-200">Applicant</th>
                          {loanViewType === 'product' && (
                            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-200">Product</th>
                          )}
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-200">Amount</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-200">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-200">Verification</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-200">Created</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {(loanViewType === 'general' ? loanRows : productLoanRows).map((loan) => (
                          <tr key={loan.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/60">
                            <td className="px-6 py-3 text-sm text-gray-900 dark:text-white">
                              {(loan as any).application_number || loan.id.slice(0, 8)}
                            </td>
                            <td className="px-6 py-3 text-sm text-gray-700 dark:text-gray-200">
                              {((loan as any).first_name || '')} {((loan as any).last_name || '')}
                            </td>
                            {loanViewType === 'product' && (
                              <td className="px-6 py-3 text-sm text-gray-700 dark:text-gray-200">
                                {(loan as any).product_name || '-'}
                              </td>
                            )}
                            <td className="px-6 py-3 text-sm text-gray-700 dark:text-gray-200">
                              ₹{(
                                (loan as any).loan_amount ?? (loan as any).total_amount ?? 0
                              ).toLocaleString()}
                            </td>
                            <td className="px-6 py-3 text-sm text-gray-700 dark:text-gray-200">
                              {(loan as any).status || '-'}
                            </td>
                            <td className="px-6 py-3 text-sm text-gray-700 dark:text-gray-200">
                              {loanViewType === 'general'
                                ? (loan as any).verification_status || 'Pending'
                                : '-'}
                            </td>
                            <td className="px-6 py-3 text-sm text-gray-700 dark:text-gray-200">
                              {new Date((loan as any).created_at).toLocaleDateString('en-IN', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </td>
                          </tr>
                        ))}
                        {(loanViewType === 'general' ? loanRows : productLoanRows).length === 0 && (
                          <tr>
                            <td
                              colSpan={loanViewType === 'product' ? 7 : 6}
                              className="px-6 py-6 text-center text-sm text-gray-500 dark:text-gray-400"
                            >
                              No loans found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              </div>
            </>
          )}

          {activeTab === 'notifications' && (
            <NotificationsPanel
              onApproveUser={async (userId: string, userType: 'merchant' | 'nbfc') => {
                try {
                  const { error } = await supabase
                    .from('user_profiles')
                    .update({ is_active: true, updated_at: new Date().toISOString() })
                    .eq('id', userId);
                  
                  if (error) throw error;
                  
                  // Refresh users list
                  fetchUsers();
                } catch (error) {
                  console.error('Error approving user:', error);
                }
              }}
              onViewUserDetails={(userId: string) => {
                const user = users.find(u => u.id === userId);
                if (user) {
                  handleViewDetails(user);
                }
              }}
            />
          )}
        </div>
      </main>

      {selectedUser && (
        <UserDetailsModal
          user={selectedUser as any}
          additionalDetails={selectedDetails as any}
          onClose={() => {
            if (!detailsLoading) {
              setSelectedUser(null);
              setSelectedDetails(null);
            }
          }}
        />
      )}
    </div>
  );
}
