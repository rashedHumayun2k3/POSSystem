// Client-side port of the same VariantValuesJson formatting used in
// backend/src/ResellerApi/Services/ReceiptPdfGenerator.cs's FormatVariantLabel().
export function formatVariantLabel(variantValuesJson: string): string {
  if (!variantValuesJson || variantValuesJson === "{}") return "";
  try {
    const values = JSON.parse(variantValuesJson) as Record<string, string>;
    return Object.values(values)
      .filter((v) => v && v.trim().length > 0)
      .join(" / ");
  } catch {
    return "";
  }
}
