import { useEffect, useMemo, useState } from 'react';
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
  color: string;
  dimensions: string;
  warranty: string;
  sku: string;
  tags: string;
  shippingCharge: string;
  // A. Making & Delivery
  makingTime: string;
  deliveryTime: string;
  // B. Certification
  hallmarkCertNumber: string;
  bisHallmarkType: string;
  // C. Weight Breakdown
  netWeight: string;
  stoneWeight: string;
  wastageWeight: string;
  // D. Stone Details
  stoneType: string;
  stoneCount: string;
  stoneClarity: string;
  stoneCut: string;
  stoneSettingType: string;
  // E. Size & Measurements
  ringSize: string;
  chainLength: string;
  bangleSize: string;
  // F. Design Type
  designType: string; // Traditional, Modern, ...
  // G. Occasion
  occasion: string; // Wedding, Engagement, ...
  // H. Metal Finish
  metalFinish: string; // Yellow Gold, White Gold, ...
  // I. Weight Type
  weightType: string; // Gross/Net
  // J. Gender
  gender: string; // Men/Women/Unisex/Kids
  // K. Return Policy
  returnAllowed: string; // Yes/No
  returnPeriod: string; // text/number of days
  // L. Certification Upload
  certificateUrl: string;
  certificateFile: File | null;
  // M. Customization
  customizable: string; // Yes/No
  customMessage: string;
  // N. Making Type
  makingType: string; // Handmade/Machine-made/Casting
  // O. Packaging
  packaging: string; // Premium Box/Standard Box/Gift Pouch
  // P. Product Video
  productVideoUrl: string;
  productVideoFile: File | null;
  // Q. Care Instructions
  careInstructions: string;
  // R. Availability
  availability: string; // Ready Stock/Made on Order
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
  color?: string | null;
  dimensions?: string | null;
  warranty?: string | null;
  sku?: string | null;
  tags?: string | null; // comma separated
  shipping_charge?: number | null;
  making_time?: string | null;
  delivery_time?: string | null;
  hallmark_cert_number?: string | null;
  bis_hallmark_type?: string | null;
  net_weight?: number | null;
  stone_weight?: number | null;
  wastage_weight?: number | null;
  stone_type?: string | null;
  stone_count?: number | null;
  stone_clarity?: string | null;
  stone_cut?: string | null;
  stone_setting_type?: string | null;
  ring_size?: string | null;
  chain_length?: string | null;
  bangle_size?: string | null;
  design_type?: string | null;
  occasion?: string | null;
  metal_finish?: string | null;
  weight_type?: string | null;
  gender?: string | null;
  return_allowed?: boolean | null;
  return_period?: string | null;
  certificate_url?: string | null;
  making_type?: string | null;
  packaging?: string | null;
  product_video_url?: string | null;
  care_instructions?: string | null;
  availability?: string | null;
}

type ProductsSubTab = 'list' | 'stock' | 'variantStock';

export default function Product() {
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<ProductRecord | null>(null);
  const [viewingProduct, setViewingProduct] = useState<ProductRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductRecord | null>(null);
  const [activeTab, setActiveTab] = useState<ProductsSubTab>('list');
  const [stockEdits, setStockEdits] = useState<Record<string, string>>({});
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
  const [currentStep, setCurrentStep] = useState(0);
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
    color: '',
    dimensions: '',
    warranty: '',
    sku: '',
    tags: '',
    shippingCharge: '',
    makingTime: '',
    deliveryTime: '',
    hallmarkCertNumber: '',
    bisHallmarkType: '',
    netWeight: '',
    stoneWeight: '',
    wastageWeight: '',
    stoneType: '',
    stoneCount: '',
    stoneClarity: '',
    stoneCut: '',
    stoneSettingType: '',
    ringSize: '',
    chainLength: '',
    bangleSize: '',
    designType: '',
    occasion: '',
    metalFinish: '',
    weightType: '',
    gender: '',
    returnAllowed: 'No',
    returnPeriod: '',
    certificateUrl: '',
    certificateFile: null,
    customizable: 'No',
    customMessage: '',
    makingType: '',
    packaging: '',
    productVideoUrl: '',
    productVideoFile: null,
    careInstructions: '',
    availability: '',
  });

  const purityOptions = useMemo(() => {
    switch (formData.metalType) {
      case 'Gold':
        return ['14K', '18K', '20K', '22K', '24K'];
      case 'Silver':
        return ['925', '958', '999'];
      case 'Platinum':
        return ['900', '950', '999'];
      default:
        return [] as string[];
    }
  }, [formData.metalType]);

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

  // Reflect product list into inline stock edit buffer whenever products change
  useEffect(() => {
    const next: Record<string, string> = {};
    for (const p of products) {
      next[p.id] = p.stock_qty != null ? String(p.stock_qty) : '';
    }
    setStockEdits(next);
  }, [products]);

  const handleOpenModal = () => {
    setIsModalOpen(true);
    setCurrentStep(0);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setCurrentStep(0);
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
      color: '',
      dimensions: '',
      warranty: '',
      sku: '',
      tags: '',
      shippingCharge: '',
      makingTime: '',
      deliveryTime: '',
      hallmarkCertNumber: '',
      bisHallmarkType: '',
      netWeight: '',
      stoneWeight: '',
      wastageWeight: '',
      stoneType: '',
      stoneCount: '',
      stoneClarity: '',
      stoneCut: '',
      stoneSettingType: '',
      ringSize: '',
      chainLength: '',
      bangleSize: '',
      designType: '',
      occasion: '',
      metalFinish: '',
      weightType: '',
      gender: '',
      returnAllowed: 'No',
      returnPeriod: '',
      certificateUrl: '',
      certificateFile: null,
      customizable: 'No',
      customMessage: '',
      makingType: '',
      packaging: '',
      productVideoUrl: '',
      productVideoFile: null,
      careInstructions: '',
      availability: '',
    });
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === 'metalType' ? { purity: '' } : {}),
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setFormData((prev) => ({
      ...prev,
      image: file,
    }));
  };

  const handleCertificateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setFormData((prev) => ({ ...prev, certificateFile: file }));
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setFormData((prev) => ({ ...prev, productVideoFile: file }));
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

  const uploadFileToBucket = async (bucket: string, file: File, ownerId: string) => {
    const fileName = `${crypto.randomUUID()}-${file.name.replace(/\s+/g, '-')}`;
    const file_path = `${ownerId}/${fileName}`;
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(file_path, file, { upsert: false });
    if (uploadError) throw uploadError;
    const { data: publicUrl } = supabase.storage
      .from(bucket)
      .getPublicUrl(file_path);
    const url = publicUrl.publicUrl;
    return { file_path, url } as const;
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
      color: p.color ?? '',
      dimensions: p.dimensions ?? '',
      warranty: p.warranty ?? '',
      sku: p.sku ?? '',
      tags: p.tags ?? '',
      shippingCharge: p.shipping_charge != null ? String(p.shipping_charge) : '',
      makingTime: p.making_time ?? '',
      deliveryTime: p.delivery_time ?? '',
      hallmarkCertNumber: p.hallmark_cert_number ?? '',
      bisHallmarkType: p.bis_hallmark_type ?? '',
      netWeight: p.net_weight != null ? String(p.net_weight) : '',
      stoneWeight: p.stone_weight != null ? String(p.stone_weight) : '',
      wastageWeight: p.wastage_weight != null ? String(p.wastage_weight) : '',
      stoneType: p.stone_type ?? '',
      stoneCount: p.stone_count != null ? String(p.stone_count) : '',
      stoneClarity: p.stone_clarity ?? '',
      stoneCut: p.stone_cut ?? '',
      stoneSettingType: p.stone_setting_type ?? '',
      ringSize: p.ring_size ?? '',
      chainLength: p.chain_length ?? '',
      bangleSize: p.bangle_size ?? '',
      designType: p.design_type ?? '',
      occasion: p.occasion ?? '',
      metalFinish: p.metal_finish ?? '',
      weightType: p.weight_type ?? '',
      gender: p.gender ?? '',
      returnAllowed: p.return_allowed ? 'Yes' : 'No',
      returnPeriod: p.return_period ?? '',
      certificateUrl: p.certificate_url ?? '',
      certificateFile: null,
      customizable: 'No',
      customMessage: '',
      makingType: p.making_type ?? '',
      packaging: p.packaging ?? '',
      productVideoUrl: p.product_video_url ?? '',
      productVideoFile: null,
      careInstructions: p.care_instructions ?? '',
      availability: p.availability ?? '',
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
      const shippingNumber = formData.shippingCharge ? Number(formData.shippingCharge) : null;
      const netWeightNumber = formData.netWeight ? Number(formData.netWeight) : null;
      const stoneWeightNumber = formData.stoneWeight ? Number(formData.stoneWeight) : null;
      const wastageWeightNumber = formData.wastageWeight ? Number(formData.wastageWeight) : null;
      const stoneCountNumber = formData.stoneCount ? Number(formData.stoneCount) : null;

      if (editingProduct) {
        let image_path = editingProduct.image_path;
        let image_url = editingProduct.image_url;
        let certificate_url = editingProduct.certificate_url ?? null;
        let product_video_url = editingProduct.product_video_url ?? null;

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

        if (formData.certificateFile) {
          const uploaded = await uploadFileToBucket('product-certificates', formData.certificateFile, user.id);
          certificate_url = uploaded.url;
        } else if (formData.certificateUrl) {
          certificate_url = formData.certificateUrl;
        }

        if (formData.productVideoFile) {
          const uploaded = await uploadFileToBucket('product-videos', formData.productVideoFile, user.id);
          product_video_url = uploaded.url;
        } else if (formData.productVideoUrl) {
          product_video_url = formData.productVideoUrl;
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
            color: formData.color || null,
            dimensions: formData.dimensions || null,
            warranty: formData.warranty || null,
            sku: formData.sku || null,
            tags: formData.tags || null,
            shipping_charge: shippingNumber,
            making_time: formData.makingTime || null,
            delivery_time: formData.deliveryTime || null,
            hallmark_cert_number: formData.hallmarkCertNumber || null,
            bis_hallmark_type: formData.bisHallmarkType || null,
            net_weight: netWeightNumber,
            stone_weight: stoneWeightNumber,
            wastage_weight: wastageWeightNumber,
            stone_type: formData.stoneType || null,
            stone_count: stoneCountNumber,
            stone_clarity: formData.stoneClarity || null,
            stone_cut: formData.stoneCut || null,
            stone_setting_type: formData.stoneSettingType || null,
            ring_size: formData.ringSize || null,
            chain_length: formData.chainLength || null,
            bangle_size: formData.bangleSize || null,
            design_type: formData.designType || null,
            occasion: formData.occasion || null,
            metal_finish: formData.metalFinish || null,
            weight_type: formData.weightType || null,
            gender: formData.gender || null,
            return_allowed: formData.returnAllowed.toLowerCase() === 'yes',
            return_period: formData.returnPeriod || null,
            certificate_url: certificate_url,
            making_type: formData.makingType || null,
            packaging: formData.packaging || null,
            product_video_url: product_video_url,
            care_instructions: formData.careInstructions || null,
            availability: formData.availability || null,
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
        let certificate_url: string | null = null;
        let product_video_url: string | null = null;

        if (formData.image) {
          const uploaded = await uploadImage(formData.image, user.id);
          image_path = uploaded.image_path;
          image_url = uploaded.image_url;
        } else if (formData.imageUrl) {
          image_url = formData.imageUrl;
        }

        if (formData.certificateFile) {
          const uploaded = await uploadFileToBucket('product-certificates', formData.certificateFile, user.id);
          certificate_url = uploaded.url;
        } else if (formData.certificateUrl) {
          certificate_url = formData.certificateUrl;
        }

        if (formData.productVideoFile) {
          const uploaded = await uploadFileToBucket('product-videos', formData.productVideoFile, user.id);
          product_video_url = uploaded.url;
        } else if (formData.productVideoUrl) {
          product_video_url = formData.productVideoUrl;
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
            color: formData.color || null,
            dimensions: formData.dimensions || null,
            warranty: formData.warranty || null,
            sku: formData.sku || null,
            tags: formData.tags || null,
            shipping_charge: shippingNumber,
            making_time: formData.makingTime || null,
            delivery_time: formData.deliveryTime || null,
            hallmark_cert_number: formData.hallmarkCertNumber || null,
            bis_hallmark_type: formData.bisHallmarkType || null,
            net_weight: netWeightNumber,
            stone_weight: stoneWeightNumber,
            wastage_weight: wastageWeightNumber,
            stone_type: formData.stoneType || null,
            stone_count: stoneCountNumber,
            stone_clarity: formData.stoneClarity || null,
            stone_cut: formData.stoneCut || null,
            stone_setting_type: formData.stoneSettingType || null,
            ring_size: formData.ringSize || null,
            chain_length: formData.chainLength || null,
            bangle_size: formData.bangleSize || null,
            design_type: formData.designType || null,
            occasion: formData.occasion || null,
            metal_finish: formData.metalFinish || null,
            weight_type: formData.weightType || null,
            gender: formData.gender || null,
            return_allowed: formData.returnAllowed.toLowerCase() === 'yes',
            return_period: formData.returnPeriod || null,
            certificate_url: certificate_url,
            making_type: formData.makingType || null,
            packaging: formData.packaging || null,
            product_video_url: product_video_url,
            care_instructions: formData.careInstructions || null,
            availability: formData.availability || null,
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
        <div className="flex justify-between items-center mb-6 animate-fade-in">
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

        {/* Sub-tabs */}
        <div className="mb-8 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2 rounded-lg border ${
              activeTab === 'list'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-gray-900 text-slate-700 dark:text-gray-200 border-slate-300 dark:border-gray-700'
            }`}
          >
            Product List
          </button>
          <button
            onClick={() => setActiveTab('stock')}
            className={`px-4 py-2 rounded-lg border ${
              activeTab === 'stock'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-gray-900 text-slate-700 dark:text-gray-200 border-slate-300 dark:border-gray-700'
            }`}
          >
            Stock Update
          </button>
          <button
            onClick={() => setActiveTab('variantStock')}
            className={`px-4 py-2 rounded-lg border ${
              activeTab === 'variantStock'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-gray-900 text-slate-700 dark:text-gray-200 border-slate-300 dark:border-gray-700'
            }`}
          >
            Variant Stock Update
          </button>
        </div>

        {activeTab === 'list' && (
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
        )}

        {error && (
          <div className="mb-6 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 rounded-xl animate-slide-up">{error}</div>
        )}
        {info && (
          <div className="mb-6 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3 rounded-xl animate-slide-up">{info}</div>
        )}

        {activeTab === 'list' && (products.length === 0 ? (
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
        ))}

        {activeTab === 'stock' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-gray-700 font-semibold">Update Stock</div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-gray-700">
                <thead className="bg-slate-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wider">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wider">Current</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wider">New Stock</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-slate-200 dark:divide-gray-700">
                  {products.map((p) => {
                    const current = p.stock_qty ?? 0;
                    const inputVal = stockEdits[p.id] ?? '';
                    const hasChange = inputVal !== (p.stock_qty != null ? String(p.stock_qty) : '');
                    return (
                      <tr key={p.id}>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 dark:bg-gray-700 flex items-center justify-center">
                              {p.image_url ? (
                                <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                              ) : (
                                <Package className="w-6 h-6 text-slate-400" />
                              )}
                            </div>
                            <div>
                              <div className="font-medium text-slate-900 dark:text-white">{p.name}</div>
                              {p.sku && <div className="text-xs text-slate-500 dark:text-gray-400">SKU: {p.sku}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-slate-700 dark:text-gray-200">{current}</td>
                        <td className="px-6 py-3">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={inputVal}
                            onChange={(e) => setStockEdits((prev) => ({ ...prev, [p.id]: e.target.value }))}
                            className="w-28 px-3 py-2 rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100"
                          />
                        </td>
                        <td className="px-6 py-3 text-right">
                          <button
                            disabled={!hasChange}
                            onClick={async () => {
                              if (!user) return;
                              setError(null);
                              setInfo(null);
                              const nextVal = stockEdits[p.id];
                              const parsed = nextVal === '' ? null : Number(nextVal);
                              try {
                                const { data, error } = await supabase
                                  .from('products')
                                  .update({ stock_qty: parsed })
                                  .eq('id', p.id)
                                  .eq('merchant_id', user.id)
                                  .select()
                                  .single();
                                if (error) throw error;
                                setProducts((prev) => prev.map((it) => (it.id === p.id ? (data as ProductRecord) : it)));
                                setInfo('Stock updated');
                              } catch (e: any) {
                                const msg = e?.message || 'Failed to update stock';
                                setError(msg);
                              }
                            }}
                            className={`px-4 py-2 rounded-lg font-medium ${
                              hasChange
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'bg-slate-200 dark:bg-gray-700 text-slate-500 dark:text-gray-400 cursor-not-allowed'
                            }`}
                          >
                            Save
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'variantStock' && (
          <div className="rounded-2xl border border-slate-200 dark:border-gray-700 p-6 bg-white dark:bg-gray-800">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Variant Stock Update</h3>
            <p className="text-slate-600 dark:text-gray-300">
              Variants are not defined in the current schema. If you plan to manage
              sizes, colors, or other options per product, we can add a
              `product_variants` table and wire editing here.
            </p>
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
                  <div className="grid grid-cols-2 gap-4">
                    {viewingProduct.color && (
                      <div className="bg-slate-50 dark:bg-gray-900/50 rounded-xl p-4">
                        <div className="text-sm text-slate-600 dark:text-gray-400 mb-1">Color</div>
                        <div className="font-semibold text-slate-900 dark:text-white">{viewingProduct.color}</div>
                      </div>
                    )}
                    {viewingProduct.dimensions && (
                      <div className="bg-slate-50 dark:bg-gray-900/50 rounded-xl p-4">
                        <div className="text-sm text-slate-600 dark:text-gray-400 mb-1">Dimensions</div>
                        <div className="font-semibold text-slate-900 dark:text-white">{viewingProduct.dimensions}</div>
                      </div>
                    )}
                    {viewingProduct.warranty && (
                      <div className="bg-slate-50 dark:bg-gray-900/50 rounded-xl p-4">
                        <div className="text-sm text-slate-600 dark:text-gray-400 mb-1">Warranty</div>
                        <div className="font-semibold text-slate-900 dark:text-white">{viewingProduct.warranty}</div>
                      </div>
                    )}
                    {viewingProduct.sku && (
                      <div className="bg-slate-50 dark:bg-gray-900/50 rounded-xl p-4">
                        <div className="text-sm text-slate-600 dark:text-gray-400 mb-1">SKU</div>
                        <div className="font-semibold text-slate-900 dark:text-white">{viewingProduct.sku}</div>
                      </div>
                    )}
                    {viewingProduct.tags && (
                      <div className="bg-slate-50 dark:bg-gray-900/50 rounded-xl p-4 col-span-2">
                        <div className="text-sm text-slate-600 dark:text-gray-400 mb-2">Tags</div>
                        <div className="flex flex-wrap gap-2">
                          {viewingProduct.tags.split(',').map((t) => (
                            <span key={t.trim()} className="text-xs bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-gray-300 px-2 py-1 rounded-lg font-medium">
                              {t.trim()}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {viewingProduct.shipping_charge != null && (
                      <div className="bg-slate-50 dark:bg-gray-900/50 rounded-xl p-4 col-span-2">
                        <div className="text-sm text-slate-600 dark:text-gray-400 mb-1">Shipping Charge</div>
                        <div className="font-semibold text-slate-900 dark:text-white">₹{Number(viewingProduct.shipping_charge).toLocaleString('en-IN')}</div>
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
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden animate-slide-up">
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{editingProduct ? 'Edit Product' : 'Add Product'}</h2>
              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors hover:scale-110"
              >
                <X size={24} />
              </button>
            </div>

            <div className="px-6 pt-4">
              <ol className="grid grid-cols-5 gap-2">
                {['Product Type','Details','Specification','SEO','Pricing'].map((label, idx) => (
                  <li key={label} className={`text-xs sm:text-sm px-3 py-2 rounded-lg border ${idx === currentStep ? 'border-blue-600 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-300'}`}>{label}</li>
                ))}
              </ol>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[70vh]">
              {(() => {
                if (rates === null && !ratesError) {
                  const ctrl = new AbortController();
                  fetchMetalRates(ctrl.signal)
                    .then((d) => setRates(d))
                    .catch((e) => setRatesError(e?.message || 'Failed to load metal rates'));
                }
                return null;
              })()}
              {ratesError && (
                <div className="mb-3 text-sm text-red-600 dark:text-red-400">{ratesError}</div>
              )}

              {currentStep === 0 && (
                <div className="space-y-5">
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
              )}

              {currentStep === 1 && (
                <div className="space-y-5">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Product Name</label>
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
                    <label htmlFor="description" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Description</label>
                    <textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      rows={5}
                      className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
                      placeholder="Enter product description"
                    />
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="purity" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">{formData.metalType === 'Gold' ? 'Purity (Karat)' : formData.metalType ? 'Purity (Fineness)' : 'Purity'}</label>
                      <select
                        id="purity"
                        name="purity"
                        value={formData.purity}
                        onChange={handleInputChange}
                        required
                        disabled={!formData.metalType}
                        className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all disabled:opacity-60"
                      >
                        <option value="" disabled>{formData.metalType ? 'Select purity' : 'Select metal first'}</option>
                        {purityOptions.map((opt) => (
                          <option key={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="color" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Color</label>
                      <input
                        id="color"
                        name="color"
                        type="text"
                        value={formData.color}
                        onChange={handleInputChange}
                        placeholder="e.g., Yellow Gold"
                        className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label htmlFor="dimensions" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Dimensions</label>
                      <input
                        id="dimensions"
                        name="dimensions"
                        type="text"
                        value={formData.dimensions}
                        onChange={handleInputChange}
                        placeholder="e.g., 20mm x 15mm"
                        className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="warranty" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Warranty</label>
                      <input
                        id="warranty"
                        name="warranty"
                        type="text"
                        value={formData.warranty}
                        onChange={handleInputChange}
                        placeholder="e.g., 1 year"
                        className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label htmlFor="sku" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">SKU</label>
                      <input
                        id="sku"
                        name="sku"
                        type="text"
                        value={formData.sku}
                        onChange={handleInputChange}
                        placeholder="Internal SKU"
                        className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="tags" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Tags</label>
                    <input
                      id="tags"
                      name="tags"
                      type="text"
                      value={formData.tags}
                      onChange={handleInputChange}
                      placeholder="Comma-separated, e.g., bridal,lightweight"
                      className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>

                  {/* A. Making & Delivery */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Making Time</label>
                      <input name="makingTime" value={formData.makingTime} onChange={handleInputChange} placeholder="e.g., 7 days" className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Delivery Time</label>
                      <input name="deliveryTime" value={formData.deliveryTime} onChange={handleInputChange} placeholder="e.g., 3-5 days" className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl" />
                    </div>
                  </div>

                  {/* B. Certification */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Hallmark Certification Number</label>
                      <input name="hallmarkCertNumber" value={formData.hallmarkCertNumber} onChange={handleInputChange} className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">BIS Hallmark Type</label>
                      <input name="bisHallmarkType" value={formData.bisHallmarkType} onChange={handleInputChange} className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl" />
                    </div>
                  </div>

                  {/* C. Weight Breakdown */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Net Weight (g)</label>
                      <input type="number" step="0.01" min="0" name="netWeight" value={formData.netWeight} onChange={handleInputChange} className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Stone Weight (g)</label>
                      <input type="number" step="0.01" min="0" name="stoneWeight" value={formData.stoneWeight} onChange={handleInputChange} className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Wastage Weight (g)</label>
                      <input type="number" step="0.01" min="0" name="wastageWeight" value={formData.wastageWeight} onChange={handleInputChange} className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl" />
                    </div>
                  </div>

                  {/* D. Stone Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Stone Type</label>
                      <input name="stoneType" value={formData.stoneType} onChange={handleInputChange} className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Stone Count</label>
                      <input type="number" min="0" step="1" name="stoneCount" value={formData.stoneCount} onChange={handleInputChange} className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Stone Clarity</label>
                      <input name="stoneClarity" value={formData.stoneClarity} onChange={handleInputChange} className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Stone Cut</label>
                      <input name="stoneCut" value={formData.stoneCut} onChange={handleInputChange} className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Stone Setting Type</label>
                      <input name="stoneSettingType" value={formData.stoneSettingType} onChange={handleInputChange} className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl" />
                    </div>
                  </div>

                  {/* E. Size & Measurements */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Ring Size</label>
                      <input name="ringSize" value={formData.ringSize} onChange={handleInputChange} className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Chain Length</label>
                      <input name="chainLength" value={formData.chainLength} onChange={handleInputChange} className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Bangle Size</label>
                      <input name="bangleSize" value={formData.bangleSize} onChange={handleInputChange} className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl" />
                    </div>
                  </div>

                  {/* F, G, H selections */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Design Type</label>
                      <select name="designType" value={formData.designType} onChange={handleInputChange} className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl"><option value="">Select</option><option>Traditional</option><option>Modern</option><option>Antique</option><option>Temple</option><option>Daily Wear</option></select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Occasion</label>
                      <select name="occasion" value={formData.occasion} onChange={handleInputChange} className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl"><option value="">Select</option><option>Wedding</option><option>Engagement</option><option>Casual</option><option>Festival</option><option>Gift</option></select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Metal Finish</label>
                      <select name="metalFinish" value={formData.metalFinish} onChange={handleInputChange} className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl"><option value="">Select</option><option>Yellow Gold</option><option>White Gold</option><option>Rose Gold</option><option>Oxidised Silver</option></select>
                    </div>
                  </div>

                  {/* I. Weight Type & J. Gender */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Weight Type</label>
                      <select name="weightType" value={formData.weightType} onChange={handleInputChange} className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl"><option value="">Select</option><option>Gross Weight</option><option>Net Weight</option></select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Gender</label>
                      <select name="gender" value={formData.gender} onChange={handleInputChange} className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl"><option value="">Select</option><option>Men</option><option>Women</option><option>Unisex</option><option>Kids</option></select>
                    </div>
                  </div>

                  {/* K. Return Policy & M. Customization */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Return Allowed</label>
                      <select name="returnAllowed" value={formData.returnAllowed} onChange={handleInputChange} className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl"><option>No</option><option>Yes</option></select>
                      <input placeholder="Return Period (e.g., 7 days)" name="returnPeriod" value={formData.returnPeriod} onChange={handleInputChange} className="mt-2 w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Customizable</label>
                      <select name="customizable" value={formData.customizable} onChange={handleInputChange} className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl"><option>No</option><option>Yes</option></select>
                      <input placeholder="Custom Message/Engraving" name="customMessage" value={formData.customMessage} onChange={handleInputChange} className="mt-2 w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl" />
                    </div>
                  </div>

                  {/* N. Making Type, O. Packaging, Q. Care, R. Availability */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Making Type</label>
                      <select name="makingType" value={formData.makingType} onChange={handleInputChange} className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl"><option value="">Select</option><option>Handmade</option><option>Machine-made</option><option>Casting</option></select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Packaging</label>
                      <select name="packaging" value={formData.packaging} onChange={handleInputChange} className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl"><option value="">Select</option><option>Premium Box</option><option>Standard Box</option><option>Gift Pouch</option></select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Care Instructions</label>
                      <textarea name="careInstructions" value={formData.careInstructions} onChange={handleInputChange} rows={3} className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Availability</label>
                      <select name="availability" value={formData.availability} onChange={handleInputChange} className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl"><option value="">Select</option><option>Ready Stock</option><option>Made on Order</option></select>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-5">
                  <div>
                    <label htmlFor="imageUrl" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Image URL (optional)</label>
                    <input
                      type="url"
                      id="imageUrl"
                      name="imageUrl"
                      value={formData.imageUrl}
                      onChange={handleInputChange}
                      placeholder="Paste image URL"
                      className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label htmlFor="image" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Upload Image</label>
                    <input
                      type="file"
                      id="image"
                      name="image"
                      onChange={handleFileChange}
                      accept="image/*"
                      className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Upload Certificate (PDF/Image)</label>
                    <input type="file" accept="image/*,application/pdf" onChange={handleCertificateChange} className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl" />
                    <input type="url" placeholder="Or certificate URL" value={formData.certificateUrl} onChange={(e) => setFormData((p) => ({ ...p, certificateUrl: e.target.value }))} className="mt-2 w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Upload Video (optional)</label>
                    <input type="file" accept="video/*" onChange={handleVideoChange} className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl" />
                    <input type="url" placeholder="Or video URL" value={formData.productVideoUrl} onChange={(e) => setFormData((p) => ({ ...p, productVideoUrl: e.target.value }))} className="mt-2 w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl" />
                  </div>
                </div>
              )}

              {currentStep === 4 && (
                <div className="space-y-5">
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
                    <label htmlFor="shippingCharge" className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Shipping Charge (₹)</label>
                    <input
                      type="number"
                      id="shippingCharge"
                      name="shippingCharge"
                      value={formData.shippingCharge}
                      onChange={handleInputChange}
                      min="0"
                      step="0.01"
                      className="w-full px-4 py-2.5 border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      placeholder="e.g., 99"
                    />
                  </div>
                </div>
              )}

              <div className="mt-8 flex gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-6 py-3 border-2 border-slate-300 dark:border-gray-700 text-slate-700 dark:text-gray-200 rounded-xl font-medium hover:bg-slate-50 dark:hover:bg-gray-800 transition-all duration-300"
                >
                  Cancel
                </button>
                {currentStep > 0 && (
                  <button
                    type="button"
                    onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
                    className="px-6 py-3 rounded-xl border border-slate-300 dark:border-gray-700 text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-800 transition-all"
                  >
                    Back
                  </button>
                )}
                {currentStep < 4 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentStep((s) => Math.min(4, s + 1))}
                    className="ml-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all duration-300 shadow-lg hover:shadow-xl"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="ml-auto px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all duration-300 shadow-lg hover:shadow-xl"
                  >
                    {submitting ? 'Saving...' : (editingProduct ? 'Save Changes' : 'Add Product')}
                  </button>
                )}
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
