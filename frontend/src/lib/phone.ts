export function isBangladeshMobileNumber(value: string): boolean {
  return /^(?:\+?88)?01[3-9]\d{8}$/.test(value.trim());
}

