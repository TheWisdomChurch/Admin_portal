'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { apiClient } from '@/lib/api';
import type {
  StoreOrderAdmin,
  StoreOrderStatus,
  StoreProductAdmin,
  UpsertStoreProductRequest,
} from '@/lib/types';
import { Input } from '@/ui/input';
import { Button } from '@/ui/Button';

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

const ORDER_STATUSES: StoreOrderStatus[] = [
  'pending',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
];

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export default function StoreDashboardPage() {
  const [products, setProducts] = useState<StoreProductAdmin[]>([]);
  const [orders, setOrders] = useState<StoreOrderAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingProduct, setSavingProduct] = useState(false);
  const [orderBusy, setOrderBusy] = useState<string | null>(null);
  const [stockBusy, setStockBusy] = useState<number | null>(null);

  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [productForm, setProductForm] = useState<UpsertStoreProductRequest>(emptyProductForm);
  const [sizesCsv, setSizesCsv] = useState('');
  const [colorsCsv, setColorsCsv] = useState('');
  const [tagsCsv, setTagsCsv] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<StoreOrderStatus | ''>('');

  const lowStockProducts = useMemo(
    () => products.filter((p) => p.isActive && p.stock <= 5),
    [products]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [productsData, ordersData] = await Promise.all([
        apiClient.listStoreProductsAdmin(true),
        apiClient.listStoreOrders({ page: 1, limit: 30, status: orderStatusFilter }),
      ]);

      setProducts(productsData);
      setOrders(ordersData.data || []);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to load store dashboard'));
    } finally {
      setLoading(false);
    }
  }, [orderStatusFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const resetForm = () => {
    setEditingProductId(null);
    setProductForm(emptyProductForm);
    setSizesCsv('');
    setColorsCsv('');
    setTagsCsv('');
  };

  const onEditProduct = (item: StoreProductAdmin) => {
    setEditingProductId(item.id);
    setProductForm({
      name: item.name,
      category: item.category,
      price: item.price,
      originalPrice: item.originalPrice || '',
      image: item.image,
      description: item.description,
      sizes: item.sizes,
      colors: item.colors,
      tags: item.tags,
      stock: item.stock,
      isActive: item.isActive,
    });
    setSizesCsv(item.sizes.join(', '));
    setColorsCsv(item.colors.join(', '));
    setTagsCsv(item.tags.join(', '));
  };

  const saveProduct = async () => {
    if (!productForm.name.trim() || !productForm.price.trim() || !productForm.image.trim()) {
      toast.error('Name, price, and image are required.');
      return;
    }

    const payload: UpsertStoreProductRequest = {
      ...productForm,
      originalPrice: productForm.originalPrice?.trim() || undefined,
      sizes: splitCsv(sizesCsv),
      colors: splitCsv(colorsCsv),
      tags: splitCsv(tagsCsv),
      stock: Number(productForm.stock || 0),
    };

    try {
      setSavingProduct(true);

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
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Unable to update product status'));
    }
  };

  const updateOrderStatus = async (orderId: string, status: StoreOrderStatus) => {
    try {
      setOrderBusy(orderId);
      await apiClient.updateStoreOrderStatus(orderId, status);
      await loadData();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Unable to update order status'));
    } finally {
      setOrderBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="text-sm text-[var(--color-text-secondary)]">
        Loading store dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] p-6">
        <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">
          Store Operations
        </h1>
        <p className="mt-2 text-sm text-[var(--color-text-tertiary)]">
          Manage products, stock availability, and customer orders from one backend-driven control room.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-xs">
          <span className="rounded-full border border-[var(--color-border-primary)] px-3 py-1 text-[var(--color-text-secondary)]">
            Active products: {products.filter((p) => p.isActive).length}
          </span>
          <span className="rounded-full border border-[var(--color-border-primary)] px-3 py-1 text-[var(--color-text-secondary)]">
            Low stock alerts: {lowStockProducts.length}
          </span>
          <span className="rounded-full border border-[var(--color-border-primary)] px-3 py-1 text-[var(--color-text-secondary)]">
            Orders loaded: {orders.length}
          </span>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] p-5">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            {editingProductId ? 'Edit product' : 'Create product'}
          </h2>

          <Input
            label="Name"
            value={productForm.name}
            onChange={(e) => setProductForm((p) => ({ ...p, name: e.target.value }))}
          />

          <Input
            label="Category"
            value={productForm.category}
            onChange={(e) => setProductForm((p) => ({ ...p, category: e.target.value }))}
          />

          <Input
            label="Price (e.g. N6000)"
            value={productForm.price}
            onChange={(e) => setProductForm((p) => ({ ...p, price: e.target.value }))}
          />

          <Input
            label="Original price (optional)"
            value={productForm.originalPrice || ''}
            onChange={(e) =>
              setProductForm((p) => ({ ...p, originalPrice: e.target.value }))
            }
          />

          <Input
            label="Image URL"
            value={productForm.image}
            onChange={(e) => setProductForm((p) => ({ ...p, image: e.target.value }))}
          />

          <Input
            label="Description"
            value={productForm.description}
            onChange={(e) => setProductForm((p) => ({ ...p, description: e.target.value }))}
          />

          <Input
            label="Sizes (comma separated)"
            value={sizesCsv}
            onChange={(e) => setSizesCsv(e.target.value)}
          />

          <Input
            label="Colors (comma separated)"
            value={colorsCsv}
            onChange={(e) => setColorsCsv(e.target.value)}
          />

          <Input
            label="Tags (comma separated)"
            value={tagsCsv}
            onChange={(e) => setTagsCsv(e.target.value)}
          />

          <Input
            label="Stock"
            type="number"
            min={0}
            value={String(productForm.stock)}
            onChange={(e) =>
              setProductForm((p) => ({
                ...p,
                stock: Number(e.target.value || 0),
              }))
            }
          />

          <div className="flex gap-3">
            <Button loading={savingProduct} onClick={saveProduct}>
              {editingProductId ? 'Update Product' : 'Create Product'}
            </Button>
            <Button variant="outline" onClick={resetForm}>
              Reset
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] p-5">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Product inventory
          </h2>
          <div className="mt-4 max-h-[640px] space-y-3 overflow-auto pr-1">
            {products.map((item) => (
              <div key={item.id} className="rounded-xl border border-[var(--color-border-primary)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-[var(--color-text-primary)]">{item.name}</p>
                    <p className="text-xs text-[var(--color-text-tertiary)]">
                      {item.category} · {item.price}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onEditProduct(item)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant={item.isActive ? 'warning' : 'secondary'}
                      onClick={() => toggleProductActive(item.id, item.isActive)}
                    >
                      {item.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <Input
                    label="Stock"
                    type="number"
                    min={0}
                    value={String(item.stock)}
                    onChange={(e) => {
                      const next = Number(e.target.value || 0);
                      setProducts((prev) =>
                        prev.map((p) =>
                          p.id === item.id ? { ...p, stock: next } : p
                        )
                      );
                    }}
                  />
                  <Button
                    size="sm"
                    loading={stockBusy === item.id}
                    onClick={() => setProductStock(item.id, item.stock)}
                  >
                    Save Stock
                  </Button>
                </div>

                {item.stock <= 5 && item.isActive ? (
                  <p className="mt-2 text-xs text-amber-500">Low stock alert</p>
                ) : null}
              </div>
            ))}

            {products.length === 0 ? (
              <p className="text-sm text-[var(--color-text-tertiary)]">No products yet.</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Order workflow
          </h2>
          <select
            className="h-10 rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-3 text-sm text-[var(--color-text-primary)]"
            value={orderStatusFilter}
            onChange={(e) => setOrderStatusFilter((e.target.value as StoreOrderStatus) || '')}
          >
            <option value="">All statuses</option>
            {ORDER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 max-h-[420px] space-y-3 overflow-auto pr-1">
          {orders.map((order) => (
            <div key={order.orderId} className="rounded-xl border border-[var(--color-border-primary)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-[var(--color-text-primary)]">
                    {order.orderId}
                  </p>
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    {order.customer.firstName} {order.customer.lastName} · {order.customer.email}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    className="h-9 rounded-[var(--radius-button)] border border-[var(--color-border-primary)] bg-[var(--color-background-secondary)] px-2 text-sm text-[var(--color-text-primary)]"
                    value={order.status}
                    onChange={(e) =>
                      updateOrderStatus(order.orderId, e.target.value as StoreOrderStatus)
                    }
                    disabled={orderBusy === order.orderId}
                  >
                    {ORDER_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                Total: ₦{order.total.toLocaleString()} · Items: {order.items?.length || 0}
              </p>
            </div>
          ))}

          {orders.length === 0 ? (
            <p className="text-sm text-[var(--color-text-tertiary)]">No orders found.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}