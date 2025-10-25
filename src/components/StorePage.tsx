import { useEffect, useMemo, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import ProductCard from './ProductCard';
import ProductDetailModal from './ProductDetailModal';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';

type Category = 'all' | 'necklace' | 'ring' | 'bangle' | 'chain' | 'earring' | 'pendant' | 'coin' | 'bracelet';
type Purity = 'all' | '18K' | '20K' | '22K' | '24K';
type SortOption = 'price-asc' | 'price-desc' | 'newest';

type DBProduct = {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  image_url: string | null;
  category: string | null;
  purity: string | null;
  weight: number | null;
  metal_type: string | null;
  gemstone: string | null;
  discount_percent: number | null;
  stock_qty: number | null;
  created_at?: string | null;
};

export default function StorePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category>('all');
  const [selectedPurity, setSelectedPurity] = useState<Purity>('all');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 200000]);
  const [weightRange, setWeightRange] = useState<[number, number]>([0, 50]);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<null | {
    id: string;
    name: string;
    category: string;
    purity: string;
    weight: number;
    price: number;
    discount_percent: number;
    stock_quantity: number;
    image_url: string;
    description: string;
  }>(null);
  const [products, setProducts] = useState<{
    id: string;
    name: string;
    category: string;
    purity: string;
    weight: number;
    price: number;
    discount_percent: number;
    stock_quantity: number;
    image_url: string;
    description: string;
    created_at?: string;
  }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();
  const [inStockOnly, setInStockOnly] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        const mapped = (data as DBProduct[]).map((p) => ({
          id: p.id,
          name: p.name,
          category: (p.category || 'unknown') as string,
          purity: (p.purity || 'N/A') as string,
          weight: p.weight ?? 0,
          price: p.price ?? 0,
          discount_percent: p.discount_percent ?? 0,
          stock_quantity: p.stock_qty ?? 0,
          image_url: p.image_url || '',
          description: p.description || '',
          created_at: p.created_at || undefined,
        }));
        setProducts(mapped);
      } catch (e: any) {
        setError(e?.message || 'Failed to load products');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const categories: { value: Category; label: string }[] = [
    { value: 'all', label: 'All Items' },
    { value: 'necklace', label: 'Necklaces' },
    { value: 'ring', label: 'Rings' },
    { value: 'bangle', label: 'Bangles' },
    { value: 'chain', label: 'Chains' },
    { value: 'earring', label: 'Earrings' },
    { value: 'pendant', label: 'Pendants' },
    { value: 'coin', label: 'Coins' },
    { value: 'bracelet', label: 'Bracelets' },
  ];

  const purities: Purity[] = ['all', '18K', '20K', '22K', '24K'];

  const filteredProducts = useMemo(() => {
    const base = products.filter((product) => {
      const q = debouncedQuery.toLowerCase();
      const matchesSearch = product.name.toLowerCase().includes(q);
      const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
      const matchesPurity = selectedPurity === 'all' || product.purity === selectedPurity;
      const matchesPrice = product.price >= priceRange[0] && product.price <= priceRange[1];
      const matchesWeight = product.weight >= weightRange[0] && product.weight <= weightRange[1];
      const matchesStock = !inStockOnly || product.stock_quantity > 0;
      return matchesSearch && matchesCategory && matchesPurity && matchesPrice && matchesWeight && matchesStock;
    });
    const sorted = [...base].sort((a, b) => {
      if (sortBy === 'price-asc') return a.price - b.price;
      if (sortBy === 'price-desc') return b.price - a.price;
      // newest
      const at = a.created_at ? Date.parse(a.created_at) : 0;
      const bt = b.created_at ? Date.parse(b.created_at) : 0;
      return bt - at;
    });
    return sorted;
  }, [products, debouncedQuery, selectedCategory, selectedPurity, priceRange, weightRange, inStockOnly, sortBy]);

  return (
    <div className="space-y-6">
        <div className="bg-gradient-to-r from-amber-500 to-yellow-600 rounded-2xl p-8 text-white shadow">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Discover Premium Jewelry</h1>
          <p className="text-amber-50">Handcrafted elegance, timeless beauty</p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search jewelry..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none transition-all"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center justify-center gap-2 px-5 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors shadow-sm"
            >
              <SlidersHorizontal className="w-5 h-5" />
              Filters
            </button>
          </div>

          {showFilters && (
            <div className="mt-5 pt-5 border-t border-gray-200 dark:border-gray-800 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Category</label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {categories.map(cat => (
                  <button
                    key={cat.value}
                    onClick={() => setSelectedCategory(cat.value)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      selectedCategory === cat.value
                        ? 'bg-amber-100 text-amber-700 font-medium'
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Purity</label>
              <div className="space-y-2">
                {purities.map(purity => (
                  <button
                    key={purity}
                    onClick={() => setSelectedPurity(purity)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      selectedPurity === purity
                        ? 'bg-amber-100 text-amber-700 font-medium'
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    {purity === 'all' ? 'All Purities' : purity}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Price Range: ₹{priceRange[0].toLocaleString()} - ₹{priceRange[1].toLocaleString()}
              </label>
              <input
                type="range"
                min="0"
                max="200000"
                step="10000"
                value={priceRange[1]}
                onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value)])}
                className="w-full accent-amber-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Weight Range: {weightRange[0]}g - {weightRange[1]}g
              </label>
              <input
                type="range"
                min="0"
                max="50"
                step="5"
                value={weightRange[1]}
                onChange={(e) => setWeightRange([weightRange[0], parseInt(e.target.value)])}
                className="w-full accent-amber-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Availability</label>
              <label className="inline-flex items-center gap-2 text-gray-700">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => setInStockOnly(e.target.checked)}
                  className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                />
                In stock only
              </label>
            </div>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <p className="text-gray-600 dark:text-gray-300">
            <span className="font-semibold text-gray-900 dark:text-white">{filteredProducts.length}</span> products found
          </p>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none"
            >
              <option value="newest">Newest First</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
            </select>
          </div>
        </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-md overflow-hidden animate-pulse">
              <div className="aspect-square bg-gray-200" />
              <div className="p-5 space-y-3">
                <div className="h-5 bg-gray-200 rounded w-3/4" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
                <div className="h-8 bg-gray-200 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-20 bg-white rounded-xl shadow-md text-red-600">{error}</div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl shadow-md">
          <p className="text-gray-500 text-lg">No products match your filters</p>
          <button
            onClick={() => {
              setSelectedCategory('all');
              setSelectedPurity('all');
              setPriceRange([0, 200000]);
              setWeightRange([0, 50]);
              setSearchQuery('');
            }}
            className="mt-4 px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              onViewDetails={() => setSelectedProduct(product)}
            />
          ))}
        </div>
      )}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
}
