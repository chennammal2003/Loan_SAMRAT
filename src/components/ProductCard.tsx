import { ShoppingCart, Eye, Tag, Heart } from 'lucide-react';
import { useWishlist } from '../contexts/WishlistContext';
import { useCart } from '../contexts/CartContext';

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

interface ProductCardProps {
  product: Product;
  onViewDetails: () => void;
}

export default function ProductCard({ product, onViewDetails }: ProductCardProps) {
  const basePrice = typeof product.price === 'number' ? product.price : 0;
  const dp = typeof product.discount_percent === 'number' ? product.discount_percent : 0;
  const discountedPrice = dp > 0 ? basePrice - (basePrice * dp / 100) : basePrice;
  const isInStock = product.stock_quantity > 0;
  const { toggle, has } = useWishlist();
  const wished = has(product.id);
  const { add } = useCart();

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 group" role="article" aria-label={product.name}>
      <div className="relative overflow-hidden aspect-[4/3] bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-gray-800 dark:to-gray-800">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-amber-600/60">No Image</div>
        )}
        {product.discount_percent > 0 && (
          <div className="absolute top-3 right-3 z-10 bg-gradient-to-r from-red-500 to-pink-500 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg flex items-center gap-1" title={`${product.discount_percent}% OFF`}>
            <Tag className="w-4 h-4" />
            {product.discount_percent}% OFF
          </div>
        )}
        {!isInStock && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="bg-red-500 text-white px-4 py-2 rounded-lg font-bold">Out of Stock</span>
          </div>
        )}
        <button
          type="button"
          onClick={onViewDetails}
          aria-label={`View details of ${product.name}`}
          className="absolute top-3 left-3 bg-white/90 dark:bg-gray-800/80 backdrop-blur-sm p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-white dark:hover:bg-gray-800 hover:scale-110"
        >
          <Eye className="w-5 h-5 text-amber-600" />
        </button>
        <button
          type="button"
          onClick={() => toggle(product.id)}
          aria-label={wished ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
          className={`absolute ${product.discount_percent > 0 ? 'top-12 right-3' : 'top-3 right-3'} p-2 rounded-full shadow-lg transition-all duration-300 ${wished ? 'bg-rose-500 text-white' : 'bg-white/90 backdrop-blur-sm hover:bg-white'}`}
        >
          <Heart className={`w-5 h-5 ${wished ? 'fill-current' : 'text-rose-500'}`} />
        </button>
      </div>

      <div className="p-4 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-gray-800 dark:text-gray-100 text-base line-clamp-2 flex-1">
            {product.name}
          </h3>
          <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-md text-xs font-semibold whitespace-nowrap">
            {product.purity}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-300">Weight</span>
          <span className="font-semibold text-gray-800 dark:text-gray-100">{product.weight}g</span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-300">Stock</span>
          <span className={`font-semibold ${isInStock ? 'text-green-600' : 'text-red-600'}`}>
            {isInStock ? `${product.stock_quantity} available` : 'Out of stock'}
          </span>
        </div>

        <div className="pt-2.5 border-t border-gray-100 dark:border-gray-800">
          {product.discount_percent > 0 ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-gray-400 dark:text-gray-500 text-sm line-through">
                  ₹{basePrice.toLocaleString()}
                </span>
                <span className="text-green-600 font-bold text-sm">
                  Save ₹{(basePrice - discountedPrice).toLocaleString()}
                </span>
              </div>
              <div className="text-xl font-bold bg-gradient-to-r from-amber-600 to-yellow-600 bg-clip-text text-transparent">
                ₹{discountedPrice.toLocaleString()}
              </div>
            </div>
          ) : (
            <div className="text-xl font-bold bg-gradient-to-r from-amber-600 to-yellow-600 bg-clip-text text-transparent">
              ₹{basePrice.toLocaleString()}
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            disabled={!isInStock}
            className={`flex-1 py-2.5 rounded-lg font-semibold transition-all duration-200 ${
              isInStock
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white shadow-md hover:shadow-lg'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
            aria-disabled={!isInStock}
            aria-label={isInStock ? `Buy ${product.name} now` : `${product.name} is out of stock`}
            onClick={isInStock ? onViewDetails : undefined}
          >
            Buy Now
          </button>
          <button
            type="button"
            disabled={!isInStock}
            className={`p-2.5 rounded-lg transition-all duration-200 ${
              isInStock
                ? 'bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
            }`}
            aria-disabled={!isInStock}
            aria-label={isInStock ? `Add ${product.name} to cart` : `${product.name} is out of stock`}
            onClick={isInStock ? () => add({ id: product.id, name: product.name, price: discountedPrice, image_url: product.image_url }) : undefined}
          >
            <ShoppingCart className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
