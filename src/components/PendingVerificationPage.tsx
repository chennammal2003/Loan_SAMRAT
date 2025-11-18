import { Clock, Shield, User, Building, Mail, Phone } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface PendingVerificationPageProps {
  userType: 'merchant' | 'nbfc_admin';
  profileData?: {
    business_name?: string;
    owner_name?: string;
    email?: string;
    phone?: string;
    nbfc_name?: string;
  };
}

export default function PendingVerificationPage({ userType, profileData }: PendingVerificationPageProps) {
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      window.location.href = '/signin';
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const isMerchant = userType === 'merchant';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-8 text-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-xl font-bold text-white mb-2">
              Profile Submitted Successfully
            </h1>
            <p className="text-amber-100 text-sm">
              Awaiting Super Admin Verification
            </p>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                {isMerchant ? (
                  <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                ) : (
                  <Building className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                )}
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {isMerchant ? 'Merchant Profile' : 'NBFC Profile'} Under Review
              </h2>
              <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                Your {isMerchant ? 'merchant' : 'NBFC'} profile has been submitted for verification. 
                You cannot access {isMerchant ? 'NBFC selection and loan features' : 'the admin dashboard'} until 
                the Super Admin reviews and approves your profile.
              </p>
            </div>

            {/* Profile Summary */}
            {profileData && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Submitted Profile Details
                </h3>
                <div className="space-y-2 text-sm">
                  {isMerchant ? (
                    <>
                      {profileData.business_name && (
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                          <Building className="w-3 h-3" />
                          <span className="font-medium">Business:</span> {profileData.business_name}
                        </div>
                      )}
                      {profileData.owner_name && (
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                          <User className="w-3 h-3" />
                          <span className="font-medium">Owner:</span> {profileData.owner_name}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {profileData.nbfc_name && (
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                          <Building className="w-3 h-3" />
                          <span className="font-medium">NBFC:</span> {profileData.nbfc_name}
                        </div>
                      )}
                    </>
                  )}
                  {profileData.email && (
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                      <Mail className="w-3 h-3" />
                      <span className="font-medium">Email:</span> {profileData.email}
                    </div>
                  )}
                  {profileData.phone && (
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                      <Phone className="w-3 h-3" />
                      <span className="font-medium">Phone:</span> {profileData.phone}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Status Steps */}
            <div className="mb-6">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
                <span>Profile Submitted</span>
                <span>Under Review</span>
                <span>Approved</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <div className="flex-1 h-1 bg-amber-300 mx-2"></div>
                <div className="w-3 h-3 bg-amber-300 rounded-full animate-pulse"></div>
                <div className="flex-1 h-1 bg-gray-200 dark:bg-gray-600 mx-2"></div>
                <div className="w-3 h-3 bg-gray-200 dark:bg-gray-600 rounded-full"></div>
              </div>
            </div>

            {/* Next Steps */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
              <h3 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
                What happens next?
              </h3>
              <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                <li>• Super Admin will review your profile details</li>
                <li>• You'll receive access once approved</li>
                <li>• Check back later or wait for email notification</li>
                {isMerchant && <li>• After approval, you can select NBFCs and apply for loans</li>}
                {!isMerchant && <li>• After approval, you can access the full admin dashboard</li>}
              </ul>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <div className="text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Need to make changes to your profile? Sign out and contact support.
                </p>
              </div>
              
              <button
                onClick={handleSignOut}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors text-sm"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            This process typically takes 24-48 hours during business days
          </p>
        </div>
      </div>
    </div>
  );
}
