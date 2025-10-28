import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingCart, Heart } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useWishlist } from '../../contexts/WishlistContext';
import { useCart } from '../../contexts/CartContext';

export default function CustomerShell() {
  const { theme, toggleTheme } = useTheme();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { ids: wishlistIds } = useWishlist();
  const { count: cartCount } = useCart();

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/signin', { replace: true });
    } catch (e) {
      console.error('Logout failed', e);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white dark:from-gray-900 dark:to-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500 text-white font-bold flex items-center justify-center shadow">G</div>
            <div>
              <div className="text-gray-900 dark:text-white font-semibold leading-tight">Golden Elegance</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 -mt-0.5">Premium Jewelry</div>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-1">
            {[
              { label: 'Home', path: '/customer/home' },
              { label: 'Store', path: '/customer' },
              { label: 'Wishlist', path: '/customer/wishlist' },
              { label: 'My Orders', path: '/customer/orders' },
              { label: 'Profile', path: '/customer/profile' },
            ].map(({ label, path }) => {
              const active = location.pathname === path || (path === '/customer' && location.pathname === '/customer/store');
              return (
                <button
                  key={path}
                  type="button"
                  onClick={() => navigate(path)}
                  className={`px-4 py-2 rounded-lg transition-colors ${active ? 'bg-amber-100 text-amber-700 font-semibold shadow-sm' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                >
                  {label}
                </button>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/customer/wishlist')}
              aria-label="Wishlist"
              className="relative p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:shadow"
            >
              <Heart className="w-5 h-5 text-rose-500" />
              {wishlistIds.length > 0 && (
                <span className="absolute -top-1 -right-1 text-[10px] leading-none bg-rose-500 text-white rounded-full px-1.5 py-1 shadow">{wishlistIds.length}</span>
              )}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="hidden sm:inline-flex px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:shadow"
            >
              Logout
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:shadow"
            >
              {theme === 'light' ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M12 18a6 6 0 100-12 6 6 0 000 12z"/><path fillRule="evenodd" d="M12 2.25a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0V3A.75.75 0 0112 2.25zm0 16.5a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5a.75.75 0 01.75-.75zM4.72 4.72a.75.75 0 011.06 0l1.06 1.06a.75.75 0 11-1.06 1.06L4.72 5.78a.75.75 0 010-1.06zm12.44 12.44a.75.75 0 011.06 0l1.06 1.06a.75.75 0 11-1.06 1.06l-1.06-1.06a.75.75 0 010-1.06zM2.25 12a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5H3A.75.75 0 012.25 12zm16.5 0A.75.75 0 0119.5 12h1.5a.75.75 0 010 1.5H19.5a.75.75 0 01-.75-.75zM4.72 19.28a.75.75 0 010-1.06l1.06-1.06a.75.75 0 011.06 1.06L5.78 19.28a.75.75 0 01-1.06 0zm12.44-12.44a.75.75 0 010-1.06l1.06-1.06a.75.75 0 111.06 1.06L18.22 7.84a.75.75 0 01-1.06 0z" clipRule="evenodd"/>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-yellow-400">
                  <path d="M21.752 15.002A9.718 9.718 0 0112 21.75c-5.385 0-9.75-4.365-9.75-9.75 0-4.107 2.504-7.626 6.06-9.09a.75.75 0 01.967.967A8.25 8.25 0 0012 20.25c3.738 0 6.873-2.5 7.623-5.922a.75.75 0 011.129-.326z" />
                </svg>
              )}
            </button>
            <button type="button" aria-label="Cart" onClick={() => navigate('/customer/cart')} className="relative p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:shadow">
              <ShoppingCart className="w-5 h-5 text-gray-700 dark:text-gray-200" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 text-[10px] leading-none bg-amber-500 text-white rounded-full px-1.5 py-1 shadow">{cartCount}</span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Page body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </div>
    </div>
  );
}
