// Input filters for number fields: letters are dropped while typing instead of erroring on save.
// Bangla digits (০-৯) are converted to English digits — numbers are always shown in English.

const toEnglishDigits = (value: string) => value.replace(/[০-৯]/g, d => String("০১২৩৪৫৬৭৮৯".indexOf(d)));

/** Digits only (phone, NID, account numbers). */
export const digitsOnly = (value: string, maxLength?: number) => {
  const v = toEnglishDigits(value).replace(/\D/g, "");
  return maxLength ? v.slice(0, maxLength) : v;
};

/** Mobile number: digits with an optional leading "+". */
export const phoneInput = (value: string, maxLength = 14) =>
  toEnglishDigits(value).replace(/(?!^\+)[^\d]/g, "").slice(0, maxLength);

/** Positive decimal (money, weight). Keeps one dot and at most `decimals` places. */
export const decimalInput = (value: string, decimals = 2) => {
  const v = toEnglishDigits(value).replace(/[^\d.]/g, "");
  const dot = v.indexOf(".");
  if (dot < 0) return v;
  const whole = v.slice(0, dot);
  const fraction = v.slice(dot + 1).replace(/\./g, "").slice(0, decimals);
  return decimals === 0 ? whole : `${whole}.${fraction}`;
};

/** Whole-number quantity (pcs, pair). */
export const wholeNumberInput = (value: string) => digitsOnly(value);
