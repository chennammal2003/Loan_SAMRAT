import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, Moon, Sun } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const testNetworkConnection = async () => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      console.log('[Network Test] Checking connection to:', supabaseUrl);
      
      const response = await fetch(supabaseUrl, {
        method: 'HEAD',
        mode: 'no-cors',
      });
      
      console.log('[Network Test] Supabase reachable:', response.status);
      return true;
    } catch (err: any) {
      console.error('[Network Test] Failed to reach Supabase:', err?.message);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      // Test network connectivity first
      const canReachServer = await testNetworkConnection();
      if (!canReachServer) {
        throw new Error('Cannot reach Supabase server. Please check your internet connection.');
      }

      await signIn(email, password);
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 500);
    } catch (err: any) {
      console.error('SignIn error details:', err);
      console.error('Error message:', err?.message);
      console.error('Error type:', err?.name);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to sign in';
      
      if (err.message) {
        if (err.message.includes('Cannot reach Supabase')) {
          errorMessage = 'Cannot reach authentication server. Please check:\n1. Your internet connection\n2. Supabase service status\n3. Your firewall settings';
        } else if (err.message.includes('Failed to fetch') || err.message.includes('fetch')) {
          errorMessage = 'Connection error: Unable to reach authentication server. Possible causes:\n• Internet connection issue\n• Supabase service down\n• Firewall blocking requests\n\nTry again or contact support.';
        } else if (err.message.includes('Invalid login credentials')) {
          errorMessage = 'Invalid email or password. Please check and try again.';
        } else if (err.message.includes('User not found')) {
          errorMessage = 'No account found with this email';
        } else if (err.message.includes('Email not confirmed')) {
          errorMessage = 'Please confirm your email before signing in';
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 p-2 rounded-lg bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-all"
      >
        {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5 text-yellow-400" />}
      </button>

      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
              <LogIn className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Welcome Back</h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6 bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg whitespace-pre-wrap text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="merchant@example.com"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate('/forgot-password')}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300"
            >
              Forgot Password?
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>

          <div className="text-center">
            <span className="text-gray-600 dark:text-gray-400">Don't have an account? </span>
            <button
              type="button"
              onClick={() => navigate('/signup')}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 font-medium"
            >
              Sign Up
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
