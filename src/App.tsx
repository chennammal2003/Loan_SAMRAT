import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import PublicApplyLoanPage from './pages/PublicApplyLoanPage.tsx';
import AdminDashboard from './components/AdminDashboard';
import LoanDetails from './components/LoanDetails';
import MerchantDisbursedLoans from './components/MerchantDisbursedLoans';
import MerchantPaymentTracker from './components/MerchantPaymentTracker';
import ProductDescription from './components/ProductDescription';
import ManageLoans from './components/ManageLoans';
import AcceptedLoans from './components/AcceptedLoans';
import DisbursedLoans from './components/DisbursedLoans';
import MerchantDetails from './components/MerchantDetails';
import MerchantDashboard from './components/MerchantDashboard';
import PageShell from './components/PageShell';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  return user ? <>{children}</> : <Navigate to="/signin" />;
}

function MerchantRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, profile } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  if (!user) return <Navigate to="/signin" replace />;
  if (!profile) return null;
  if (profile.role !== 'merchant') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, profile } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  if (!user) return <Navigate to="/signin" replace />;
  if (!profile) return null;
  if (profile.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function DashboardRouter() {
  const { profile, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading your profile...</p>
        </div>
      </div>
    );
  }

  return profile.role === 'admin' ? <AdminDashboard /> : <MerchantDashboard />;
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/apply-loan/:linkId" element={<PublicApplyLoanPage />} />
            <Route path="/admin/manage" element={<AdminRoute><PageShell><ManageLoans initialStatusFilter={'All'} /></PageShell></AdminRoute>} />
            <Route path="/admin/accepted" element={<AdminRoute><PageShell><AcceptedLoans /></PageShell></AdminRoute>} />
            <Route path="/admin/disbursed" element={<AdminRoute><PageShell><DisbursedLoans /></PageShell></AdminRoute>} />
            <Route path="/admin/payments" element={<AdminRoute><PageShell><MerchantPaymentTracker /></PageShell></AdminRoute>} />
            <Route path="/admin/merchants" element={<AdminRoute><PageShell><MerchantDetails /></PageShell></AdminRoute>} />
            {/* Merchant standalone pages (no dashboard shell) */}
            <Route path="/loans" element={<MerchantRoute><PageShell><LoanDetails /></PageShell></MerchantRoute>} />
            <Route path="/disbursed" element={<MerchantRoute><PageShell><MerchantDisbursedLoans /></PageShell></MerchantRoute>} />
            <Route path="/payments" element={<MerchantRoute><PageShell><MerchantPaymentTracker /></PageShell></MerchantRoute>} />
            <Route path="/products" element={<MerchantRoute><PageShell><ProductDescription /></PageShell></MerchantRoute>} />
            <Route
              path="/dashboard/*"
              element={
                <PrivateRoute>
                  <DashboardRouter />
                </PrivateRoute>
              }
            />
            <Route path="/" element={<Navigate to="/dashboard" />} />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;