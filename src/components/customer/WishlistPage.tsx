import React, { useEffect, useState } from 'react';
import ProductCard from '../ProductCard';
import ProductDetailModal from '../ProductDetailModal';
import { useWishlist } from '../../contexts/WishlistContext';
import { supabase } from '../../lib/supabase';

interface Product {
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
}

export default function WishlistPage() {
  const { ids } = useWishlist();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    (async () => {
      if (ids.length === 0) {
        setProducts([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .in('id', ids);
        if (error) throw error;
        setProducts((data || []) as unknown as Product[]);
      } catch (e: any) {
        setError(e?.message || 'Failed to load wishlist');
      } finally {
        setLoading(false);
      }
    })();
  }, [ids]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Wishlist</h1>
        <div className="text-sm text-gray-600 dark:text-gray-400">{ids.length} items</div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-md dark:shadow-lg overflow-hidden animate-pulse">
              <div className="aspect-square bg-gray-200 dark:bg-gray-700" />
              <div className="p-5 space-y-3">
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-xl shadow-md dark:shadow-lg text-red-600 dark:text-red-400">{error}</div>
      ) : products.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-xl shadow-md dark:shadow-lg">
          <p className="text-gray-600 dark:text-gray-400 text-lg">Your wishlist is empty.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} onViewDetails={() => setSelectedProduct(p)} />
          ))}
        </div>
      )}

      {selectedProduct && (
        <ProductDetailModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}
    </div>
  );
}
