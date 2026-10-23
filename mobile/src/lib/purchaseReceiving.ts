type Quantities = { usable: string; damaged: string; missing: string };

function quantity(value: string, label: string): number {
  const result = Number(value);
  if (!Number.isFinite(result) || result < 0 || Math.abs(result * 1000 - Math.round(result * 1000)) > 0.000001)
    throw new Error(`${label} must be non-negative with at most three decimal places.`);
  return result;
}

export function lotUsableQuantity(lotQty: number, damaged: string, missing: string): number {
  const usable = Math.round((lotQty - quantity(damaged, "Damaged quantity") - quantity(missing, "Missing quantity")) * 1000) / 1000;
  if (usable < 0) throw new Error(`Damaged + missing cannot exceed the lot quantity (${lotQty}).`);
  return usable === 0 ? 0 : usable;
}

export function receiptQuantities(entry: Quantities, lotQty: number | undefined, remaining: number) {
  const qtyDamaged = quantity(entry.damaged, "Damaged quantity");
  const qtyMissing = quantity(entry.missing, "Missing quantity");
  const qtyUsable = lotQty === undefined ? quantity(entry.usable, "Usable quantity") : lotUsableQuantity(lotQty, entry.damaged, entry.missing);
  const total = Math.round((qtyUsable + qtyDamaged + qtyMissing) * 1000) / 1000;
  if (total <= 0) throw new Error("Enter at least one received or missing piece.");
  if (total > Math.round(remaining * 1000) / 1000)
    throw new Error(`This receipt accounts for ${total} pieces, but only ${remaining} remain on the PO. Refresh the PO and check the lot quantities.`);
  return { qtyUsable, qtyDamaged, qtyMissing };
}
