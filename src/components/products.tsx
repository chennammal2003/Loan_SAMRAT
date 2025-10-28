import { useEffect, useState } from 'react';
import { Plus, X, Pencil, Trash2, Eye, Gem, Weight, Package, TrendingDown, Box } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { fetchMetalRates, type MetalRates } from '../lib/metals';

interface ProductFormData {
  name: string;
  description: string;
  price: string;
  category: string;
  purity: string;
  weight: string;
  metalType: string;
  gemstone: string;
  discountPercent: string;
  stockQty: string;
  imageUrl: string;
  image: File | null;
  makingCharge: string;
}

interface ProductRecord {
  id: string;
  merchant_id: string;
  name: string;
  description: string;
  price: number | null;
  image_url: string | null;
  image_path: string | null;
  category?: string | null;
  purity?: string | null;
  weight?: number | null;
  metal_type?: string | null;
  gemstone?: string | null;
  discount_percent?: number | null;
  stock_qty?: number | null;
  created_at?: string;
}

export default function Product() {
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<ProductRecord | null>(null);
  const [viewingProduct, setViewingProduct] = useState<ProductRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductRecord | null>(null);
  // Filters state (client-side only)
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterPurity, setFilterPurity] = useState('');
  const [filterMetal, setFilterMetal] = useState('');
  const [filterGemstone, setFilterGemstone] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [rates, setRates] = useState<MetalRates | null>(null);
  const [ratesError, setRatesError] = useState<string | null>(null);
  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    description: '',
    price: '',
    category: '',
    purity: '',
    weight: '',
    metalType: '',
    gemstone: 'None',
    discountPercent: '',
    stockQty: '',
    imageUrl: '',
    image: null,
    makingCharge: '',
  });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('merchant_id', user.id)
        .order('created_at', { ascending: false });
      if (!error && data) setProducts(data as ProductRecord[]);
      if (error) {
        const msg = (error as any)?.message || String(error);
        const missing = msg.includes('schema cache') || msg.includes('does not exist');
        setError(
          missing
            ? 'Products table not found. Please create public.products in Supabase and add RLS policies (see instructions).'
            : msg
        );
      }
    })();
  }, [user]);

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setFormData({
      name: '',
      description: '',
      price: '',
      category: '',
      purity: '',
      weight: '',
      metalType: '',
      gemstone: 'None',
      discountPercent: '',
      stockQty: '',
      imageUrl: '',
      image: null,
      makingCharge: '',
    });
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setFormData((prev) => ({
      ...prev,
      image: file,
    }));
  };

  const uploadImage = async (file: File, ownerId: string) => {
    const fileName = `${crypto.randomUUID()}-${file.name.replace(/\s+/g, '-')}`;
    const image_path = `${ownerId}/${fileName}`;
    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(image_path, file, { upsert: false });
    if (uploadError) throw uploadError;
    const { data: publicUrl } = supabase.storage
      .from('product-images')
      .getPublicUrl(image_path);
    const image_url = publicUrl.publicUrl;
    return { image_path, image_url } as const;
  };

  const handleEditOpen = (p: ProductRecord) => {
    setEditingProduct(p);
    setFormData({
      name: p.name,
      description: p.description ?? '',
      price: p.price != null ? String(p.price) : '',
      category: p.category ?? '',
      purity: p.purity ?? '',
      weight: p.weight != null ? String(p.weight) : '',
      metalType: p.metal_type ?? '',
      gemstone: p.gemstone ?? 'None',
      discountPercent: p.discount_percent != null ? String(p.discount_percent) : '',
      stockQty: p.stock_qty != null ? String(p.stock_qty) : '',
      imageUrl: p.image_url ?? '',
      image: null,
      makingCharge: '',
    });
    setIsModalOpen(true);
  };

  const handleViewOpen = (p: ProductRecord) => {
    setViewingProduct(p);
  };

  const handleViewClose = () => {
    setViewingProduct(null);
  };

  const handleDelete = async (p: ProductRecord) => {
    setDeleteTarget(p);
  };

  const handleDeleteConfirm = async () => {
    if (!user || !deleteTarget) return;
    const p = deleteTarget;
    try {
      const { error: delError } = await supabase
        .from('products')
        .delete()
        .eq('id', p.id)
        .eq('merchant_id', user.id);
      if (delError) throw delError;

      if (p.image_path) {
        await supabase.storage.from('product-images').remove([p.image_path]);
      }

      setProducts((prev) => prev.filter((it) => it.id !== p.id));
      setDeleteTarget(null);
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      setError(`Delete failed: ${msg}`);
    }
  };

  const handleDeleteCancel = () => setDeleteTarget(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('You must be signed in to add products.');
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const priceNumber = formData.price ? Number(formData.price) : null;
      const weightNumber = formData.weight ? Number(formData.weight) : null;
      const discountNumber = formData.discountPercent ? Number(formData.discountPercent) : null;
      const stockQtyNumber = formData.stockQty ? Number(formData.stockQty) : null;

      if (editingProduct) {
        let image_path = editingProduct.image_path;
        let image_url = editingProduct.image_url;

        if (formData.image) {
          if (image_path) {
            await supabase.storage.from('product-images').remove([image_path]);
          }
          const uploaded = await uploadImage(formData.image, user.id);
          image_path = uploaded.image_path;
          image_url = uploaded.image_url;
        } else if (formData.imageUrl) {
          image_url = formData.imageUrl;
          image_path = editingProduct.image_path ?? null;
        }

        const { data, error: updError } = await supabase
          .from('products')
          .update({
            name: formData.name,
            description: formData.description,
            price: priceNumber,
            image_path,
            image_url,
            category: formData.category || null,
            purity: formData.purity || null,
            weight: weightNumber,
            metal_type: formData.metalType || null,
            gemstone: formData.gemstone || null,
            discount_percent: discountNumber,
            stock_qty: stockQtyNumber,
          })
          .eq('id', editingProduct.id)
          .eq('merchant_id', user.id)
          .select()
          .single();
        if (updError) throw updError;

        setProducts((prev) => prev.map((it) => (it.id === editingProduct.id ? (data as ProductRecord) : it)));
        handleCloseModal();
      } else {
        let image_path: string | null = null;
        let image_url: string | null = null;

        if (formData.image) {
          const uploaded = await uploadImage(formData.image, user.id);
          image_path = uploaded.image_path;
          image_url = uploaded.image_url;
        } else if (formData.imageUrl) {
          image_url = formData.imageUrl;
        }

        const { data, error: insertError } = await supabase
          .from('products')
          .insert({
            merchant_id: user.id,
            name: formData.name,
            description: formData.description,
            price: priceNumber,
            image_path,
            image_url,
            category: formData.category || null,
            purity: formData.purity || null,
            weight: weightNumber,
            metal_type: formData.metalType || null,
            gemstone: formData.gemstone || null,
            discount_percent: discountNumber,
            stock_qty: stockQtyNumber,
          })
          .select()
          .single();
        if (insertError) throw insertError;

        setProducts((prev) => [data as ProductRecord, ...prev]);
        handleCloseModal();
      }
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      const missing = msg.includes('schema cache') || msg.includes('does not exist');
      setError(
        missing
          ? 'Products table not found. Please create public.products in Supabase and add RLS policies (see instructions).'
          : msg
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-10 animate-fade-in">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">Products</h1>
            <p className="text-slate-600 dark:text-gray-400">Manage your jewelry collection</p>
          </div>
          <button
            onClick={handleOpenModal}
            className="group flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 rounded-xl font-medium transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
          >
            <Plus size={20} className="transition-transform group-hover:rotate-90 duration-300" />
            Add Product
          </button>
        </div>

        {/* Filters Bar */}
        <div className="mb-8 grid grid-cols-1 lg:grid-cols-12 gap-3 animate-fade-in">
          <div className="lg:col-span-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or description..."
              className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>
          <div className="lg:col-span-2">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            >
              <option value="">All Categories</option>
              <option>Necklace</option>
              <option>Ring</option>
              <option>Chain</option>
              <option>Bangle</option>
              <option>Earring</option>
              <option>Pendant</option>
              <option>Coin</option>
              <option>Bracelet</option>
            </select>
          </div>
          <div className="lg:col-span-2">
            <select
              value={filterPurity}
              onChange={(e) => setFilterPurity(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            >
              <option value="">All Purities</option>
              <option>18K</option>
              <option>20K</option>
              <option>22K</option>
              <option>24K</option>
            </select>
          </div>
          <div className="lg:col-span-2">
            <select
              value={filterMetal}
              onChange={(e) => setFilterMetal(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            >
              <option value="">All Metals</option>
              <option>Gold</option>
              <option>Silver</option>
              <option>Platinum</option>
            </select>
          </div>
          <div className="lg:col-span-1">
            <select
              value={filterGemstone}
              onChange={(e) => setFilterGemstone(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            >
              <option value="">Gemstone</option>
              <option>None</option>
              <option>Diamond</option>
              <option>Ruby</option>
              <option>Emerald</option>
              <option>Sapphire</option>
            </select>
          </div>
          <div className="lg:col-span-1">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              placeholder="Min ₹"
              className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>
          <div className="lg:col-span-1">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="Max ₹"
              className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>
          <div className="lg:col-span-1 flex gap-2">
            <button
              onClick={() => {
                setSearch('');
                setFilterCategory('');
                setFilterPurity('');
                setFilterMetal('');
                setFilterGemstone('');
                setMinPrice('');
                setMaxPrice('');
              }}
              className="w-full px-4 py-2.5 border-2 border-slate-300 dark:border-gray-700 text-slate-700 dark:text-gray-200 rounded-xl font-medium hover:bg-slate-50 dark:hover:bg-gray-800 transition-all"
            >
              Clear
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 rounded-xl animate-slide-up">{error}</div>
        )}

        {products.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-12 border border-slate-200 dark:border-gray-700 text-center animate-fade-in">
            <div className="w-20 h-20 bg-slate-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-10 h-10 text-slate-400 dark:text-gray-400" />
            </div>
            <p className="text-slate-600 dark:text-gray-300 text-lg">No products yet. Click "Add Product" to create your first product.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products
              .filter((p) => {
                const q = search.trim().toLowerCase();
                const matchesText = !q ||
                  p.name.toLowerCase().includes(q) ||
                  (p.description?.toLowerCase() || '').includes(q);
                const matchesCategory = !filterCategory || p.category === filterCategory;
                const matchesPurity = !filterPurity || p.purity === filterPurity;
                const matchesMetal = !filterMetal || p.metal_type === filterMetal;
                const matchesGem = !filterGemstone || (p.gemstone ?? '') === filterGemstone;
                const price = p.price ?? null;
                const minOk = !minPrice || (price !== null && price >= Number(minPrice));
                const maxOk = !maxPrice || (price !== null && price <= Number(maxPrice));
                return matchesText && matchesCategory && matchesPurity && matchesMetal && matchesGem && minOk && maxOk;
              })
              .map((p, index) => (
              <div
                key={p.id}
                className="product-card group relative bg-white dark:bg-gray-800 rounded-2xl shadow-md overflow-hidden border border-slate-200 dark:border-gray-700 cursor-pointer animate-fade-in transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-blue-200/60 dark:hover:border-blue-400/30 hover:shadow-blue-200/50 dark:hover:shadow-blue-900/20"
                style={{ animationDelay: `${index * 50}ms` }}
                onClick={() => handleViewOpen(p)}
              >
                <div className="absolute top-3 right-3 flex gap-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewOpen(p);
                    }}
                    className="p-2 rounded-lg bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-slate-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 shadow-lg transition-all duration-300 hover:scale-110"
                    title="View"
                  >
                    <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditOpen(p);
                    }}
                    className="p-2 rounded-lg bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-slate-200 dark:border-gray-700 hover:bg-amber-50 dark:hover:bg-amber-900/30 shadow-lg transition-all duration-300 hover:scale-110"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(p);
                    }}
                    className="p-2 rounded-lg bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-slate-200 dark:border-gray-700 hover:bg-red-50 dark:hover:bg-red-900/30 shadow-lg transition-all duration-300 hover:scale-110"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </button>
                </div>

                <div className="aspect-square bg-gradient-to-br from-slate-100 to-slate-200 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center overflow-hidden relative">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="product-image w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105" />
                  ) : (
                    <div className="text-slate-400 dark:text-gray-400 flex flex-col items-center gap-2">
                      <Package className="w-12 h-12" />
                      <span className="text-sm">No Image</span>
                    </div>
                  )}
                  {p.discount_percent && p.discount_percent > 0 && (
                    <div className="absolute top-3 left-3 bg-gradient-to-r from-red-500 to-pink-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg animate-pulse">
                      {p.discount_percent}% OFF
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-0 overflow-hidden">
                    <div className="absolute -left-1/3 top-0 h-full w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/10 -skew-x-12 transition-transform duration-700 ease-out group-hover:translate-x-[180%]"></div>
                  </div>
                </div>

                <div className="p-5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white truncate flex-1" title={p.name}>
                      {p.name}
                    </h3>
                    {p.category && (
                      <span className="text-xs bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-gray-300 px-2 py-1 rounded-lg font-medium whitespace-nowrap">
                        {p.category}
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-slate-600 dark:text-gray-400 line-clamp-2 min-h-[40px]" title={p.description}>
                    {p.description}
                  </p>

                  <div className="flex items-center gap-3 pt-2">
                    {p.purity && (
                      <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-gray-400">
                        <Gem className="w-3.5 h-3.5" />
                        <span>{p.purity}</span>
                      </div>
                    )}
                    {p.weight !== null && (
                      <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-gray-400">
                        <Weight className="w-3.5 h-3.5" />
                        <span>{p.weight}g</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-gray-700">
                    {p.price !== null ? (
                      <div className="flex flex-col">
                        <span className="text-2xl font-bold text-slate-900 dark:text-white">
                          ₹{p.price.toLocaleString('en-IN')}
                        </span>
                        {p.discount_percent && p.discount_percent > 0 && (
                          <span className="text-xs text-slate-500 dark:text-gray-400 line-through">
                            ₹{(p.price / (1 - p.discount_percent / 100)).toFixed(0)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-slate-500 dark:text-gray-400">Price not set</span>
                    )}
                    {p.stock_qty != null && (
                      <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg ${
                        p.stock_qty! > 10
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : p.stock_qty! > 0
                          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                          : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                      }`}>
                        <Box className="w-3.5 h-3.5" />
                        <span>{p.stock_qty}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {viewingProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" onClick={handleViewClose}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              <button
                onClick={handleViewClose}
                className="absolute top-4 right-4 z-10 p-2 rounded-xl bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm text-slate-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-900 shadow-lg transition-all duration-300 hover:scale-110"
              >
                <X size={24} />
              </button>

              <div className="grid md:grid-cols-2 gap-0">
                <div className="aspect-square bg-gradient-to-br from-slate-100 to-slate-200 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center relative overflow-hidden">
                  {viewingProduct.image_url ? (
                    <img src={viewingProduct.image_url} alt={viewingProduct.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-slate-400 dark:text-gray-400 flex flex-col items-center gap-3">
                      <Package className="w-20 h-20" />
                      <span>No Image</span>
                    </div>
                  )}
                  {viewingProduct.discount_percent && viewingProduct.discount_percent > 0 && (
                    <div className="absolute top-4 left-4 bg-gradient-to-r from-red-500 to-pink-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg">
                      {viewingProduct.discount_percent}% OFF
                    </div>
                  )}
                </div>

                <div className="p-8 space-y-6">
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{viewingProduct.name}</h2>
                      {viewingProduct.category && (
                        <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-3 py-1 rounded-lg text-sm font-medium">
                          {viewingProduct.category}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-600 dark:text-gray-400 leading-relaxed">{viewingProduct.description}</p>
                  </div>

                  {viewingProduct.price !== null && (
                    <div className="border-t border-b border-slate-200 dark:border-gray-700 py-4">
                      <div className="flex items-baseline gap-3">
                        <span className="text-4xl font-bold text-slate-900 dark:text-white">
                          ₹{viewingProduct.price.toLocaleString('en-IN')}
                        </span>
                        {viewingProduct.discount_percent && viewingProduct.discount_percent > 0 && (
                          <span className="text-lg text-slate-500 dark:text-gray-400 line-through">
                            ₹{(viewingProduct.price / (1 - viewingProduct.discount_percent / 100)).toFixed(0)}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    {viewingProduct.metal_type && (
                      <div className="bg-slate-50 dark:bg-gray-900/50 rounded-xl p-4">
                        <div className="text-sm text-slate-600 dark:text-gray-400 mb-1">Metal Type</div>
                        <div className="font-semibold text-slate-900 dark:text-white">{viewingProduct.metal_type}</div>
                      </div>
                    )}
                    {viewingProduct.purity && (
                      <div className="bg-slate-50 dark:bg-gray-900/50 rounded-xl p-4">
                        <div className="text-sm text-slate-600 dark:text-gray-400 mb-1 flex items-center gap-1">
                          <Gem className="w-4 h-4" />
                          Purity
                        </div>
                        <div className="font-semibold text-slate-900 dark:text-white">{viewingProduct.purity}</div>
                      </div>
                    )}
                    {viewingProduct.weight !== null && (
                      <div className="bg-slate-50 dark:bg-gray-900/50 rounded-xl p-4">
                        <div className="text-sm text-slate-600 dark:text-gray-400 mb-1 flex items-center gap-1">
                          <Weight className="w-4 h-4" />
                          Weight
                        </div>
                        <div className="font-semibold text-slate-900 dark:text-white">{viewingProduct.weight}g</div>
                      </div>
                    )}
                    {viewingProduct.gemstone && viewingProduct.gemstone !== 'None' && (
                      <div className="bg-slate-50 dark:bg-gray-900/50 rounded-xl p-4">
                        <div className="text-sm text-slate-600 dark:text-gray-400 mb-1">Gemstone</div>
                        <div className="font-semibold text-slate-900 dark:text-white">{viewingProduct.gemstone}</div>
                      </div>
                    )}
                    {viewingProduct.stock_qty != null && (
                      <div className="bg-slate-50 dark:bg-gray-900/50 rounded-xl p-4">
                        <div className="text-sm text-slate-600 dark:text-gray-400 mb-1 flex items-center gap-1">
                          <Box className="w-4 h-4" />
                          Stock
                        </div>
                        <div className={`font-semibold ${
                          viewingProduct.stock_qty! > 10
                            ? 'text-green-600 dark:text-green-400'
                            : viewingProduct.stock_qty! > 0
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {viewingProduct.stock_qty} units
                        </div>
                      </div>
                    )}
                    {viewingProduct.discount_percent && viewingProduct.discount_percent > 0 && (
                      <div className="bg-slate-50 dark:bg-gray-900/50 rounded-xl p-4">
                        <div className="text-sm text-slate-600 dark:text-gray-400 mb-1 flex items-center gap-1">
                          <TrendingDown className="w-4 h-4" />
                          Discount
                        </div>
                        <div className="font-semibold text-red-600 dark:text-red-400">{viewingProduct.discount_percent}%</div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => {
                        handleViewClose();
                        handleEditOpen(viewingProduct);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
                    >
                      <Pencil size={18} />
                      Edit Product
                    </button>
                    <button
                      onClick={() => {
                        handleViewClose();
                        handleDelete(viewingProduct);
                      }}
                      className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-medium transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-slide-up">
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{editingProduct ? 'Edit Product' : 'Add Product'}</h2>
              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors hover:scale-110"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-5">
                {(() => {
                  // Lazy init: fetch rates on modal open
                  if (rates === null && !ratesError) {
                    const ctrl = new AbortController();
                    fetchMetalRates(ctrl.signal)
                      .then((d) => setRates(d))
                      .catch((e) => setRatesError(e?.message || 'Failed to load metal rates'));
                  }
                  return null;
                })()}
                {ratesError && (
                  <div className="text-sm text-red-600 dark:text-red-400">{ratesError}</div>
                )}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                    Product Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    placeholder="Enter product name"
                  />
                </div>

                <div>
                  <label htmlFor="category" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Category</label>
                  <select
                    id="category"
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  >
                    <option value="" disabled>Select category</option>
                    <option>Necklace</option>
                    <option>Ring</option>
                    <option>Chain</option>
                    <option>Bangle</option>
                    <option>Earring</option>
                    <option>Pendant</option>
                    <option>Coin</option>
                    <option>Bracelet</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={4}
                    className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
                    placeholder="Enter product description"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="purity" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Purity</label>
                    <select
                      id="purity"
                      name="purity"
                      value={formData.purity}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    >
                      <option value="" disabled>Select purity</option>
                      <option>18K</option>
                      <option>20K</option>
                      <option>22K</option>
                      <option>24K</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="metalType" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Metal Type</label>
                    <select
                      id="metalType"
                      name="metalType"
                      value={formData.metalType}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    >
                      <option value="" disabled>Select metal</option>
                      <option>Gold</option>
                      <option>Silver</option>
                      <option>Platinum</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="makingCharge" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Making Charge (₹)</label>
                    <input
                      type="number"
                      id="makingCharge"
                      name="makingCharge"
                      value={formData.makingCharge}
                      onChange={handleInputChange}
                      step="0.01"
                      min="0"
                      className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      placeholder="e.g., 1500"
                    />
                  </div>
                  <div>
                    <label htmlFor="price" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Final Price (₹)</label>
                    <input
                      type="number"
                      id="price"
                      name="price"
                      value={formData.price}
                      onChange={handleInputChange}
                      required
                      step="0.01"
                      min="0"
                      className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                {(() => {
                  const weight = parseFloat(formData.weight || '0');
                  const making = parseFloat(formData.makingCharge || '0');
                  const metal = formData.metalType;
                  const purity = formData.purity;
                  let perGram = 0;
                  if (rates) {
                    if (metal === 'Gold') {
                      const karat = purity.endsWith('K') ? parseInt(purity) : 24;
                      const base24 = rates.perGram.gold24k;
                      perGram = base24 * (karat / 24);
                    } else if (metal === 'Silver') {
                      perGram = rates.perGram.silver;
                    }
                  }
                  const suggested = perGram > 0 && weight > 0 ? perGram * weight + making : null;
                  return (
                    <div className="rounded-xl border border-slate-200 dark:border-gray-700 p-3 text-sm flex items-center justify-between">
                      <div className="text-slate-600 dark:text-gray-300">
                        {rates ? (
                          suggested != null ? (
                            <span>Suggested price from live rate: <b>₹{Math.round(suggested).toLocaleString('en-IN')}</b></span>
                          ) : (
                            <span>Enter metal, purity, and weight to see suggested price</span>
                          )
                        ) : (
                          <span>Fetching live metal rates…</span>
                        )}
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={() => {
                            if (suggested != null) {
                              setFormData((prev) => ({ ...prev, price: String(Math.round(suggested)) }));
                            }
                          }}
                          className="px-3 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-60"
                          disabled={suggested == null}
                        >
                          Use live price
                        </button>
                      </div>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="weight" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Weight (g)</label>
                    <input
                      type="number"
                      id="weight"
                      name="weight"
                      value={formData.weight}
                      onChange={handleInputChange}
                      required
                      step="0.01"
                      min="0"
                      className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      placeholder="e.g., 15"
                    />
                  </div>
                  <div>
                    <label htmlFor="gemstone" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Gemstone</label>
                    <select
                      id="gemstone"
                      name="gemstone"
                      value={formData.gemstone}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    >
                      <option>None</option>
                      <option>Diamond</option>
                      <option>Ruby</option>
                      <option>Emerald</option>
                      <option>Sapphire</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="discountPercent" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Discount (%)</label>
                    <input
                      type="number"
                      id="discountPercent"
                      name="discountPercent"
                      value={formData.discountPercent}
                      onChange={handleInputChange}
                      min="0"
                      max="100"
                      step="0.01"
                      className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      placeholder="e.g., 5"
                    />
                  </div>
                  <div>
                    <label htmlFor="stockQty" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Stock Quantity</label>
                    <input
                      type="number"
                      id="stockQty"
                      name="stockQty"
                      value={formData.stockQty}
                      onChange={handleInputChange}
                      min="0"
                      step="1"
                      required
                      className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      placeholder="e.g., 10"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="image" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                    Product Image
                  </label>
                  <input
                    type="url"
                    id="imageUrl"
                    name="imageUrl"
                    value={formData.imageUrl}
                    onChange={handleInputChange}
                    placeholder="Paste image URL (optional)"
                    className="mb-3 w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                  <input
                    type="file"
                    id="image"
                    name="image"
                    onChange={handleFileChange}
                    accept="image/*"
                    className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-6 py-3 border-2 border-slate-300 dark:border-gray-700 text-slate-700 dark:text-gray-200 rounded-xl font-medium hover:bg-slate-50 dark:hover:bg-gray-800 transition-all duration-300 hover:scale-105"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
                >
                  {submitting ? 'Saving...' : (editingProduct ? 'Save Changes' : 'Add Product')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-slide-up">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Delete Product</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">Are you sure you want to delete "{deleteTarget.name}"? This action cannot be undone.</p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={handleDeleteCancel} className="px-6 py-2.5 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-300 font-medium">Cancel</button>
              <button onClick={handleDeleteConfirm} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white transition-all duration-300 shadow-lg hover:shadow-xl font-medium">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
