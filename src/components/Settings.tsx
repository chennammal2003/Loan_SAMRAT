import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import NbfcSetup from '../pages/NbfcSetup';
import { 
  User, 
  Shield, 
  Bell, 
  Palette, 
  Database, 
  CreditCard, 
  Save, 
  Eye, 
  EyeOff,
  CheckCircle,
  XCircle
} from 'lucide-react';

type SettingsSection = 'profile' | 'security' | 'notifications' | 'appearance' | 'system' | 'billing' | 'nbfc';

interface SettingsProps {
  role: 'merchant' | 'admin';
}

export default function Settings({ role }: SettingsProps) {
  const { profile, user, updatePassword } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [activeSection, setActiveSection] = useState<SettingsSection>('profile');
  
  // Profile state
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Security state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Notifications state
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [loanUpdates, setLoanUpdates] = useState(true);
  const [paymentReminders, setPaymentReminders] = useState(true);
  const [systemAlerts, setSystemAlerts] = useState(role === 'admin');
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // System settings state (role-specific)
  const [autoApproveLoans, setAutoApproveLoans] = useState(false);
  const [defaultLoanTenure, setDefaultLoanTenure] = useState('12');
  const [maxLoanAmount, setMaxLoanAmount] = useState('');
  const [savingSystem, setSavingSystem] = useState(false);
  const [systemMessage, setSystemMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Billing state
  const [billingEmail, setBillingEmail] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [savingBilling, setSavingBilling] = useState(false);
  const [billingMessage, setBillingMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username || '');
      setEmail(profile.email || '');
      setBillingEmail(profile.email || '');
    }
  }, [profile]);

  // Load notification preferences
  useEffect(() => {
    const loadPreferences = async () => {
      if (!user) return;
      try {
        const { data } = await supabase
          .from('user_preferences')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (data) {
          setEmailNotifications(data.email_notifications ?? true);
          setLoanUpdates(data.loan_updates ?? true);
          setPaymentReminders(data.payment_reminders ?? true);
          setSystemAlerts(data.system_alerts ?? (role === 'admin'));
        }
      } catch (error) {
        console.error('Error loading preferences:', error);
      }
    };
    loadPreferences();
  }, [user, role]);

  const handleUpdateProfile = async () => {
    if (!user || !profile) return;
    
    setUpdatingProfile(true);
    setProfileMessage(null);
    
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ 
          username,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;

      // Update email in auth if changed
      if (email !== profile.email) {
        const { error: emailError } = await supabase.auth.updateUser({ email });
        if (emailError) throw emailError;
      }

      setProfileMessage({ type: 'success', text: 'Profile updated successfully!' });
      setTimeout(() => setProfileMessage(null), 3000);
    } catch (error: any) {
      setProfileMessage({ type: 'error', text: error.message || 'Failed to update profile' });
      setTimeout(() => setProfileMessage(null), 5000);
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || !confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Please fill in all password fields' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }

    setUpdatingPassword(true);
    setPasswordMessage(null);

    try {
      await updatePassword(newPassword);
      setPasswordMessage({ type: 'success', text: 'Password updated successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordMessage(null), 3000);
    } catch (error: any) {
      setPasswordMessage({ type: 'error', text: error.message || 'Failed to update password' });
      setTimeout(() => setPasswordMessage(null), 5000);
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleSaveNotifications = async () => {
    if (!user) return;
    
    setSavingNotifications(true);
    setNotificationMessage(null);

    try {
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          email_notifications: emailNotifications,
          loan_updates: loanUpdates,
          payment_reminders: paymentReminders,
          system_alerts: systemAlerts,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (error) throw error;

      setNotificationMessage({ type: 'success', text: 'Notification preferences saved!' });
      setTimeout(() => setNotificationMessage(null), 3000);
    } catch (error: any) {
      setNotificationMessage({ type: 'error', text: error.message || 'Failed to save preferences' });
      setTimeout(() => setNotificationMessage(null), 5000);
    } finally {
      setSavingNotifications(false);
    }
  };

  const handleSaveSystem = async () => {
    if (!user) return;
    
    setSavingSystem(true);
    setSystemMessage(null);

    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          user_id: user.id,
          auto_approve_loans: autoApproveLoans,
          default_loan_tenure: parseInt(defaultLoanTenure),
          max_loan_amount: maxLoanAmount ? parseFloat(maxLoanAmount) : null,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (error) throw error;

      setSystemMessage({ type: 'success', text: 'System settings saved!' });
      setTimeout(() => setSystemMessage(null), 3000);
    } catch (error: any) {
      setSystemMessage({ type: 'error', text: error.message || 'Failed to save system settings' });
      setTimeout(() => setSystemMessage(null), 5000);
    } finally {
      setSavingSystem(false);
    }
  };

  const handleSaveBilling = async () => {
    if (!user) return;
    
    setSavingBilling(true);
    setBillingMessage(null);

    try {
      const { error } = await supabase
        .from('billing_info')
        .upsert({
          user_id: user.id,
          billing_email: billingEmail,
          billing_address: billingAddress,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (error) throw error;

      setBillingMessage({ type: 'success', text: 'Billing information saved!' });
      setTimeout(() => setBillingMessage(null), 3000);
    } catch (error: any) {
      setBillingMessage({ type: 'error', text: error.message || 'Failed to save billing information' });
      setTimeout(() => setBillingMessage(null), 5000);
    } finally {
      setSavingBilling(false);
    }
  };

  const sections = [
    { id: 'profile' as SettingsSection, label: 'Profile', icon: User },
    { id: 'security' as SettingsSection, label: 'Security', icon: Shield },
    { id: 'notifications' as SettingsSection, label: 'Notifications', icon: Bell },
    { id: 'appearance' as SettingsSection, label: 'Appearance', icon: Palette },
    ...(role === 'admin' ? ([{ id: 'nbfc' as SettingsSection, label: 'NBFC Profile', icon: Database }] as const) : ([] as const)),
    { id: 'system' as SettingsSection, label: role === 'admin' ? 'System' : 'Account', icon: Database },
    { id: 'billing' as SettingsSection, label: 'Billing', icon: CreditCard },
  ];

  return (
    <div className="w-full">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Settings</h1>
        
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Navigation */}
          <aside className="lg:w-64 flex-shrink-0">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 space-y-2">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                      activeSection === section.id
                        ? role === 'admin' 
                          ? 'bg-orange-600 text-white' 
                          : 'bg-blue-600 text-white'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{section.label}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
              {/* Profile Section */}
              {activeSection === 'profile' && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Profile</h2>
                  <p className="text-gray-600 dark:text-gray-400">Update your personal information</p>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Username
                      </label>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter username"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Email
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter email"
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Changing your email will require verification
                      </p>
                    </div>

                    {profileMessage && (
                      <div className={`flex items-center space-x-2 p-3 rounded-lg ${
                        profileMessage.type === 'success' 
                          ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-400' 
                          : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400'
                      }`}>
                        {profileMessage.type === 'success' ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : (
                          <XCircle className="w-5 h-5" />
                        )}
                        <span>{profileMessage.text}</span>
                      </div>
                    )}

                    <button
                      onClick={handleUpdateProfile}
                      disabled={updatingProfile}
                      className={`flex items-center space-x-2 px-6 py-2 rounded-lg text-white ${
                        role === 'admin' 
                          ? 'bg-orange-600 hover:bg-orange-700' 
                          : 'bg-blue-600 hover:bg-blue-700'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <Save className="w-4 h-4" />
                      <span>{updatingProfile ? 'Saving...' : 'Save Changes'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* NBFC Profile Section (Admin only) */}
              {activeSection === 'nbfc' && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">NBFC Profile</h2>
                  <p className="text-gray-600 dark:text-gray-400">View and update your institution details, financial parameters, loan configuration, approval settings and compliance documents.</p>
                  <div className="-m-6">
                    {/* Embedded NBFC Setup/Edit form */}
                    <NbfcSetup embedded />
                  </div>
                </div>
              )}

              {/* Security Section */}
              {activeSection === 'security' && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Security</h2>
                  <p className="text-gray-600 dark:text-gray-400">Change your password to keep your account secure</p>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                          placeholder="Enter new password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Confirm New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                          placeholder="Confirm new password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    {passwordMessage && (
                      <div className={`flex items-center space-x-2 p-3 rounded-lg ${
                        passwordMessage.type === 'success' 
                          ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-400' 
                          : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400'
                      }`}>
                        {passwordMessage.type === 'success' ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : (
                          <XCircle className="w-5 h-5" />
                        )}
                        <span>{passwordMessage.text}</span>
                      </div>
                    )}

                    <button
                      onClick={handleUpdatePassword}
                      disabled={updatingPassword}
                      className={`flex items-center space-x-2 px-6 py-2 rounded-lg text-white ${
                        role === 'admin' 
                          ? 'bg-orange-600 hover:bg-orange-700' 
                          : 'bg-blue-600 hover:bg-blue-700'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <Save className="w-4 h-4" />
                      <span>{updatingPassword ? 'Updating...' : 'Update Password'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Notifications Section */}
              {activeSection === 'notifications' && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Notifications</h2>
                  <p className="text-gray-600 dark:text-gray-400">Manage your notification preferences</p>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">Email Notifications</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Receive notifications via email</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={emailNotifications}
                          onChange={(e) => setEmailNotifications(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">Loan Updates</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Get notified about loan status changes</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={loanUpdates}
                          onChange={(e) => setLoanUpdates(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">Payment Reminders</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Receive reminders for upcoming payments</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={paymentReminders}
                          onChange={(e) => setPaymentReminders(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    {role === 'admin' && (
                      <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">System Alerts</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Receive system-wide alerts and updates</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={systemAlerts}
                            onChange={(e) => setSystemAlerts(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-600"></div>
                        </label>
                      </div>
                    )}

                    {notificationMessage && (
                      <div className={`flex items-center space-x-2 p-3 rounded-lg ${
                        notificationMessage.type === 'success' 
                          ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-400' 
                          : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400'
                      }`}>
                        {notificationMessage.type === 'success' ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : (
                          <XCircle className="w-5 h-5" />
                        )}
                        <span>{notificationMessage.text}</span>
                      </div>
                    )}

                    <button
                      onClick={handleSaveNotifications}
                      disabled={savingNotifications}
                      className={`flex items-center space-x-2 px-6 py-2 rounded-lg text-white ${
                        role === 'admin' 
                          ? 'bg-orange-600 hover:bg-orange-700' 
                          : 'bg-blue-600 hover:bg-blue-700'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <Save className="w-4 h-4" />
                      <span>{savingNotifications ? 'Saving...' : 'Save Preferences'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Appearance Section */}
              {activeSection === 'appearance' && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Appearance</h2>
                  <p className="text-gray-600 dark:text-gray-400">Customize the look and feel of your interface</p>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">Theme</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Current theme: <span className="font-medium capitalize">{theme}</span>
                        </p>
                      </div>
                      <button
                        onClick={toggleTheme}
                        className={`px-6 py-2 rounded-lg text-white ${
                          role === 'admin' 
                            ? 'bg-orange-600 hover:bg-orange-700' 
                            : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                      >
                        Switch to {theme === 'light' ? 'Dark' : 'Light'} Mode
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* System Section */}
              {activeSection === 'system' && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {role === 'admin' ? 'System Settings' : 'Account Settings'}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    {role === 'admin' 
                      ? 'Configure system-wide settings' 
                      : 'Manage your account preferences'}
                  </p>
                  
                  <div className="space-y-4">
                    {role === 'admin' && (
                      <>
                        <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                          <div>
                            <h3 className="font-medium text-gray-900 dark:text-white">Auto-Approve Loans</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Automatically approve loans that meet criteria</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={autoApproveLoans}
                              onChange={(e) => setAutoApproveLoans(e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-600"></div>
                          </label>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Default Loan Tenure (months)
                          </label>
                          <select
                            value={defaultLoanTenure}
                            onChange={(e) => setDefaultLoanTenure(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          >
                            <option value="3">3 months</option>
                            <option value="6">6 months</option>
                            <option value="9">9 months</option>
                            <option value="12">12 months</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Maximum Loan Amount
                          </label>
                          <input
                            type="number"
                            value={maxLoanAmount}
                            onChange={(e) => setMaxLoanAmount(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            placeholder="Enter maximum loan amount"
                          />
                        </div>
                      </>
                    )}

                    {role === 'merchant' && (
                      <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <p className="text-gray-600 dark:text-gray-400">
                          Account settings and preferences for merchants. Additional options coming soon.
                        </p>
                      </div>
                    )}

                    {systemMessage && (
                      <div className={`flex items-center space-x-2 p-3 rounded-lg ${
                        systemMessage.type === 'success' 
                          ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-400' 
                          : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400'
                      }`}>
                        {systemMessage.type === 'success' ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : (
                          <XCircle className="w-5 h-5" />
                        )}
                        <span>{systemMessage.text}</span>
                      </div>
                    )}

                    {role === 'admin' && (
                      <button
                        onClick={handleSaveSystem}
                        disabled={savingSystem}
                        className="flex items-center space-x-2 px-6 py-2 rounded-lg text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Save className="w-4 h-4" />
                        <span>{savingSystem ? 'Saving...' : 'Save Settings'}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Billing Section */}
              {activeSection === 'billing' && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Billing</h2>
                  <p className="text-gray-600 dark:text-gray-400">Manage your billing information</p>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Billing Email
                      </label>
                      <input
                        type="email"
                        value={billingEmail}
                        onChange={(e) => setBillingEmail(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter billing email"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Billing Address
                      </label>
                      <textarea
                        value={billingAddress}
                        onChange={(e) => setBillingAddress(e.target.value)}
                        rows={4}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter billing address"
                      />
                    </div>

                    {billingMessage && (
                      <div className={`flex items-center space-x-2 p-3 rounded-lg ${
                        billingMessage.type === 'success' 
                          ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-400' 
                          : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400'
                      }`}>
                        {billingMessage.type === 'success' ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : (
                          <XCircle className="w-5 h-5" />
                        )}
                        <span>{billingMessage.text}</span>
                      </div>
                    )}

                    <button
                      onClick={handleSaveBilling}
                      disabled={savingBilling}
                      className={`flex items-center space-x-2 px-6 py-2 rounded-lg text-white ${
                        role === 'admin' 
                          ? 'bg-orange-600 hover:bg-orange-700' 
                          : 'bg-blue-600 hover:bg-blue-700'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <Save className="w-4 h-4" />
                      <span>{savingBilling ? 'Saving...' : 'Save Billing Info'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

