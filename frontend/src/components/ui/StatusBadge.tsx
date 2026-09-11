"use client";

import { useLanguage } from "@/i18n/LanguageContext";

interface Props {
  status: string;
}

const palette: Record<string, string> = {
  // Order statuses
  OPEN: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-gray-100 text-gray-500",
  // Fulfillment
  UNFULFILLED: "bg-amber-100 text-amber-700",
  PACKED: "bg-blue-100 text-blue-700",
  IN_TRANSIT: "bg-indigo-100 text-indigo-700",
  DELIVERED: "bg-green-100 text-green-700",
  RETURNED: "bg-red-100 text-red-600",
  // Payment
  UNPAID: "bg-red-100 text-red-600",
  PARTIALLY_PAID: "bg-amber-100 text-amber-700",
  PAID: "bg-green-100 text-green-700",
  REFUNDED: "bg-gray-100 text-gray-500",
  // General
  ACTIVE: "bg-green-100 text-green-700",
  PENDING: "bg-amber-100 text-amber-700",
  DRAFT: "bg-gray-100 text-gray-500",
};

export default function StatusBadge({ status }: Props) {
  const { t } = useLanguage();
  const cls = palette[status] ?? "bg-gray-100 text-gray-500";
  const label = palette[status] ? t(`status.${status}`) : status.replace(/_/g, " ");
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}
