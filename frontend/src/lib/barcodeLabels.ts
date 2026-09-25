import type { ProductSearchResult } from '@/types/catalog';

export type LabelItem = Pick<
  ProductSearchResult,
  'productId' | 'variantId' | 'productName' | 'variantSku' | 'barcode' | 'sellingPrice' | 'variantValuesJson'
>;

export type LabelSelection = LabelItem & { quantity: number };

export type A4Template = {
  labelWidth: number;
  labelHeight: number;
  columns: number;
  rows: number;
  horizontalGap: number;
  verticalGap: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
};

export type RollSize = { width: number; height: number };

export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;
export const MAX_LABEL_QUANTITY = 500;
export const MAX_TOTAL_LABELS = 1000;

// This only preserves the existing four-column intent. It is deliberately presented in the UI
// as a starter preset: sticker stock varies, so users must measure their own sheet before printing.
export const FOUR_COLUMN_STARTER: A4Template = {
  labelWidth: 48,
  labelHeight: 38,
  columns: 4,
  rows: 7,
  horizontalGap: 2,
  verticalGap: 2,
  marginTop: 8,
  marginRight: 6,
  marginBottom: 8,
  marginLeft: 6,
};

export function isValidEan13(value: string): boolean {
  if (!/^\d{13}$/.test(value)) return false;
  const digits = [...value].map(Number);
  const sum = digits.slice(0, 12).reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10 === digits[12];
}

export function validateBarcode(value: string): string | null {
  if (!value.trim()) return 'This product has no stored barcode.';
  if (value.length > 80) return 'Barcode is too long (maximum 80 characters).';
  if ([...value].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) > 126)) {
    return 'Code 128 labels support printable ASCII characters only.';
  }
  if (/^\d{13}$/.test(value) && !isValidEan13(value)) {
    return 'This 13-digit value has an invalid EAN-13 check digit.';
  }
  return null;
}

export function validateA4Template(template: A4Template): string[] {
  const errors: string[] = [];
  const dimensions = [template.labelWidth, template.labelHeight, template.horizontalGap, template.verticalGap,
    template.marginTop, template.marginRight, template.marginBottom, template.marginLeft];
  if (dimensions.some((value) => !Number.isFinite(value) || value < 0)) errors.push('Dimensions and gaps must be valid non-negative numbers.');
  if (template.labelWidth <= 0 || template.labelHeight <= 0) errors.push('Label width and height must be greater than zero.');
  if (!Number.isInteger(template.columns) || template.columns < 1 || template.columns > 12) errors.push('Columns must be a whole number from 1 to 12.');
  if (!Number.isInteger(template.rows) || template.rows < 1 || template.rows > 30) errors.push('Rows must be a whole number from 1 to 30.');
  const usedWidth = template.marginLeft + template.marginRight + template.columns * template.labelWidth + (template.columns - 1) * template.horizontalGap;
  const usedHeight = template.marginTop + template.marginBottom + template.rows * template.labelHeight + (template.rows - 1) * template.verticalGap;
  if (usedWidth > A4_WIDTH_MM + 0.01) errors.push(`Template width is ${usedWidth.toFixed(1)} mm, wider than A4 (210 mm).`);
  if (usedHeight > A4_HEIGHT_MM + 0.01) errors.push(`Template height is ${usedHeight.toFixed(1)} mm, taller than A4 (297 mm).`);
  return errors;
}

export function validateRollSize(size: RollSize): string[] {
  const errors: string[] = [];
  if (!Number.isFinite(size.width) || size.width < 20 || size.width > 150) errors.push('Roll width must be between 20 and 150 mm.');
  if (!Number.isFinite(size.height) || size.height < 15 || size.height > 150) errors.push('Roll height must be between 15 and 150 mm.');
  return errors;
}

export function expandLabels(selections: LabelSelection[]): LabelItem[] {
  return selections.flatMap((selection) => Array.from({ length: selection.quantity }, () => selection));
}

export function paginateA4(labels: LabelItem[], startPosition: number, positionsPerPage: number): Array<Array<LabelItem | null>> {
  if (!Number.isInteger(positionsPerPage) || positionsPerPage < 1) return [];
  const safeStart = Math.min(Math.max(Math.trunc(startPosition || 1), 1), positionsPerPage);
  const cells: Array<LabelItem | null> = [
    ...Array.from({ length: safeStart - 1 }, () => null),
    ...labels,
  ];
  const pages: Array<Array<LabelItem | null>> = [];
  for (let index = 0; index < cells.length; index += positionsPerPage) {
    pages.push([...cells.slice(index, index + positionsPerPage), ...Array.from({ length: Math.max(0, positionsPerPage - cells.slice(index, index + positionsPerPage).length) }, () => null)]);
  }
  return pages;
}

// Code 128 module-width patterns, indexed by symbol value (0-106). Code Set B covers all
// printable ASCII used by the POS and avoids substituting or transforming the stored value.
const CODE128_PATTERNS = [
  '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213','221312','231212',
  '112232','122132','122231','113222','123122','123221','223211','221132','221231','213212','223112','312131',
  '311222','321122','321221','312212','322112','322211','212123','212321','232121','111323','131123','131321',
  '112313','132113','132311','211313','231113','231311','112133','112331','132131','113123','113321','133121',
  '313121','211331','231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
  '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214','112412','122114',
  '122411','142112','142211','241211','221114','413111','241112','134111','111242','121142','121241','114212',
  '124112','124211','411212','421112','421211','212141','214121','412121','111143','111341','131141','114113',
  '114311','411113','411311','113141','114131','311141','411131','211412','211214','211232','2331112',
];

export function code128Bars(value: string): { x: number; width: number }[] {
  const error = validateBarcode(value);
  if (error) throw new Error(error);
  const values = [...value].map((character) => character.charCodeAt(0) - 32);
  const checksum = (104 + values.reduce((sum, code, index) => sum + code * (index + 1), 0)) % 103;
  const symbols = [104, ...values, checksum, 106];
  const bars: { x: number; width: number }[] = [];
  let cursor = 10;
  for (const symbol of symbols) {
    const pattern = CODE128_PATTERNS[symbol];
    for (let index = 0; index < pattern.length; index += 1) {
      const width = Number(pattern[index]);
      if (index % 2 === 0) bars.push({ x: cursor, width });
      cursor += width;
    }
  }
  return bars;
}

export function code128Width(value: string): number {
  const bars = code128Bars(value);
  const last = bars[bars.length - 1];
  return last.x + last.width + 10;
}
