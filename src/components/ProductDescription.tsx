import { CreditCard, Clock, Shield, TrendingUp, CheckCircle, AlertCircle } from 'lucide-react';

export default function ProductDescription() {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-8 text-white">
        <h2 className="text-3xl font-bold mb-2">Gold-Backed Loan Products</h2>
        <p className="text-blue-100">Flexible financing solutions secured against gold</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Loan Amounts</h3>
          </div>
          <ul className="space-y-2 text-gray-600 dark:text-gray-300">
            <li className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span>₹60,000 - Entry Level</span>
            </li>
            <li className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span>₹65,000 - Standard</span>
            </li>
            <li className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span>₹70,000 - Premium</span>
            </li>
          </ul>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Tenure Options</h3>
          </div>
          <ul className="space-y-2 text-gray-600 dark:text-gray-300">
            <li className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span>3 Months - Short Term</span>
            </li>
            <li className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span>6 Months - Medium Term</span>
            </li>
            <li className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span>9 Months - Standard</span>
            </li>
            <li className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span>12 Months - Long Term</span>
            </li>
          </ul>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Interest Schemes</h3>
          </div>
          <ul className="space-y-2 text-gray-600 dark:text-gray-300">
            <li className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span>12 gm Scheme</span>
            </li>
            <li className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span>6 bm Scheme</span>
            </li>
          </ul>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
              <Shield className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Processing Fee</h3>
          </div>
          <p className="text-gray-600 dark:text-gray-300 mb-2">
            Standard processing fee of <strong className="text-gray-900 dark:text-white">3% + GST</strong> applies to all loans.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            This fee covers documentation, verification, and administrative costs.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Required Documents</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Identity Proof</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Aadhaar Card, PAN Card</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Address Proof</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Utility Bill, Rental Agreement</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Bank Statement</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Last 6 months transaction history</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Photographs</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Passport size photo</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Quick Processing</h3>
        <p className="text-gray-600 dark:text-gray-300">
          Your loan application will be reviewed within 24-48 hours. Once approved, funds are disbursed quickly to your account.
        </p>
      </div>
    </div>
  );
}
