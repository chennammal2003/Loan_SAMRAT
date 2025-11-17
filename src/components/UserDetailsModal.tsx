import { X, Mail, Phone, MapPin, Calendar, User, CreditCard, Building2, Briefcase, DollarSign } from 'lucide-react';
import { UserProfile, MerchantProfile, NBFCProfile } from '../types';

interface UserDetailsModalProps {
  user: UserProfile;
  additionalDetails: MerchantProfile | NBFCProfile | null;
  onClose: () => void;
}

export function UserDetailsModal({ user, additionalDetails, onClose }: UserDetailsModalProps) {
  const isNBFC = user.role === 'nbfc_admin';
  const isMerchant = user.role === 'merchant';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="relative max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-white">User Details</h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(90vh - 80px)' }}>
          <div className="mb-6 flex items-center">
            {user.avatar_url ? (
              <img
                className="h-24 w-24 rounded-full object-cover ring-4 ring-blue-100"
                src={user.avatar_url}
                alt={user.full_name || user.email}
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-3xl font-bold text-white ring-4 ring-blue-100">
                {(user.full_name || user.email)[0].toUpperCase()}
              </div>
            )}
            <div className="ml-6">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{user.full_name || user.username || 'N/A'}</h3>
              <p className="text-gray-600 dark:text-gray-300">{user.email}</p>
              <div className="mt-2">
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${
                  user.role === 'nbfc_admin' ? 'bg-purple-100 text-purple-700' :
                  user.role === 'merchant' ? 'bg-blue-100 text-blue-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {user.role.replace('_', ' ').toUpperCase()}
                </span>
                <span className={`ml-2 inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${
                  user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-6 dark:border-gray-700 dark:from-gray-800 dark:to-gray-900">
              <h4 className="mb-4 flex items-center text-lg font-semibold text-gray-900 dark:text-white">
                <User className="mr-2 h-5 w-5 text-blue-600" />
                Basic Information
              </h4>
              <div className="space-y-3">
                <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={user.email} />
                <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={user.phone || user.mobile || 'N/A'} />
                <InfoRow icon={<MapPin className="h-4 w-4" />} label="Address" value={user.address || 'N/A'} />
                <InfoRow icon={<Calendar className="h-4 w-4" />} label="Date of Birth" value={user.date_of_birth ? new Date(user.date_of_birth).toLocaleDateString() : 'N/A'} />
                <InfoRow icon={<Calendar className="h-4 w-4" />} label="Joined Date" value={new Date(user.created_at).toLocaleDateString()} />
              </div>
            </div>

            {isMerchant && additionalDetails && 'business_name' in additionalDetails && (
              <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-blue-50 to-white p-6 dark:border-gray-700 dark:from-blue-950 dark:to-gray-900">
                <h4 className="mb-4 flex items-center text-lg font-semibold text-gray-900 dark:text-white">
                  <Briefcase className="mr-2 h-5 w-5 text-blue-600" />
                  Business Information
                </h4>
                <div className="space-y-3">
                  <InfoRow icon={<Building2 className="h-4 w-4" />} label="Business Name" value={additionalDetails.business_name || 'N/A'} />
                  <InfoRow icon={<User className="h-4 w-4" />} label="Owner Name" value={additionalDetails.owner_name || 'N/A'} />
                  <InfoRow icon={<Briefcase className="h-4 w-4" />} label="Business Type" value={additionalDetails.business_type || 'N/A'} />
                  <InfoRow icon={<Briefcase className="h-4 w-4" />} label="Category" value={additionalDetails.business_category || 'N/A'} />
                  <InfoRow icon={<CreditCard className="h-4 w-4" />} label="GST Number" value={additionalDetails.gst_number || 'N/A'} />
                  <InfoRow icon={<CreditCard className="h-4 w-4" />} label="PAN Number" value={additionalDetails.pan_number || 'N/A'} />
                </div>
              </div>
            )}

            {isMerchant && additionalDetails && 'business_name' in additionalDetails && (
              <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-green-50 to-white p-6 dark:border-gray-700 dark:from-green-950 dark:to-gray-900">
                <h4 className="mb-4 flex items-center text-lg font-semibold text-gray-900 dark:text-white">
                  <DollarSign className="mr-2 h-5 w-5 text-green-600" />
                  Banking Details
                </h4>
                <div className="space-y-3">
                  <InfoRow icon={<Building2 className="h-4 w-4" />} label="Bank Name" value={additionalDetails.bank_name || 'N/A'} />
                  <InfoRow icon={<CreditCard className="h-4 w-4" />} label="Account Number" value={additionalDetails.account_number || 'N/A'} />
                  <InfoRow icon={<CreditCard className="h-4 w-4" />} label="IFSC Code" value={additionalDetails.ifsc_code || 'N/A'} />
                  <InfoRow icon={<Phone className="h-4 w-4" />} label="UPI ID" value={additionalDetails.upi_id || 'N/A'} />
                </div>
              </div>
            )}

            {isNBFC && additionalDetails && 'name' in additionalDetails && (
              <>
                <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-purple-50 to-white p-6 dark:border-gray-700 dark:from-purple-950 dark:to-gray-900">
                  <h4 className="mb-4 flex items-center text-lg font-semibold text-gray-900 dark:text-white">
                    <Building2 className="mr-2 h-5 w-5 text-purple-600" />
                    NBFC Information
                  </h4>
                  <div className="space-y-3">
                    <InfoRow icon={<Building2 className="h-4 w-4" />} label="NBFC Name" value={additionalDetails.name} />
                    <InfoRow icon={<DollarSign className="h-4 w-4" />} label="Interest Rate" value={`${additionalDetails.interest_rate}%`} />
                    <InfoRow icon={<Calendar className="h-4 w-4" />} label="Default Tenure" value={additionalDetails.default_tenure ? `${additionalDetails.default_tenure} months` : 'N/A'} />
                    <InfoRow icon={<CreditCard className="h-4 w-4" />} label="Processing Fee" value={`₹${additionalDetails.processing_fee}`} />
                    <InfoRow icon={<Briefcase className="h-4 w-4" />} label="Approval Type" value={additionalDetails.approval_type} />
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-orange-50 to-white p-6 dark:border-gray-700 dark:from-orange-950 dark:to-gray-900">
                  <h4 className="mb-4 flex items-center text-lg font-semibold text-gray-900 dark:text-white">
                    <DollarSign className="mr-2 h-5 w-5 text-orange-600" />
                    Loan Parameters
                  </h4>
                  <div className="space-y-3">
                    <InfoRow icon={<DollarSign className="h-4 w-4" />} label="Min Loan Amount" value={additionalDetails.min_loan_amount ? `₹${additionalDetails.min_loan_amount.toLocaleString()}` : 'N/A'} />
                    <InfoRow icon={<DollarSign className="h-4 w-4" />} label="Max Loan Amount" value={additionalDetails.max_loan_amount ? `₹${additionalDetails.max_loan_amount.toLocaleString()}` : 'N/A'} />
                    <InfoRow icon={<CreditCard className="h-4 w-4" />} label="Processing Fee %" value={additionalDetails.processing_fee_percent ? `${additionalDetails.processing_fee_percent}%` : 'N/A'} />
                    <InfoRow icon={<CreditCard className="h-4 w-4" />} label="GST Applicable" value={additionalDetails.gst_applicable ? 'Yes' : 'No'} />
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-blue-50 to-white p-6 md:col-span-2 dark:border-gray-700 dark:from-blue-950 dark:to-gray-900">
                  <h4 className="mb-4 flex items-center text-lg font-semibold text-gray-900 dark:text-white">
                    <CreditCard className="mr-2 h-5 w-5 text-blue-600" />
                    Registration Details
                  </h4>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <InfoRow icon={<CreditCard className="h-4 w-4" />} label="CIN Number" value={additionalDetails.cin_number || 'N/A'} />
                    <InfoRow icon={<CreditCard className="h-4 w-4" />} label="RBI License" value={additionalDetails.rbi_license_number || 'N/A'} />
                    <InfoRow icon={<Phone className="h-4 w-4" />} label="Contact Number" value={additionalDetails.contact_number || 'N/A'} />
                    <InfoRow icon={<Mail className="h-4 w-4" />} label="Official Email" value={additionalDetails.official_email || 'N/A'} />
                  </div>
                </div>
              </>
            )}
          </div>

          {(!isMerchant && !isNBFC) && (
            <div className="mt-6 rounded-xl border border-gray-200 bg-gradient-to-br from-green-50 to-white p-6 dark:border-gray-700 dark:from-gray-800 dark:to-gray-900">
              <h4 className="mb-4 flex items-center text-lg font-semibold text-gray-900 dark:text-white">
                <User className="mr-2 h-5 w-5 text-green-600" />
                Additional Information
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-300">No additional profile information available for this user type.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start">
      <div className="mr-3 mt-0.5 text-gray-400 dark:text-gray-500">{icon}</div>
      <div className="flex-1">
        <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</p>
        <p className="mt-0.5 text-sm font-medium text-gray-900 dark:text-gray-100">{value}</p>
      </div>
    </div>
  );
}
