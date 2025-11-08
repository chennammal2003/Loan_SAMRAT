import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { CartProvider } from './contexts/CartContext';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import PublicApplyLoanPage from './pages/PublicApplyLoanPage.tsx';
import AdminDashboard from './components/AdminDashboard';
import LoanDetails from './components/LoanDetails';
import MerchantDisbursedLoans from './components/MerchantDisbursedLoans';
import MerchantPaymentTracker from './components/MerchantPaymentTracker';
import ManageLoans from './components/ManageLoans';
import AcceptedLoans from './components/AcceptedLoans';
import DisbursedLoans from './components/DisbursedLoans';
import MerchantDetails from './components/MerchantDetails';
import MerchantDashboard from './components/MerchantDashboard';
import PageShell from './components/PageShell';
import Product from './components/products';
import AdminProductLoans from './components/AdminProductLoans';
import MerchantProductLoans from './components/MerchantProductLoans';
import Settings from './components/Settings';
import StorePage from './components/StorePage';
import CustomerHome from './components/customer/CustomerHome';
import CustomerOrders from './components/customer/CustomerOrders';
import CustomerProfile from './components/customer/CustomerProfile';
import CustomerShell from './components/customer/CustomerShell';
import { WishlistProvider } from './contexts/WishlistContext';
import WishlistPage from './components/customer/WishlistPage';
import CartPage from './components/customer/CartPage';
import CheckoutPage from './components/customer/CheckoutPage';
import ProductDetailPage from './components/customer/ProductDetailPage';
import PaymentChoicePage from './components/customer/PaymentChoicePage';
import FinanceTenurePage from './components/customer/FinanceTenurePage';
import LoanApplyPage from './components/customer/LoanApplyPage';
import NbfcProfileGate from './components/NbfcProfileGate';
import NbfcSetup from './pages/NbfcSetup';
import TieUpGate from './components/TieUpGate';
import NbfcSelect from './pages/NbfcSelect';
import AdminTieUps from './components/AdminTieUps';
import RequireMerchantProfile from './components/RequireMerchantProfile';

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

function CustomerRoute({ children }: { children: React.ReactNode }) {
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
  if (profile.role !== 'customer') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
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
  if (!['admin','nbfc_admin'].includes(profile.role as any)) return <Navigate to="/dashboard" replace />;
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

  if (['admin','nbfc_admin'].includes(profile.role as any)) return <NbfcProfileGate><AdminDashboard /></NbfcProfileGate>;
  if (profile.role === 'merchant') return <TieUpGate><MerchantDashboard /></TieUpGate>;
  // Customer: send to customer area (index renders store)
  return <Navigate to="/customer" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <CartProvider>
          <WishlistProvider>
          <Routes>
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/apply-loan/:linkId" element={<PublicApplyLoanPage />} />
            <Route path="/nbfc/setup" element={<PrivateRoute><NbfcSetup /></PrivateRoute>} />
            <Route path="/nbfc/select" element={<MerchantRoute><RequireMerchantProfile><NbfcSelect /></RequireMerchantProfile></MerchantRoute>} />
            <Route path="/admin/manage" element={<AdminRoute><PageShell><ManageLoans initialStatusFilter={'All'} /></PageShell></AdminRoute>} />
            <Route path="/admin/accepted" element={<AdminRoute><PageShell><AcceptedLoans /></PageShell></AdminRoute>} />
            <Route path="/admin/disbursed" element={<AdminRoute><PageShell><DisbursedLoans /></PageShell></AdminRoute>} />
            <Route path="/admin/payments" element={<AdminRoute><PageShell><MerchantPaymentTracker /></PageShell></AdminRoute>} />
            <Route path="/admin/merchants" element={<AdminRoute><PageShell><MerchantDetails /></PageShell></AdminRoute>} />
            <Route path="/admin/product-loans" element={<AdminRoute><PageShell><AdminProductLoans /></PageShell></AdminRoute>} />
            <Route path="/admin/settings" element={<AdminRoute><PageShell><Settings role="admin" /></PageShell></AdminRoute>} />
            <Route path="/admin/tieups" element={<AdminRoute><PageShell><AdminTieUps /></PageShell></AdminRoute>} />
            {/* Merchant standalone pages (no dashboard shell) */}
            <Route path="/loans" element={<MerchantRoute><PageShell><LoanDetails /></PageShell></MerchantRoute>} />
            <Route path="/disbursed" element={<MerchantRoute><PageShell><MerchantDisbursedLoans /></PageShell></MerchantRoute>} />
            <Route path="/payments" element={<MerchantRoute><PageShell><MerchantPaymentTracker /></PageShell></MerchantRoute>} />
            <Route path="/products" element={<MerchantRoute><PageShell><Product /></PageShell></MerchantRoute>} />
            <Route path="/merchant/product-loans" element={<MerchantRoute><PageShell><MerchantProductLoans /></PageShell></MerchantRoute>} />
            <Route path="/merchant/settings" element={<MerchantRoute><PageShell><Settings role="merchant" /></PageShell></MerchantRoute>} />
            {/* Customer area with shared shell/header */}
            <Route path="/customer" element={<CustomerRoute><CustomerShell /></CustomerRoute>}>
              <Route index element={<StorePage />} />
              <Route path="store" element={<StorePage />} />
              <Route path="home" element={<CustomerHome />} />
              <Route path="wishlist" element={<WishlistPage />} />
              <Route path="orders" element={<CustomerOrders />} />
              <Route path="profile" element={<CustomerProfile />} />
              <Route path="cart" element={<CartPage /> } />
              <Route path="checkout" element={<CheckoutPage /> } />
              <Route path="product/:id" element={<ProductDetailPage /> } />
              <Route path="payment-choice" element={<PaymentChoicePage /> } />
              <Route path="finance-tenure" element={<FinanceTenurePage /> } />
              <Route path="loan-apply" element={<LoanApplyPage /> } />
            </Route>
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
          </WishlistProvider>
          </CartProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;