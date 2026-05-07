'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Edit3,
  Eye,
  ImagePlus,
  PackagePlus,
  RefreshCw,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  X,
} from 'lucide-react';

import { apiClient } from '@/lib/api';
import MediaUploadField from '@/components/MediaUploadField';
import { uploadAsset } from '@/lib/uploads';
import type {
  StoreOrderAdmin,
  StoreOrderStatus,
  StoreProductAdmin,
  UpsertStoreProductRequest,
} from '@/lib/types';
import { Input } from '@/ui/input';
import { Button } from '@/ui/Button';
import { Badge } from '@/ui/Badge';

const PAGE_SIZE = 10;
const ORDER_STATUSES: StoreOrderStatus[] = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

const emptyProductForm: UpsertStoreProductRequest = {
  name: '',
  category: 'clothing',
  price: '',
  originalPrice: '',
  image: '',
  description: '',
  sizes: [],
  colors: [],
  tags: [],
  stock: 0,
  isActive: true,
};

function splitCsv(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function moneyFromPrice(value: string): number {
  const numeric = Number(String(value || '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(numeric) ? numeric : 0;
}

function statusVariant(status: StoreOrderStatus): 'success' | 'warning' | 'primary' | 'outline' {
  if (status === 'delivered') return 'success';
  if (status === 'cancelled') return 'warning';
  if (status === 'processing' || status === 'shipped') return 'primary';
  if (status === 'pending') return 'warning';
  return 'outline';
}

function titleCase(value: string): string {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function ShellCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] shadow-sm ${className}`}>
      {children}
    </section>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-8 text-center">
      <p className="text-sm font-black text-[var(--color-text-primary)]">{title}</p>
      <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">{description}</p>
    </div>
  );
}

function StatCard({ label, value, hint, icon, tone }: { label: string; value: number | string; hint: string; icon: ReactNode; tone: string }) {
  return (
    <ShellCard className="p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-xs font-black uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">{label}</p>
          <p className="mt-3 text-3xl font-black text-[var(--color-text-primary)]">{value}</p>
          <p className="mt-2 line-clamp-2 text-sm text-[var(--color-text-secondary)]">{hint}</p>
        </div>
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tone}`}>{icon}</div>
      </div>
    </ShellCard>
  );
}

function ProductImage({ src, alt }: { src: string; alt: string }) {
  if (!src) {
    return (
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-background-tertiary)] text-[var(--color-text-tertiary)]">
        <ImagePlus className="h-5 w-5" />
      </div>
    );
  }

  return (
    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)]">
      <Image src={src} alt={alt} fill className="object-cover" sizes="64px" unoptimized />
    </div>
  );
}

function ProductDrawer({ product, onClose, onEdit }: { product: StoreProductAdmin; onClose: () => void; onEdit: (item: StoreProductAdmin) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 p-0 backdrop-blur-sm">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close product drawer" onClick={onClose} />
      <aside className="relative h-full w-full max-w-xl overflow-y-auto border-l border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-5 py-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">Product overview</p>
            <h2 className="mt-1 text-lg font-black text-[var(--color-text-primary)]">{product.name}</h2>
          </div>
          <button type="button" className="rounded-2xl p-2 text-[var(--color-text-tertiary)] hover:bg-[var(--color-background-secondary)]" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          {product.image ? (
            <div className="relative h-72 overflow-hidden rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)]">
              <Image src={product.image} alt={product.name} fill className="object-cover" sizes="(max-width: 768px) 100vw, 560px" unoptimized />
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <InfoTile label="Category" value={product.category || 'Uncategorized'} />
            <InfoTile label="Price" value={product.price || 'Not set'} />
            <InfoTile label="Stock" value={String(product.stock)} />
            <InfoTile label="Status" value={product.isActive ? 'Active' : 'Inactive'} />
          </div>

          <div className="rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">Description</p>
            <p className="mt-3 whitespace-pre-line break-words text-sm leading-7 text-[var(--color-text-secondary)]">{product.description || 'No description provided.'}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {[...(product.sizes || []), ...(product.colors || []), ...(product.tags || [])].map((item) => (
              <span key={`${product.id}-${item}`} className="rounded-full border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-3 py-1 text-xs font-bold text-[var(--color-text-secondary)]">
                {item}
              </span>
            ))}
          </div>

          <div className="flex justify-end border-t border-[var(--color-border-secondary)] pt-5">
            <Button onClick={() => onEdit(product)} icon={<Edit3 className="h-4 w-4" />}>Edit product</Button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">{label}</p>
      <p className="mt-2 break-words text-sm font-bold text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
}

export default function StoreDashboardPage() {
  const [products, setProducts] = useState<StoreProductAdmin[]>([]);
  const [orders, setOrders] = useState<StoreOrderAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingProduct, setSavingProduct] = useState(false);
  const [orderBusy, setOrderBusy] = useState<string | null>(null);
  const [stockBusy, setStockBusy] = useState<number | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<StoreProductAdmin | null>(null);

  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [productForm, setProductForm] = useState<UpsertStoreProductRequest>(emptyProductForm);
  const [productImageFile, setProductImageFile] = useState<File | null>(null);
  const [productImagePreview, setProductImagePreview] = useState<string | null>(null);
  const [sizesCsv, setSizesCsv] = useState('');
  const [colorsCsv, setColorsCsv] = useState('');
  const [tagsCsv, setTagsCsv] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<StoreOrderStatus | ''>('');
  const [productQuery, setProductQuery] = useState('');
  const [productFilter, setProductFilter] = useState<'all' | 'active' | 'low' | 'inactive'>('all');
  const [productPage, setProductPage] = useState(1);

  const lowStockProducts = useMemo(() => products.filter((p) => p.isActive && p.stock <= 5), [products]);
  const activeProducts = useMemo(() => products.filter((p) => p.isActive), [products]);
  const totalInventoryValue = useMemo(() => products.reduce((sum, item) => sum + moneyFromPrice(item.price) * Number(item.stock || 0), 0), [products]);

  const filteredProducts = useMemo(() => {
    const needle = productQuery.trim().toLowerCase();
    return products
      .filter((item) => {
        if (productFilter === 'active') return item.isActive;
        if (productFilter === 'inactive') return !item.isActive;
        if (productFilter === 'low') return item.isActive && item.stock <= 5;
        return true;
      })
      .filter((item) => {
        if (!needle) return true;
        return `${item.name} ${item.category} ${item.price} ${(item.tags || []).join(' ')}`.toLowerCase().includes(needle);
      });
  }, [productFilter, productQuery, products]);

  const productTotalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const paginatedProducts = filteredProducts.slice((productPage - 1) * PAGE_SIZE, productPage * PAGE_SIZE);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [productsData, ordersData] = await Promise.all([
        apiClient.listStoreProductsAdmin(true),
        apiClient.listStoreOrders({ page: 1, limit: 30, status: orderStatusFilter }),
      ]);

      setProducts(Array.isArray(productsData) ? productsData : []);
      setOrders(Array.isArray(ordersData.data) ? ordersData.data : []);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to load store dashboard'));
    } finally {
      setLoading(false);
    }
  }, [orderStatusFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    setProductPage(1);
  }, [productQuery, productFilter]);

  useEffect(() => {
    return () => {
      if (productImagePreview) URL.revokeObjectURL(productImagePreview);
    };
  }, [productImagePreview]);

  const resetForm = () => {
    setEditingProductId(null);
    setProductForm(emptyProductForm);
    setProductImageFile(null);
    if (productImagePreview) URL.revokeObjectURL(productImagePreview);
    setProductImagePreview(null);
    setSizesCsv('');
    setColorsCsv('');
    setTagsCsv('');
  };

  const onEditProduct = (item: StoreProductAdmin) => {
    if (productImagePreview) URL.revokeObjectURL(productImagePreview);
    setSelectedProduct(null);
    setEditingProductId(item.id);
    setProductImageFile(null);
    setProductImagePreview(null);
    setProductForm({
      name: item.name,
      category: item.category,
      price: item.price,
      originalPrice: item.originalPrice || '',
      image: item.image,
      description: item.description,
      sizes: item.sizes || [],
      colors: item.colors || [],
      tags: item.tags || [],
      stock: item.stock,
      isActive: item.isActive,
    });
    setSizesCsv((item.sizes || []).join(', '));
    setColorsCsv((item.colors || []).join(', '));
    setTagsCsv((item.tags || []).join(', '));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleProductImageFile = (file: File | null) => {
    setProductImageFile(file);
    if (productImagePreview) URL.revokeObjectURL(productImagePreview);
    setProductImagePreview(file ? URL.createObjectURL(file) : null);
  };

  const saveProduct = async () => {
    if (!productForm.name.trim() || !productForm.price.trim() || (!productForm.image.trim() && !productImageFile)) {
      toast.error('Name, price, and image are required.');
      return;
    }

    try {
      setSavingProduct(true);
      let image = productForm.image.trim();

      if (productImageFile) {
        const ownerId = editingProductId ? String(editingProductId) : productForm.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const uploaded = await uploadAsset(productImageFile, {
          kind: 'image',
          module: 'store',
          ownerType: 'store-product',
          ownerId,
          folder: `store/products/${ownerId}/images`,
        });
        image = uploaded.publicUrl || uploaded.url;
      }

      const payload: UpsertStoreProductRequest = {
        ...productForm,
        name: productForm.name.trim(),
        category: productForm.category.trim() || 'general',
        price: productForm.price.trim(),
        image,
        description: productForm.description.trim(),
        originalPrice: productForm.originalPrice?.trim() || undefined,
        sizes: splitCsv(sizesCsv),
        colors: splitCsv(colorsCsv),
        tags: splitCsv(tagsCsv),
        stock: Number(productForm.stock || 0),
      };

      if (editingProductId) {
        await apiClient.updateStoreProduct(editingProductId, payload);
        toast.success('Product updated');
      } else {
        await apiClient.createStoreProduct(payload);
        toast.success('Product created');
      }

      resetForm();
      await loadData();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Unable to save product'));
    } finally {
      setSavingProduct(false);
    }
  };

  const setProductStock = async (id: number, nextStock: number) => {
    if (nextStock < 0) return;

    try {
      setStockBusy(id);
      await apiClient.updateStoreProductStock(id, nextStock);
      await loadData();
      toast.success('Stock updated');
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Unable to update stock'));
    } finally {
      setStockBusy(null);
    }
  };

  const toggleProductActive = async (id: number, isActive: boolean) => {
    try {
      await apiClient.updateStoreProductActive(id, !isActive);
      await loadData();
      toast.success(isActive ? 'Product deactivated' : 'Product activated');
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Unable to update product status'));
    }
  };

  const updateOrderStatus = async (orderId: string, status: StoreOrderStatus) => {
    try {
      setOrderBusy(orderId);
      await apiClient.updateStoreOrderStatus(orderId, status);
      await loadData();
      toast.success('Order status updated');
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Unable to update order status'));
    } finally {
      setOrderBusy(null);
    }
  };

  if (loading && products.length === 0 && orders.length === 0) {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <div className="text-center">
          <RefreshCw className="mx-auto h-8 w-8 animate-spin text-[var(--color-text-tertiary)]" />
          <p className="mt-3 text-sm font-semibold text-[var(--color-text-secondary)]">Loading store dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ShellCard className="overflow-hidden">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="p-6 sm:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                  <ShoppingBag className="h-4 w-4" />
                  Store operations
                </div>
                <h1 className="mt-4 text-2xl font-black tracking-tight text-[var(--color-text-primary)] sm:text-3xl">Products, stock, and order workflow</h1>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--color-text-secondary)]">
                  Manage live products, inventory alerts, and customer order movement without mock data or disconnected workflows.
                </p>
              </div>
              <Button variant="outline" onClick={() => void loadData()} loading={loading} icon={<RefreshCw className="h-4 w-4" />}>
                Refresh
              </Button>
            </div>
          </div>
          <div className="border-t border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-5 xl:border-l xl:border-t-0">
            <div className="rounded-3xl bg-[var(--color-background-primary)] p-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">Inventory value</p>
              <p className="mt-3 text-3xl font-black text-[var(--color-text-primary)]">₦{totalInventoryValue.toLocaleString()}</p>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Estimated from saved product prices and stock.</p>
            </div>
          </div>
        </div>
      </ShellCard>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Products" value={products.length} hint={`${activeProducts.length} active product${activeProducts.length === 1 ? '' : 's'}`} icon={<Boxes className="h-5 w-5" />} tone="bg-blue-500/10 text-blue-700" />
        <StatCard label="Low stock" value={lowStockProducts.length} hint="Active items at 5 units or lower" icon={<AlertTriangle className="h-5 w-5" />} tone="bg-amber-500/10 text-amber-700" />
        <StatCard label="Orders loaded" value={orders.length} hint="Current backend order page" icon={<ClipboardList className="h-5 w-5" />} tone="bg-indigo-500/10 text-indigo-700" />
        <StatCard label="Delivered" value={orders.filter((order) => order.status === 'delivered').length} hint="Completed orders in current view" icon={<CheckCircle2 className="h-5 w-5" />} tone="bg-emerald-500/10 text-emerald-700" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(360px,440px)_minmax(0,1fr)]">
        <ShellCard className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-[var(--color-text-primary)]">{editingProductId ? 'Edit product' : 'Create product'}</h2>
              <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">Upload product media and update inventory metadata.</p>
            </div>
            {editingProductId ? <Badge variant="primary">Editing</Badge> : <Badge variant="outline">New</Badge>}
          </div>

          <div className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <Input label="Name" value={productForm.name} onChange={(e) => setProductForm((p) => ({ ...p, name: e.target.value }))} />
              <Input label="Category" value={productForm.category} onChange={(e) => setProductForm((p) => ({ ...p, category: e.target.value }))} />
              <Input label="Price" value={productForm.price} onChange={(e) => setProductForm((p) => ({ ...p, price: e.target.value }))} placeholder="e.g. ₦6,000" />
              <Input label="Original price" value={productForm.originalPrice || ''} onChange={(e) => setProductForm((p) => ({ ...p, originalPrice: e.target.value }))} />
            </div>

            <Input label="Image URL" value={productForm.image} onChange={(e) => setProductForm((p) => ({ ...p, image: e.target.value }))} />
            <MediaUploadField field={{ key: 'image', label: 'Product image', type: 'image', validation: { max: 5 } }} value={productImageFile} onChange={handleProductImageFile} />

            {(productImagePreview || productForm.image.trim()) ? (
              <div className="relative h-48 overflow-hidden rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)]">
                <Image src={productImagePreview || productForm.image.trim()} alt="Product image preview" fill className="object-cover" sizes="(max-width: 768px) 100vw, 440px" unoptimized />
              </div>
            ) : null}

            <div>
              <label className="mb-1 block text-sm font-semibold text-[var(--color-text-secondary)]">Description</label>
              <textarea
                className="min-h-28 w-full rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-border-focus)] focus:ring-2 focus:ring-[var(--color-border-focus)]/20"
                value={productForm.description}
                onChange={(e) => setProductForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>

            <Input label="Sizes" value={sizesCsv} onChange={(e) => setSizesCsv(e.target.value)} placeholder="Small, Medium, Large" />
            <Input label="Colors" value={colorsCsv} onChange={(e) => setColorsCsv(e.target.value)} placeholder="Black, White, Gold" />
            <Input label="Tags" value={tagsCsv} onChange={(e) => setTagsCsv(e.target.value)} placeholder="shirt, conference, merch" />
            <Input label="Stock" type="number" min={0} value={String(productForm.stock)} onChange={(e) => setProductForm((p) => ({ ...p, stock: Number(e.target.value || 0) }))} />

            <label className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4 text-sm">
              <span className="font-bold text-[var(--color-text-secondary)]">Product is active</span>
              <input type="checkbox" className="h-5 w-5 accent-[var(--color-accent-primary)]" checked={productForm.isActive} onChange={(e) => setProductForm((p) => ({ ...p, isActive: e.target.checked }))} />
            </label>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button loading={savingProduct} onClick={saveProduct} icon={<PackagePlus className="h-4 w-4" />}>
                {editingProductId ? 'Update Product' : 'Create Product'}
              </Button>
              <Button variant="outline" onClick={resetForm}>Reset</Button>
            </div>
          </div>
        </ShellCard>

        <ShellCard className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-black text-[var(--color-text-primary)]">Product inventory</h2>
              <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">Search, inspect, edit, activate, and update stock.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,260px)_150px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
                <Input className="pl-9" placeholder="Search products" value={productQuery} onChange={(e) => setProductQuery(e.target.value)} />
              </div>
              <select
                className="rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value as typeof productFilter)}
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="low">Low stock</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-3xl border border-[var(--color-border-secondary)]">
            <div className="hidden grid-cols-[minmax(240px,1fr)_120px_160px_190px] gap-4 bg-[var(--color-background-secondary)] px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-[var(--color-text-tertiary)] lg:grid">
              <div>Product</div><div>Stock</div><div>Status</div><div className="text-right">Actions</div>
            </div>

            <div className="divide-y divide-[var(--color-border-secondary)]">
              {paginatedProducts.map((item) => (
                <article key={item.id} className="grid gap-4 px-4 py-4 transition hover:bg-[var(--color-background-secondary)] lg:grid-cols-[minmax(240px,1fr)_120px_160px_190px] lg:items-center">
                  <button type="button" className="flex min-w-0 items-center gap-3 text-left" onClick={() => setSelectedProduct(item)}>
                    <ProductImage src={item.image} alt={item.name} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-[var(--color-text-primary)]">{item.name}</p>
                      <p className="mt-1 truncate text-xs text-[var(--color-text-tertiary)]">{item.category} · {item.price}</p>
                    </div>
                  </button>

                  <div className="flex items-center gap-2">
                    <Input
                      aria-label={`${item.name} stock`}
                      type="number"
                      min={0}
                      value={String(item.stock)}
                      onChange={(e) => {
                        const next = Number(e.target.value || 0);
                        setProducts((prev) => prev.map((product) => (product.id === item.id ? { ...product, stock: next } : product)));
                      }}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={item.isActive ? 'success' : 'secondary'}>{item.isActive ? 'Active' : 'Inactive'}</Badge>
                    {item.stock <= 5 && item.isActive ? <Badge variant="warning">Low stock</Badge> : null}
                  </div>

                  <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                    <Button size="sm" variant="outline" onClick={() => setSelectedProduct(item)} icon={<Eye className="h-4 w-4" />}>View</Button>
                    <Button size="sm" variant="outline" onClick={() => onEditProduct(item)}>Edit</Button>
                    <Button size="sm" loading={stockBusy === item.id} onClick={() => setProductStock(item.id, item.stock)}>Save</Button>
                    <Button size="sm" variant={item.isActive ? 'warning' : 'secondary'} onClick={() => toggleProductActive(item.id, item.isActive)}>
                      {item.isActive ? 'Off' : 'On'}
                    </Button>
                  </div>
                </article>
              ))}

              {paginatedProducts.length === 0 ? (
                <div className="p-4"><EmptyState title="No products found" description="Try another search, filter, or create your first product." /></div>
              ) : null}
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--color-text-tertiary)]">Showing {filteredProducts.length === 0 ? 0 : (productPage - 1) * PAGE_SIZE + 1}–{Math.min(productPage * PAGE_SIZE, filteredProducts.length)} of {filteredProducts.length}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={productPage <= 1} onClick={() => setProductPage((prev) => Math.max(1, prev - 1))}>Previous</Button>
              <span className="inline-flex items-center rounded-2xl border border-[var(--color-border-secondary)] px-3 text-sm font-bold text-[var(--color-text-secondary)]">{productPage} / {productTotalPages}</span>
              <Button size="sm" variant="outline" disabled={productPage >= productTotalPages} onClick={() => setProductPage((prev) => Math.min(productTotalPages, prev + 1))}>Next</Button>
            </div>
          </div>
        </ShellCard>
      </div>

      <ShellCard className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-black text-[var(--color-text-primary)]">Order workflow</h2>
            <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">Move orders through fulfilment from one responsive list.</p>
          </div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-[var(--color-text-tertiary)]" />
            <select
              className="h-10 rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 text-sm text-[var(--color-text-primary)]"
              value={orderStatusFilter}
              onChange={(e) => setOrderStatusFilter((e.target.value as StoreOrderStatus) || '')}
            >
              <option value="">All statuses</option>
              {ORDER_STATUSES.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-5 grid gap-3 xl:grid-cols-2">
          {orders.map((order) => (
            <article key={order.orderId} className="rounded-3xl border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-[var(--color-text-primary)]">{order.orderId}</p>
                  <p className="mt-1 truncate text-xs text-[var(--color-text-tertiary)]">{order.customer.firstName} {order.customer.lastName} · {order.customer.email}</p>
                </div>
                <Badge variant={statusVariant(order.status)}>{titleCase(order.status)}</Badge>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <InfoTile label="Total" value={`₦${order.total.toLocaleString()}`} />
                <InfoTile label="Items" value={String(order.items?.length || 0)} />
                <div>
                  <p className="mb-1 text-xs font-black uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">Update</p>
                  <select
                    className="h-11 w-full rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-background-primary)] px-3 text-sm font-semibold text-[var(--color-text-primary)]"
                    value={order.status}
                    onChange={(e) => updateOrderStatus(order.orderId, e.target.value as StoreOrderStatus)}
                    disabled={orderBusy === order.orderId}
                  >
                    {ORDER_STATUSES.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}
                  </select>
                </div>
              </div>
            </article>
          ))}

          {orders.length === 0 ? <div className="xl:col-span-2"><EmptyState title="No orders found" description="Orders will appear here when customers place them." /></div> : null}
        </div>
      </ShellCard>

      {selectedProduct ? <ProductDrawer product={selectedProduct} onClose={() => setSelectedProduct(null)} onEdit={onEditProduct} /> : null}
    </div>
  );
}
