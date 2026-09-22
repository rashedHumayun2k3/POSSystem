"use client";

import { useLanguage } from "@/i18n/LanguageContext";

export const supportsPaymentReference = (method: string) =>
  ["BKASH", "NAGAD", "CARD"].includes(method);

export default function PaymentReferenceInput({ method, value, onChange }: {
  method: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useLanguage();
  if (!supportsPaymentReference(method)) return null;

  return (
    <label className="block mt-3 text-xs text-gray-500">
      <span>{t(method === "CARD" ? "orders.cardReferenceOptional" : "orders.transactionIdOptional")}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={100}
        className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
      />
    </label>
  );
}
