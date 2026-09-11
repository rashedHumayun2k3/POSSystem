import type { Category } from '@/types/catalog';

export function categoryDisplayName(cat: { name: string; nameBn?: string | null }, lang: string): string {
  return lang === 'bn' && cat.nameBn ? cat.nameBn : cat.name;
}

export function parentCategoryDisplayName(cat: Category, lang: string): string | null {
  if (!cat.parentCategoryName) return null;
  return lang === 'bn' && cat.parentCategoryNameBn ? cat.parentCategoryNameBn : cat.parentCategoryName;
}
