import { useEffect, useState } from 'react';
import { Plus, X, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface ProductFormData {
  name: string;
  description: string;
  price: string;
  image: File | null;
}

interface ProductRecord {
  id: string;
  merchant_id: string;
  name: string;
  description: string;
  price: number | null;
  image_url: string | null;
  image_path: string | null;
  created_at?: string;
}

export default function Product() {
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<ProductRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductRecord | null>(null);
  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    description: '',
    price: '',
    image: null,
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
      image: null,
    });
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
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
      image: null,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (p: ProductRecord) => {
    // Open confirm modal instead of immediate delete
    setDeleteTarget(p);
  };

  const handleDeleteConfirm = async () => {
    if (!user || !deleteTarget) return;
    const p = deleteTarget;
    if (!user) return;
    try {
      // Delete DB row first
      const { error: delError } = await supabase
        .from('products')
        .delete()
        .eq('id', p.id)
        .eq('merchant_id', user.id);
      if (delError) throw delError;

      // Best-effort delete of image from storage
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

      if (editingProduct) {
        // Edit flow
        let image_path = editingProduct.image_path;
        let image_url = editingProduct.image_url;

        if (formData.image) {
          // New image uploaded: remove old image, upload new
          if (image_path) {
            await supabase.storage.from('product-images').remove([image_path]);
          }
          const uploaded = await uploadImage(formData.image, user.id);
          image_path = uploaded.image_path;
          image_url = uploaded.image_url;
        }

        const { data, error: updError } = await supabase
          .from('products')
          .update({
            name: formData.name,
            description: formData.description,
            price: priceNumber,
            image_path,
            image_url,
          })
          .eq('id', editingProduct.id)
          .eq('merchant_id', user.id)
          .select()
          .single();
        if (updError) throw updError;

        setProducts((prev) => prev.map((it) => (it.id === editingProduct.id ? (data as ProductRecord) : it)));
        handleCloseModal();
      } else {
        // Create flow
        let image_path: string | null = null;
        let image_url: string | null = null;

        if (formData.image) {
          const uploaded = await uploadImage(formData.image, user.id);
          image_path = uploaded.image_path;
          image_url = uploaded.image_url;
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
    <div className="min-h-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white">Products</h1>
          <button
            onClick={handleOpenModal}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-sm hover:shadow-md"
          >
            <Plus size={20} />
            Add Product
          </button>
        </div>

        {error && (
          <div className="mb-4 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-2 rounded">{error}</div>
        )}

        {products.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-slate-200 dark:border-gray-700">
            <p className="text-slate-600 dark:text-gray-300">No products yet. Click "Add Product" to create your first product.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((p) => (
              <div key={p.id} className="relative bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden border-2 border-slate-200 dark:border-gray-700">
                <div className="absolute top-2 right-2 flex gap-1 z-10">
                  <button
                    onClick={() => handleEditOpen(p)}
                    className="p-2 rounded-md bg-white/90 dark:bg-gray-900/80 border border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-800 shadow-sm"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4 text-slate-700 dark:text-gray-300" />
                  </button>
                  <button
                    onClick={() => handleDelete(p)}
                    className="p-2 rounded-md bg-white/90 dark:bg-gray-900/80 border border-slate-200 dark:border-gray-700 hover:bg-red-50 dark:hover:bg-red-900/30 shadow-sm"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>
                <div className="aspect-square bg-slate-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-slate-400 dark:text-gray-400">No Image</div>
                  )}
                </div>
                <div className="p-4 space-y-1">
                  <div className="font-semibold text-slate-800 dark:text-white truncate" title={p.name}>{p.name}</div>
                  <div className="text-sm text-slate-600 dark:text-gray-300 line-clamp-2" title={p.description}>{p.description}</div>
                  {p.price !== null && (
                    <div className="text-sm font-medium text-slate-900 dark:text-gray-100">₹ {p.price.toFixed(2)}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{editingProduct ? 'Edit Product' : 'Add Product'}</h2>
              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-5">
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2"
                  >
                    Product Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    placeholder="Enter product name"
                  />
                </div>

                <div>
                  <label
                    htmlFor="description"
                    className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2"
                  >
                    Description
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={4}
                    className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
                    placeholder="Enter product description"
                  />
                </div>

                <div>
                  <label
                    htmlFor="price"
                    className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2"
                  >
                    Price
                  </label>
                  <input
                    type="number"
                    id="price"
                    name="price"
                    value={formData.price}
                    onChange={handleInputChange}
                    required
                    step="0.01"
                    min="0"
                    className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label
                    htmlFor="image"
                    className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2"
                  >
                    Product Image
                  </label>
                  <input
                    type="file"
                    id="image"
                    name="image"
                    onChange={handleFileChange}
                    accept="image/*"
                    className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-6 py-2.5 border border-slate-300 dark:border-gray-700 text-slate-700 dark:text-gray-200 rounded-lg font-medium hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors shadow-sm hover:shadow-md"
                >
                  {submitting ? 'Saving...' : (editingProduct ? 'Save Changes' : 'Submit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Delete Product</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">Are you sure you want to delete "{deleteTarget.name}"? This action cannot be undone.</p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={handleDeleteCancel} className="px-5 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600">Cancel</button>
              <button onClick={handleDeleteConfirm} className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
