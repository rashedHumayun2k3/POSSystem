"use client";

import { useAuthStore } from "@/store/authStore";

interface Props {
  amount: number;
  className?: string;
  colorCode?: boolean;
}

export default function MoneyText({ amount, className = "", colorCode = false }: Props) {
  const isOwner = useAuthStore((s) => s.isOwner());
  if (!isOwner) return null;

  const color = colorCode ? (amount >= 0 ? "text-green-600" : "text-red-600") : "";
  const formatted = new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return (
    <span className={`font-tabular-nums ${color} ${className}`}>
      ৳{formatted}
    </span>
  );
}
