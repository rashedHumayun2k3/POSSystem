// VariantValuesJson (and DTOs that pass it through raw, e.g. OrderItemDto.variantLabel) looks
// like {"Size":"M","Color":"Blue"} — render as "M / Blue", not raw JSON. "{}" (products with no
// variant attributes) and empty/missing values all correctly collapse to "".
export function formatVariantLabel(variantValuesJson?: string | null): string {
  if (!variantValuesJson) return "";
  try {
    const obj = JSON.parse(variantValuesJson) as Record<string, string>;
    return Object.values(obj).filter(Boolean).join(" / ");
  } catch {
    return "";
  }
}

// Module 15 — Partnership & Capital Ledger amounts are paisa (integer, ÷100), per R15.2.
// Kept separate from MoneyText/Intl.NumberFormat-on-decimal-taka formatting used elsewhere
// (e.g. products' avgLandedCost) since the input unit differs — mixing them risks a ×100 bug.
export function formatPaisa(amountPaisa: number): string {
  const taka = amountPaisa / 100;
  const formatted = new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(taka));
  return `${taka < 0 ? "-" : ""}৳${formatted}`;
}
