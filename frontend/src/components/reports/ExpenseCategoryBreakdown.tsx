"use client";

import { useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { useLanguage, type Lang } from "@/i18n/LanguageContext";
import { EXPENSE_CATEGORY_ICONS } from "@/lib/expenseCategoryIcons";
import type { ExpenseCategoryBreakdown as ExpenseCategoryBreakdownDto } from "@/types/reports";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

const TEXT: Record<Lang, { title: string; empty: string }> = {
  en: { title: "Expenses by Category", empty: "No expenses logged yet." },
  bn: { title: "ক্যাটাগরি অনুযায়ী খরচ", empty: "এখনো কোনো খরচ লেখা হয়নি।" },
};

const CATEGORY_NAME_BN_BY_CODE: Record<string, string> = {
  OFFICE: "দোকান ও অফিস খরচ",
  STAFF: "স্টাফের বেতন/খরচ",
  MARKETING: "বিজ্ঞাপন খরচ",
  DELIVERY: "ডেলিভারি খরচ",
  TRIP: "মাল কেনার যাতায়াত খরচ",
  EQUIPMENT_OTHER: "যন্ত্রপাতি ও অন্যান্য",
  OWNER_DRAWING: "মালিকের ব্যক্তিগত টাকা",
  INVENTORY_LOSS: "স্টক নষ্ট/হারানোর ক্ষতি",
  SETUP_CAPEX: "দোকান সেটআপ ও সম্পদ",
};

const CATEGORY_NAME_BN_BY_NAME: Record<string, string> = {
  "Product Damage Loss": "প্রোডাক্ট নষ্টের ক্ষতি",
  "Courier Charge": "কুরিয়ার চার্জ",
  "Return Charge": "রিটার্ন চার্জ",
  "Packaging Materials": "প্যাকেট/কার্টন খরচ",
  "Shop Rent": "দোকান ভাড়া",
  "Electricity Bill": "বিদ্যুৎ বিল",
  "Internet & Mobile": "ইন্টারনেট/মোবাইল বিল",
  "Staff Salary": "স্টাফ বেতন",
  "Staff Food & Tea": "স্টাফ খাবার/চা",
  "Facebook Ads / Boost": "ফেসবুক অ্যাড/বুস্ট",
  "Transport / Rickshaw": "রিকশা/ভাড়া",
  "bKash / Bank Charge": "বিকাশ/ব্যাংক চার্জ",
  Miscellaneous: "অন্যান্য",
};

const SUBTYPE_LABEL_BN: Record<string, string> = {
  Rent: "দোকান ভাড়া",
  Electricity: "বিদ্যুৎ বিল",
  Internet: "ইন্টারনেট বিল",
  Stationery: "খাতা/কলম/স্টেশনারি",
  Cleaning: "পরিষ্কার-পরিচ্ছন্নতা",
  "Mobile/Phone Bill": "মোবাইল/ফোন বিল",
  "Bank/MFS Charge": "ব্যাংক/বিকাশ চার্জ",
  Salary: "বেতন",
  "Delivery rider salary": "ডেলিভারি ম্যানের বেতন",
  Bonus: "বোনাস",
  Advance: "অগ্রিম টাকা",
  Overtime: "ওভারটাইম",
  "Transport allowance": "যাতায়াত ভাতা",
  "Facebook Ads": "ফেসবুক অ্যাড",
  "Boost post": "পোস্ট বুস্ট",
  Banner: "ব্যানার",
  "Packaging design": "প্যাকেট ডিজাইন",
  "Promotional gift": "প্রমোশন গিফট",
  "Courier fee": "কুরিয়ার ফি",
  "Return charge": "রিটার্ন চার্জ",
  "COD collection charge": "COD টাকা তোলার চার্জ",
  Petrol: "পেট্রোল/তেল",
  "Van/Rickshaw rent": "ভ্যান/রিকশা ভাড়া",
  "Vehicle maintenance": "গাড়ি মেরামত",
  "Toll/Ferry": "টোল/ফেরি",
  Parking: "পার্কিং",
  "Packaging Materials": "প্যাকেট/কার্টন খরচ",
  "Flight ticket": "বিমান টিকিট",
  Hotel: "হোটেল",
  Food: "খাবার",
  "Visa fee": "ভিসা ফি",
  Customs: "কাস্টমস",
  "Local transport": "লোকাল যাতায়াত",
  "Equipment purchase": "যন্ত্রপাতি কেনা",
  Repair: "মেরামত",
  Furniture: "ফার্নিচার",
  Software: "সফটওয়্যার",
  Miscellaneous: "অন্যান্য",
  "Personal drawing": "মালিক টাকা নিয়েছেন",
  "Personal transfer": "ব্যক্তিগত ট্রান্সফার",
  "Damage Loss": "নষ্ট পণ্যের ক্ষতি",
  "Expired/Near-expiry write-off": "মেয়াদ শেষ/নষ্ট স্টক বাদ",
  "Theft/Pilferage": "চুরি/হারানো",
  "Stock count adjustment": "স্টক মিলানোর ক্ষতি",
  "Shop Rent Advance/Deposit": "দোকান ভাড়ার অগ্রিম/জামানত",
  "Shop Decoration/Renovation": "দোকান সাজানো/মেরামত",
  "CCTV & Security System": "সিসিটিভি/সিকিউরিটি",
  "Signboard/Branding": "সাইনবোর্ড/ব্র্যান্ডিং",
  "POS/Computer Setup": "POS/কম্পিউটার সেটআপ",
  "Initial Furniture & Fixtures": "শুরুর ফার্নিচার/ফিটিংস",
  "Shop/Property Purchase": "দোকান/জায়গা কেনা",
  "Business Registration/Trade License": "ট্রেড লাইসেন্স/রেজিস্ট্রেশন",
  Other: "অন্যান্য",
};

export function displayExpenseCategoryName(code: string, name: string, lang: Lang) {
  if (lang !== "bn") return name;
  return CATEGORY_NAME_BN_BY_CODE[code] ?? CATEGORY_NAME_BN_BY_NAME[name] ?? name;
}

export function displayExpenseSubtypeName(name: string, lang: Lang) {
  if (lang !== "bn") return name;
  return SUBTYPE_LABEL_BN[name] ?? name;
}

export default function ExpenseCategoryBreakdown({
  categories,
  defaultExpanded = false,
}: {
  categories: ExpenseCategoryBreakdownDto[];
  defaultExpanded?: boolean;
}) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    () => new Set(defaultExpanded ? categories.map((c) => c.code) : [])
  );
  const { lang } = useLanguage();
  const label = TEXT[lang];
  const positiveCategories = categories.filter((c) => c.value > 0);

  if (categories.length === 0) return null;

  return (
    <>
      <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide mt-5 mb-2">{label.title}</h2>
      {positiveCategories.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-3 flex items-center gap-4">
          <ResponsiveContainer width="50%" height={160}>
            <PieChart>
              <Pie data={positiveCategories} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} innerRadius={35}>
                {positiveCategories.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => `৳${Number(v ?? 0).toLocaleString()}`} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex-1 space-y-1.5">
            {positiveCategories.map((c, i) => (
              <div key={c.code} className="flex items-center gap-2 text-xs">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="text-gray-600 truncate flex-1">{displayExpenseCategoryName(c.code, c.name, lang)}</span>
                <span className="font-medium text-gray-800 shrink-0">৳{c.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-2 bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
        {categories.map((c) => {
          const isOpen = expandedCategories.has(c.code);
          return (
            <div key={c.code}>
              <button
                onClick={() => {
                  setExpandedCategories((current) => {
                    const next = new Set(current);
                    if (next.has(c.code)) next.delete(c.code);
                    else next.add(c.code);
                    return next;
                  });
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
              >
                <span className="text-xl shrink-0">{EXPENSE_CATEGORY_ICONS[c.code] ?? "📋"}</span>
                <span className="flex-1 text-sm font-medium text-gray-800 truncate">{displayExpenseCategoryName(c.code, c.name, lang)}</span>
                <span className="text-sm font-semibold text-gray-900 shrink-0">৳{c.value.toLocaleString()}</span>
                <ChevronDownIcon className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="px-4 pb-3 pl-12 space-y-1.5">
                  {c.subtypes.length === 0 ? (
                    <p className="text-xs text-gray-400">{label.empty}</p>
                  ) : (
                    c.subtypes.map((s) => (
                      <div key={s.name} className="flex justify-between text-xs">
                        <span className="text-gray-500">{displayExpenseSubtypeName(s.name, lang)}</span>
                        <span className="text-gray-700 font-medium">৳{s.value.toLocaleString()}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
