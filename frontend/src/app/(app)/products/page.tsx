'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { getProducts } from '@/lib/catalogApi';
import { getCategories } from '@/lib/catalogApi';
import { useAuthStore } from '@/store/authStore';
import type { ProductSummary } from '@/types/catalog';
import { useLanguage } from '@/i18n/LanguageContext';
import { resolveMediaUrl } from '@/lib/media';

export default function ProductsPage() {
  const canSeeCosts = useAuthStore((s) => s.canSeeCosts());
  const isOwner = useAuthStore((s) => s.isOwner());
  const currentBranchId = useAuthStore((s) => s.currentBranchId);
  const { t } = useLanguage();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', statusFilter, categoryFilter, search, currentBranchId],
    queryFn: () =>
      getProducts({
        status: statusFilter || undefined,
        categoryId: categoryFilter || undefined,
        q: search || undefined,
      }),
  });

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-semibold text-gray-900">{t('products.title')}</h1>
          {isOwner && (
            <Link
              href="/products/new"
              className="flex items-center gap-1 bg-indigo-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg"
            >
              <span className="text-base leading-none">+</span> {t('products.new')}
            </Link>
          )}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder={t('products.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />

        {/* Filters */}
        <div className="flex gap-2 mt-2 overflow-x-auto pb-1 scrollbar-hide">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-gray-200 rounded-md px-2 py-1 shrink-0"
          >
            <option value="">{t('products.allStatus')}</option>
            <option value="ACTIVE">{t('products.active')}</option>
            <option value="ARCHIVED">{t('products.archived')}</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs border border-gray-200 rounded-md px-2 py-1 shrink-0"
          >
            <option value="">{t('products.allCategories')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Product list */}
      <div className="px-4 pt-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10"
              />
            </svg>
            <p className="text-sm">
              {t('products.noProducts')}{' '}
              {isOwner && (
                <Link href="/products/new" className="text-indigo-600 font-medium">
                  {t('products.newProduct')}
                </Link>
              )}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} isOwner={isOwner} canSeeCosts={canSeeCosts} t={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProductCard({
  product,
  isOwner,
  canSeeCosts,
  t,
}: {
  product: ProductSummary;
  isOwner: boolean;
  canSeeCosts: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <Link href={`/products/${product.id}`}>
      <div className="bg-white border border-gray-100 rounded-xl p-3 flex gap-3 active:bg-gray-50">
        {/* Image */}
        <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
          {product.imageUrl ? (
            <img src={resolveMediaUrl(product.imageUrl) ?? ''} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10"
              />
            </svg>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
            <StatusBadge status={product.status} t={t} />
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {product.sku} · {product.categoryName}
          </p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm font-semibold text-gray-900">
              ৳{product.sellingPrice.toLocaleString()}
            </span>
            <span className="text-xs text-gray-400">
              {product.variantCount} {product.variantCount !== 1 ? t('products.variantsLabel') : t('products.variantLabel')} · {product.totalStock}{' '}
              {product.unitCode}
            </span>
            {canSeeCosts && product.packagingCostPerUnit != null && (
              <span className="text-xs text-gray-400">pkg ৳{product.packagingCostPerUnit}</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

function StatusBadge({
  status,
  t,
}: {
  status: string;
  t: (key: string) => string;
}) {
  const colors =
    status === 'ACTIVE'
      ? 'bg-green-50 text-green-700'
      : 'bg-gray-100 text-gray-500';
  return (
    <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full shrink-0 ${colors}`}>
      {status === 'ACTIVE' ? t('products.active') : t('products.archived')}
    </span>
  );
}
