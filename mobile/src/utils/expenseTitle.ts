// Accept descriptive titles with numbers, but reject amounts entered as the title.
export function isNumericExpenseTitle(value: string): boolean {
  const text = value.trim();
  return /[0-9০-৯]/u.test(text) && /^[0-9০-৯\s.,+\-৳]+$/u.test(text);
}
