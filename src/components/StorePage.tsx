import { useEffect, useMemo, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import ProductCard from './ProductCard';
import ProductDetailModal from './ProductDetailModal';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';

type Category = string;
type Purity = string;
type MetalType = string;

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
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
  const [selectedPurities, setSelectedPurities] = useState<Purity[]>([]);
  const [selectedMetals, setSelectedMetals] = useState<MetalType[]>([]);
  const [priceMin, setPriceMin] = useState<number>(0);
  const [priceMax, setPriceMax] = useState<number>(200000);
  const [weightMin, setWeightMin] = useState<number>(0);
  const [weightMax, setWeightMax] = useState<number>(50);
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
    metal_type?: string;
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
          metal_type: p.metal_type || '',
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

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => { if (p.category) set.add(p.category); });
    return Array.from(set).sort().map(v => ({ value: v, label: v }));
  }, [products]);

  const purities: Purity[] = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => { if (p.purity) set.add(p.purity); });
    return Array.from(set).sort();
  }, [products]);

  const metals: MetalType[] = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => { if (p.metal_type) set.add(p.metal_type); });
    return Array.from(set).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    const base = products.filter((product) => {
      const q = debouncedQuery.toLowerCase();
      const matchesSearch = product.name.toLowerCase().includes(q) || product.description.toLowerCase().includes(q);
      const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(product.category as Category);
      const matchesPurity = selectedPurities.length === 0 || selectedPurities.includes(product.purity as Purity);
      const matchesMetal = selectedMetals.length === 0 || selectedMetals.includes((product.metal_type || '') as MetalType);
      const matchesPrice = product.price >= priceMin && product.price <= priceMax;
      const matchesWeight = product.weight >= weightMin && product.weight <= weightMax;
      const matchesStock = !inStockOnly || product.stock_quantity > 0;
      return matchesSearch && matchesCategory && matchesPurity && matchesMetal && matchesPrice && matchesWeight && matchesStock;
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
  }, [products, debouncedQuery, selectedCategories, selectedPurities, selectedMetals, priceMin, priceMax, weightMin, weightMax, inStockOnly, sortBy]);

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
            <div className="mt-5 pt-5 border-t border-gray-200 dark:border-gray-800 grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Category</label>
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {categories.map(cat => {
                    const checked = selectedCategories.includes(cat.value);
                    return (
                      <label key={cat.value} className="flex items-center gap-2 text-gray-700">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setSelectedCategories(prev => checked ? prev.filter(c => c !== cat.value) : [...prev, cat.value]);
                          }}
                          className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                        />
                        {cat.label}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Purity</label>
                <div className="space-y-2">
                  {purities.map(purity => {
                    const checked = selectedPurities.includes(purity);
                    return (
                      <label key={purity} className="flex items-center gap-2 text-gray-700">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setSelectedPurities(prev => checked ? prev.filter(p => p !== purity) : [...prev, purity]);
                          }}
                          className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                        />
                        {purity}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Metal Type</label>
                <div className="space-y-2">
                  {metals.map(m => {
                    const checked = selectedMetals.includes(m);
                    return (
                      <label key={m} className="flex items-center gap-2 text-gray-700">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setSelectedMetals(prev => checked ? prev.filter(x => x !== m) : [...prev, m]);
                          }}
                          className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                        />
                        {m}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Price (₹)</label>
                <div className="flex items-center gap-3">
                  <input type="number" value={priceMin} onChange={(e)=> setPriceMin(Number(e.target.value)||0)} min={0} className="w-24 px-3 py-2 border rounded" placeholder="Min" />
                  <span className="text-gray-400">—</span>
                  <input type="number" value={priceMax} onChange={(e)=> setPriceMax(Number(e.target.value)||0)} min={0} className="w-28 px-3 py-2 border rounded" placeholder="Max" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Weight (g)</label>
                <div className="flex items-center gap-3">
                  <input type="number" value={weightMin} onChange={(e)=> setWeightMin(Number(e.target.value)||0)} min={0} className="w-20 px-3 py-2 border rounded" placeholder="Min" />
                  <span className="text-gray-400">—</span>
                  <input type="number" value={weightMax} onChange={(e)=> setWeightMax(Number(e.target.value)||0)} min={0} className="w-20 px-3 py-2 border rounded" placeholder="Max" />
                </div>
                <div className="mt-3">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
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
              setSelectedCategories([]);
              setSelectedPurities([]);
              setSelectedMetals([]);
              setPriceMin(0);
              setPriceMax(200000);
              setWeightMin(0);
              setWeightMax(50);
              setSearchQuery('');
            }}
            className="mt-4 px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
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
