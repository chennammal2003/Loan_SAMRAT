import { useNavigate } from 'react-router-dom';

export default function CustomerHome() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-amber-500 to-yellow-500 rounded-2xl p-8 text-white shadow-xl">
        <h1 className="text-4xl font-bold mb-2">Welcome to Golden Elegance</h1>
        <p className="text-amber-50">Discover handcrafted jewelry from trusted merchants</p>
        <div className="mt-6">
          <button
            type="button"
            onClick={() => navigate('/customer/store')}
            className="px-6 py-3 rounded-lg bg-white text-amber-700 font-semibold shadow hover:shadow-md"
          >
            Go to Store
          </button>
        </div>
      </div>
      <div className="bg-white rounded-xl p-6 shadow">
        <h2 className="text-lg font-semibold mb-2">Featured</h2>
        <p className="text-gray-600">Browse the latest collections and best offers in the store.</p>
      </div>
    </div>
  );
}
