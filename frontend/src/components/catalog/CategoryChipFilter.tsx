'use client';

import ChipScroller from '@/components/ui/ChipScroller';
import { categoryDisplayName } from '@/lib/categoryDisplay';
import type { Category } from '@/types/catalog';
import type { Lang } from '@/i18n/LanguageContext';

type CategoryChipFilterProps = {
  categories: Pick<Category, 'id' | 'name' | 'nameBn'>[];
  selectedId: string;
  onSelect: (id: string) => void;
  allLabel: string;
  allId: string;
  lang: Lang;
  sticky?: boolean;
};

export default function CategoryChipFilter({
  categories,
  selectedId,
  onSelect,
  allLabel,
  allId,
  lang,
  sticky = false,
}: CategoryChipFilterProps) {
  return (
    <ChipScroller
      sticky={sticky}
      selectedId={selectedId}
      onSelect={onSelect}
      allLabel={allLabel}
      allId={allId}
      options={categories.map((category) => ({
        id: category.id,
        name: categoryDisplayName(category, lang),
      }))}
    />
  );
}
