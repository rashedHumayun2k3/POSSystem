'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getExpenseCategories } from '@/lib/settingsApi';
import { createExpense, listExpenses } from '@/lib/expensesApi';
import { useLanguage } from '@/i18n/LanguageContext';
import type { ExpenseCategoryDto } from '@/types/expenses';
import { toastError } from '@/lib/toastError';
import { useToastStore } from '@/store/toastStore';
import { EXPENSE_CATEGORY_ICONS } from '@/lib/expenseCategoryIcons';
import SlidePanel from '@/components/ui/SlidePanel';
import DateRangeBar, { periodToDates } from '@/components/reports/DateRangeBar';
import type { GroupBy, ReportPeriod } from '@/types/reports';
import { useAuthStore } from '@/store/authStore';
import { getPnlReport } from '@/lib/reportsApi';
import ExpenseCategoryBreakdown from '@/components/reports/ExpenseCategoryBreakdown';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

const HISTORY_PERIODS: { key: ReportPeriod; label: string }[] = [
  { key: '7d', label: '7D' },
  { key: '30d', label: '1M' },
  { key: '3m', label: '3M' },
  { key: '6m', label: '6M' },
];

// ── Step identifiers ─────────────────────────────────────────────────────────
// Amount and date used to be separate steps — merged into one screen since they're both
// quick, small inputs and splitting them just added an extra tap for no reason.
type Step = 'category' | 'hotCosts' | 'subtype' | 'amountDate' | 'note';
const STEPS: Step[] = ['category', 'hotCosts', 'subtype', 'amountDate', 'note'];

const QUICK_SUBTYPES: Record<string, string[]> = {
  OFFICE:          ['Rent', 'Electricity', 'Internet', 'Stationery', 'Cleaning', 'Mobile/Phone Bill', 'Bank/MFS Charge'],
  STAFF:           ['Salary', 'Delivery rider salary', 'Bonus', 'Advance', 'Overtime', 'Transport allowance'],
  MARKETING:       ['Facebook Ads', 'Boost post', 'Banner', 'Packaging design', 'Promotional gift'],
  DELIVERY:        ['Courier fee', 'Return charge', 'COD collection charge', 'Petrol', 'Van/Rickshaw rent', 'Vehicle maintenance', 'Toll/Ferry', 'Parking', 'Packaging Materials'],
  TRIP:            ['Flight ticket', 'Hotel', 'Food', 'Visa fee', 'Customs', 'Local transport'],
  EQUIPMENT_OTHER: ['Equipment purchase', 'Repair', 'Furniture', 'Software', 'Miscellaneous'],
  OWNER_DRAWING:   ['Personal drawing', 'Personal transfer'],
  INVENTORY_LOSS:  ['Damage Loss', 'Expired/Near-expiry write-off', 'Theft/Pilferage', 'Stock count adjustment'],
  SETUP_CAPEX:     ['Shop Rent Advance/Deposit', 'Shop Decoration/Renovation', 'CCTV & Security System', 'Signboard/Branding', 'POS/Computer Setup', 'Initial Furniture & Fixtures', 'Shop/Property Purchase', 'Business Registration/Trade License'],
};

const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];

// Not a real subtype the business tracks a total for — "Others" tags the expense generically and
// pushes the actual detail into the Note field instead, so odd one-offs don't fragment reporting
// into dozens of near-duplicate free-text subtypes (see conversation: chose this over a
// per-user/per-business "remembered custom subtype" list for exactly that reason).
const OTHER_SUBTYPE = 'Other';
const HOT_COST_STORAGE_KEY = 'expenseHotCostShortcuts:v2';

type HotCostShortcut = {
  categoryId: string;
  categoryCode: string;
  categoryName: string;
  subtype: string;
};

const CATEGORY_NAME_BN_BY_CODE: Record<string, string> = {
  OFFICE: 'দোকান ও অফিস খরচ',
  STAFF: 'স্টাফের বেতন/খরচ',
  MARKETING: 'বিজ্ঞাপন খরচ',
  DELIVERY: 'ডেলিভারি খরচ',
  TRIP: 'মাল কেনার যাতায়াত খরচ',
  EQUIPMENT_OTHER: 'যন্ত্রপাতি ও অন্যান্য',
  OWNER_DRAWING: 'মালিকের ব্যক্তিগত টাকা',
  INVENTORY_LOSS: 'স্টক নষ্ট/হারানোর ক্ষতি',
  SETUP_CAPEX: 'দোকান সেটআপ ও সম্পদ',
  CUSTOM_PRODUCT_DAMAGE_LOSS: 'প্রোডাক্ট নষ্টের ক্ষতি',
};

const CATEGORY_NAME_BN_BY_NAME: Record<string, string> = {
  'Product Damage Loss': 'প্রোডাক্ট নষ্টের ক্ষতি',
  'Courier Charge': 'কুরিয়ার চার্জ',
  'Return Charge': 'রিটার্ন চার্জ',
  'Packaging Materials': 'প্যাকেট/কার্টন খরচ',
  'Shop Rent': 'দোকান ভাড়া',
  'Electricity Bill': 'বিদ্যুৎ বিল',
  'Internet & Mobile': 'ইন্টারনেট/মোবাইল বিল',
  'Staff Salary': 'স্টাফ বেতন',
  'Staff Food & Tea': 'স্টাফ খাবার/চা',
  'Facebook Ads / Boost': 'ফেসবুক অ্যাড/বুস্ট',
  'Transport / Rickshaw': 'রিকশা/ভাড়া',
  'bKash / Bank Charge': 'বিকাশ/ব্যাংক চার্জ',
  Miscellaneous: 'অন্যান্য',
};

const SUBTYPE_LABEL_BN: Record<string, string> = {
  Rent: 'দোকান ভাড়া',
  Electricity: 'বিদ্যুৎ বিল',
  Internet: 'ইন্টারনেট বিল',
  Stationery: 'খাতা/কলম/স্টেশনারি',
  Cleaning: 'পরিষ্কার-পরিচ্ছন্নতা',
  'Mobile/Phone Bill': 'মোবাইল/ফোন বিল',
  'Bank/MFS Charge': 'ব্যাংক/বিকাশ চার্জ',
  Salary: 'বেতন',
  'Delivery rider salary': 'ডেলিভারি ম্যানের বেতন',
  Bonus: 'বোনাস',
  Advance: 'অগ্রিম টাকা',
  Overtime: 'ওভারটাইম',
  'Transport allowance': 'যাতায়াত ভাতা',
  'Facebook Ads': 'ফেসবুক অ্যাড',
  'Boost post': 'পোস্ট বুস্ট',
  Banner: 'ব্যানার',
  'Packaging design': 'প্যাকেট ডিজাইন',
  'Promotional gift': 'প্রমোশন গিফট',
  'Courier fee': 'কুরিয়ার ফি',
  'Return charge': 'রিটার্ন চার্জ',
  'COD collection charge': 'COD টাকা তোলার চার্জ',
  Petrol: 'পেট্রোল/তেল',
  'Van/Rickshaw rent': 'ভ্যান/রিকশা ভাড়া',
  'Vehicle maintenance': 'গাড়ি মেরামত',
  'Toll/Ferry': 'টোল/ফেরি',
  Parking: 'পার্কিং',
  'Packaging Materials': 'প্যাকেট/কার্টন খরচ',
  'Flight ticket': 'বিমান টিকিট',
  Hotel: 'হোটেল',
  Food: 'খাবার',
  'Visa fee': 'ভিসা ফি',
  Customs: 'কাস্টমস',
  'Local transport': 'লোকাল যাতায়াত',
  'Equipment purchase': 'যন্ত্রপাতি কেনা',
  Repair: 'মেরামত',
  Furniture: 'ফার্নিচার',
  Software: 'সফটওয়্যার',
  Miscellaneous: 'অন্যান্য',
  'Personal drawing': 'মালিক টাকা নিয়েছেন',
  'Personal transfer': 'ব্যক্তিগত ট্রান্সফার',
  'Damage Loss': 'নষ্ট পণ্যের ক্ষতি',
  'Expired/Near-expiry write-off': 'মেয়াদ শেষ/নষ্ট স্টক বাদ',
  'Theft/Pilferage': 'চুরি/হারানো',
  'Stock count adjustment': 'স্টক মিলানোর ক্ষতি',
  'Shop Rent Advance/Deposit': 'দোকান ভাড়ার অগ্রিম/জামানত',
  'Shop Decoration/Renovation': 'দোকান সাজানো/মেরামত',
  'CCTV & Security System': 'সিসিটিভি/সিকিউরিটি',
  'Signboard/Branding': 'সাইনবোর্ড/ব্র্যান্ডিং',
  'POS/Computer Setup': 'POS/কম্পিউটার সেটআপ',
  'Initial Furniture & Fixtures': 'শুরুর ফার্নিচার/ফিটিংস',
  'Shop/Property Purchase': 'দোকান/জায়গা কেনা',
  'Business Registration/Trade License': 'ট্রেড লাইসেন্স/রেজিস্ট্রেশন',
  Other: 'অন্যান্য',
};

const CATEGORY_SEARCH_ALIASES: Record<string, string[]> = {
  OFFICE: ['office', 'admin', 'dokaan', 'dokan', 'dokhan', 'office khoroch', 'dokandar khoroch'],
  STAFF: ['staff', 'salary', 'beton', 'betan', 'kormochari', 'employee', 'worker'],
  MARKETING: ['marketing', 'ads', 'ad', 'facebook', 'boost', 'biggapon', 'bigapon'],
  DELIVERY: ['delivery', 'courier', 'kuriyar', 'curier', 'pathao', 'parcel', 'shipping'],
  TRIP: ['trip', 'purchase', 'kenakata', 'mal kena', 'jatra', 'jatayat', 'travel'],
  EQUIPMENT_OTHER: ['equipment', 'machine', 'jontrapati', 'jantrapati', 'repair', 'meramot', 'other'],
  OWNER_DRAWING: ['owner', 'malik', 'drawing', 'personal', 'nijer taka'],
  INVENTORY_LOSS: ['inventory', 'stock', 'loss', 'noshto', 'nasto', 'harano', 'churi', 'damage'],
  SETUP_CAPEX: ['setup', 'setap', 'assets', 'asset', 'decoration', 'renovation', 'deposit'],
  CUSTOM_PRODUCT_DAMAGE_LOSS: ['damage', 'product damage', 'noshto product', 'nasto product', 'loss'],
};

const CATEGORY_NAME_SEARCH_ALIASES: Record<string, string[]> = {
  'Product Damage Loss': ['product damage', 'damage loss', 'noshto product', 'nasto product'],
  'Courier Charge': ['courier', 'kuriyar', 'curier', 'delivery charge'],
  'Return Charge': ['return', 'ritarn', 'ferot', 'back charge'],
  'Packaging Materials': ['packaging', 'packet', 'packet khoroch', 'carton', 'box'],
  'Shop Rent': ['rent', 'vara', 'bhara', 'dokan vara', 'shop vara'],
  'Electricity Bill': ['electricity', 'current', 'karent', 'bidyut', 'bill'],
  'Internet & Mobile': ['internet', 'mobile', 'phone', 'net bill'],
  'Staff Salary': ['staff salary', 'salary', 'beton', 'betan'],
  'Staff Food & Tea': ['staff food', 'cha', 'tea', 'nasta', 'khawa'],
  'Facebook Ads / Boost': ['facebook', 'fb', 'boost', 'ads', 'biggapon'],
  'Transport / Rickshaw': ['transport', 'rickshaw', 'riksha', 'van', 'vara', 'bhara'],
  'bKash / Bank Charge': ['bkash', 'bikas', 'bank', 'charge', 'mfs'],
  Miscellaneous: ['misc', 'miscellaneous', 'other', 'onnanno', 'bibidh'],
};

const SUBTYPE_SEARCH_ALIASES: Record<string, string[]> = {
  Rent: ['rent', 'vara', 'bhara', 'dokan vara', 'dokaner vara', 'shop rent'],
  Electricity: ['electricity', 'current', 'karent', 'bidyut', 'electric bill'],
  Internet: ['internet', 'net', 'wifi', 'broadband'],
  Stationery: ['stationery', 'khata', 'kolom', 'pen', 'paper'],
  Cleaning: ['cleaning', 'porishkar', 'saf', 'safa', 'jharu'],
  'Mobile/Phone Bill': ['mobile', 'phone', 'sim', 'recharge', 'bill'],
  'Bank/MFS Charge': ['bank', 'bkash', 'bikas', 'nagad', 'mfs', 'charge'],
  Salary: ['salary', 'beton', 'betan', 'staff beton'],
  'Delivery rider salary': ['delivery salary', 'rider salary', 'delivery man beton', 'rider beton'],
  Bonus: ['bonus', 'bokshish', 'extra taka'],
  Advance: ['advance', 'ogrim', 'agrim', 'age taka'],
  Overtime: ['overtime', 'ot', 'extra duty'],
  'Transport allowance': ['transport allowance', 'jatayat vata', 'travel allowance'],
  'Facebook Ads': ['facebook ads', 'fb ads', 'facebook ad', 'biggapon'],
  'Boost post': ['boost', 'post boost', 'facebook boost', 'fb boost'],
  Banner: ['banner', 'banar', 'poster'],
  'Packaging design': ['packaging design', 'packet design', 'design'],
  'Promotional gift': ['gift', 'promo gift', 'promotion gift'],
  'Courier fee': ['courier', 'kuriyar', 'curier', 'delivery fee', 'parcel'],
  'Return charge': ['return', 'return charge', 'ritarn', 'ferot', 'parcel ferot'],
  'COD collection charge': ['cod', 'cash on delivery', 'collection charge', 'taka tolar charge'],
  Petrol: ['petrol', 'tel', 'tell', 'oil', 'fuel'],
  'Van/Rickshaw rent': ['van', 'rickshaw', 'riksha', 'ricksha', 'vara', 'bhara'],
  'Vehicle maintenance': ['gari meramot', 'garir meramot', 'gari repair', 'vehicle repair', 'maintenance'],
  'Toll/Ferry': ['toll', 'ferry', 'feri'],
  Parking: ['parking', 'parking fee'],
  'Packaging Materials': ['packaging', 'packet', 'carton', 'box', 'poly', 'packet khoroch'],
  'Flight ticket': ['flight', 'ticket', 'biman ticket', 'plane ticket'],
  Hotel: ['hotel', 'thaka', 'room'],
  Food: ['food', 'khawa', 'khabar', 'nasta'],
  'Visa fee': ['visa', 'visa fee'],
  Customs: ['customs', 'tax', 'vat', 'shulk'],
  'Local transport': ['local transport', 'local vara', 'jatayat', 'transport'],
  'Equipment purchase': ['equipment', 'machine', 'jontrapati', 'jantrapati', 'kinlam', 'purchase'],
  Repair: ['repair', 'meramot', 'thik kora'],
  Furniture: ['furniture', 'chair', 'table', 'rack'],
  Software: ['software', 'app', 'license'],
  Miscellaneous: ['misc', 'other', 'onnanno', 'bibidh'],
  'Personal drawing': ['personal', 'malik', 'owner', 'drawing', 'nijer taka'],
  'Personal transfer': ['personal transfer', 'malik transfer', 'nijer transfer'],
  'Damage Loss': ['damage', 'loss', 'noshto', 'nasto', 'vanga'],
  'Expired/Near-expiry write-off': ['expired', 'expiry', 'meyad', 'meyad sesh', 'write off'],
  'Theft/Pilferage': ['theft', 'churi', 'harano', 'lost'],
  'Stock count adjustment': ['stock adjustment', 'stock milano', 'count adjustment'],
  'Shop Rent Advance/Deposit': ['advance rent', 'deposit', 'security money', 'jamanot', 'vara advance'],
  'Shop Decoration/Renovation': ['decoration', 'renovation', 'sajano', 'decor', 'dokan sajano'],
  'CCTV & Security System': ['cctv', 'camera', 'security'],
  'Signboard/Branding': ['signboard', 'sign board', 'branding', 'banner'],
  'POS/Computer Setup': ['pos', 'computer', 'printer', 'barcode setup', 'setup'],
  'Initial Furniture & Fixtures': ['furniture', 'fixture', 'rack', 'table', 'chair'],
  'Shop/Property Purchase': ['shop purchase', 'property purchase', 'dokan kena', 'jomi'],
  'Business Registration/Trade License': ['trade license', 'registration', 'license', 'business license'],
  Other: ['other', 'onnanno', 'bibidh', 'misc'],
};

const CATEGORY_TILE_STYLES: Record<string, { idle: string; active: string; amount: string }> = {
  DELIVERY: {
    idle: 'border-orange-100 bg-orange-50 hover:border-orange-300',
    active: 'border-orange-500 bg-orange-100',
    amount: 'text-orange-700',
  },
  EQUIPMENT_OTHER: {
    idle: 'border-slate-200 bg-slate-100 hover:border-slate-400',
    active: 'border-slate-600 bg-slate-200',
    amount: 'text-slate-700',
  },
  SETUP_CAPEX: {
    idle: 'border-emerald-100 bg-emerald-50 hover:border-emerald-300',
    active: 'border-emerald-500 bg-emerald-100',
    amount: 'text-emerald-700',
  },
  INVENTORY_LOSS: {
    idle: 'border-red-100 bg-red-50 hover:border-red-300',
    active: 'border-red-500 bg-red-100',
    amount: 'text-red-700',
  },
  MARKETING: {
    idle: 'border-rose-100 bg-rose-50 hover:border-rose-300',
    active: 'border-rose-500 bg-rose-100',
    amount: 'text-rose-700',
  },
  OFFICE: {
    idle: 'border-sky-100 bg-sky-50 hover:border-sky-300',
    active: 'border-sky-500 bg-sky-100',
    amount: 'text-sky-700',
  },
  OWNER_DRAWING: {
    idle: 'border-fuchsia-100 bg-fuchsia-50 hover:border-fuchsia-300',
    active: 'border-fuchsia-500 bg-fuchsia-100',
    amount: 'text-fuchsia-700',
  },
  STAFF: {
    idle: 'border-violet-100 bg-violet-50 hover:border-violet-300',
    active: 'border-violet-500 bg-violet-100',
    amount: 'text-violet-700',
  },
  TRIP: {
    idle: 'border-amber-100 bg-amber-50 hover:border-amber-300',
    active: 'border-amber-500 bg-amber-100',
    amount: 'text-amber-700',
  },
  CUSTOM_PRODUCT_DAMAGE_LOSS: {
    idle: 'border-red-100 bg-red-50 hover:border-red-300',
    active: 'border-red-500 bg-red-100',
    amount: 'text-red-700',
  },
};

function categoryTileStyle(code: string) {
  return CATEGORY_TILE_STYLES[code] ?? {
    idle: 'border-gray-200 bg-gray-100 hover:border-gray-300',
    active: 'border-indigo-500 bg-indigo-50',
    amount: 'text-gray-600',
  };
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// createdAt is the only field that actually carries a real time — when this entry was logged,
// not the (time-less) business date it was logged for. Used to tell apart same-day entries.
function formatLoggedAt(iso: string) {
  const d = new Date(iso);
  const datePart = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const timePart = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${datePart}, ${timePart}`;
}

function displayCategoryName(category: Pick<ExpenseCategoryDto, 'code' | 'name'> | undefined, lang: 'en' | 'bn') {
  if (!category) return '—';
  if (lang !== 'bn') return category.name;
  return CATEGORY_NAME_BN_BY_CODE[category.code] ?? CATEGORY_NAME_BN_BY_NAME[category.name] ?? category.name;
}

function displaySubtypeLabel(subtype: string, lang: 'en' | 'bn') {
  if (lang !== 'bn') return subtype;
  return SUBTYPE_LABEL_BN[subtype] ?? subtype;
}

function searchableText(parts: Array<string | string[] | undefined>) {
  return parts.flatMap(p => Array.isArray(p) ? p : p ? [p] : []).join(' ').toLowerCase();
}

export default function NewExpensePage() {
  const router = useRouter();
  const { lang, t } = useLanguage();
  const qc = useQueryClient();
  const currentBranchId = useAuthStore((s) => s.currentBranchId);
  const canSeeCosts = useAuthStore((s) => s.canSeeCosts());

  const [step, setStep] = useState<Step>('category');
  const [categoryId, setCategoryId] = useState('');
  const [categoryCode, setCategoryCode] = useState('');
  const [subType, setSubType] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState('');
  const [historyPeriod, setHistoryPeriod] = useState<ReportPeriod>('30d');
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('today');
  const [reportGroupBy, setReportGroupBy] = useState<GroupBy>('day');
  const [showCategoryCostReport, setShowCategoryCostReport] = useState(false);
  const [showAllToday, setShowAllToday] = useState(false);
  const [showTodayDetails, setShowTodayDetails] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [hotCosts, setHotCosts] = useState<HotCostShortcut[]>([]);
  const [showHotCostPicker, setShowHotCostPicker] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(HOT_COST_STORAGE_KEY);
      if (saved) setHotCosts(JSON.parse(saved));
    } catch {
      setHotCosts([]);
    }
  }, []);

  const saveHotCosts = (next: HotCostShortcut[]) => {
    setHotCosts(next);
    localStorage.setItem(HOT_COST_STORAGE_KEY, JSON.stringify(next));
  };

  const { data: cats = [], isLoading: catsLoading } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: getExpenseCategories,
  });

  // Last-30-days total per category — shown right on the category tiles so staff can see at a
  // glance where money's already gone before picking where to log a new entry.
  const { data: allRecentResult } = useQuery({
    queryKey: ['expense-history-all', '30d', currentBranchId],
    queryFn: () => listExpenses({ ...periodToDates('30d'), pageSize: 200 }),
    enabled: step === 'category',
  });
  const totalsByCategory = (allRecentResult?.items ?? []).reduce<Record<string, number>>((acc, e) => {
    acc[e.categoryId] = (acc[e.categoryId] ?? 0) + e.amount;
    return acc;
  }, {});

  const reportDates = periodToDates(reportPeriod);
  const { data: expenseReport, isLoading: expenseReportLoading } = useQuery({
    queryKey: ['expense-entry-financial-report', reportDates.from, reportDates.to, reportGroupBy, currentBranchId],
    queryFn: () => getPnlReport({ from: reportDates.from, to: reportDates.to, groupBy: reportGroupBy }),
    enabled: step === 'category' && canSeeCosts && showCategoryCostReport,
    staleTime: 60_000,
  });

  // Today's entries, most recent first — a quick "what's already been logged today" summary
  // above the category grid, so staff don't have to leave this page to sanity-check that.
  const todayExpenses = (allRecentResult?.items ?? [])
    .filter(e => e.expenseDate.slice(0, 10) === todayStr())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const todayTotal = todayExpenses.reduce((s, e) => s + e.amount, 0);
  const TODAY_PREVIEW_COUNT = 5;
  const visibleTodayExpenses = showAllToday ? todayExpenses : todayExpenses.slice(0, TODAY_PREVIEW_COUNT);

  // Recent spend in this category — shown on the subtype step so staff can see what's already
  // been logged (e.g. "we already paid rent this month?") before adding another entry.
  const { data: historyResult, isLoading: historyLoading } = useQuery({
    queryKey: ['expense-history', categoryId, historyPeriod, currentBranchId],
    queryFn: () => listExpenses({ categoryId, ...periodToDates(historyPeriod), pageSize: 20 }),
    enabled: (step === 'subtype' || step === 'amountDate') && !!categoryId,
  });
  const history = historyResult?.items ?? [];
  const selectedSubtypeHistory = subType
    ? history.filter(e => e.subType === subType)
    : [];
  const selectedSubtypeTodayEntries = selectedSubtypeHistory
    .filter(e => e.expenseDate.slice(0, 10) === todayStr());
  const selectedSubtypeTodayTotal = selectedSubtypeHistory
    .filter(e => e.expenseDate.slice(0, 10) === todayStr())
    .reduce((s, e) => s + e.amount, 0);
  const selectedSubtypeTodayLabel = selectedSubtypeTodayEntries.length > 0
    ? `${t('expenses.today')} (${selectedSubtypeTodayEntries.length} ${lang === 'bn' ? 'বার' : selectedSubtypeTodayEntries.length === 1 ? 'time' : 'times'})`
    : t('expenses.today');

  // Grouped by subtype — a flat chronological list read like a confusing wall of repeated dates
  // once the same subtype (e.g. "Courier fee") had several entries; grouping answers "how much
  // and when, for this specific thing" at a glance instead.
  const historyBySubtype = history.reduce<Record<string, typeof history>>((acc, e) => {
    (acc[e.subType] ??= []).push(e);
    return acc;
  }, {});

  const mutation = useMutation({
    mutationFn: () => createExpense({
      categoryId,
      subType: subType.trim(),
      amount: parseFloat(amount),
      expenseDate: date,
      isRecurring: false,
      note: note.trim() || null,
    }),
    // No navigation at all — just close the sheet and land back on the subtype screen (same
    // category) so logging several entries in a row doesn't bounce you off the page each time.
    onSuccess: () => {
      useToastStore.getState().show(t('expenses.saved'));
      qc.invalidateQueries({ queryKey: ['expense-history'] });
      qc.invalidateQueries({ queryKey: ['expense-history-all'] });
      setSubType('');
      setAmount('');
      setDate(todayStr());
      setNote('');
      setStep('subtype');
    },
    onError: (err: unknown) => toastError(err, t('expenses.failedCreate')),
  });

  const stepIndex = STEPS.indexOf(step);

  function goBack() {
    if (stepIndex === 0) { router.back(); return; }
    if (step === 'subtype') { setStep('category'); return; }
    setStep(STEPS[stepIndex - 1]);
  }

  function goNext() {
    if (step === 'amountDate') {
      const n = parseFloat(amount);
      if (!amount || isNaN(n) || n <= 0) { useToastStore.getState().show(t('expenses.enterAmount'), 'error'); return; }
      if (!date) { useToastStore.getState().show(t('expenses.selectDate'), 'error'); return; }
      setStep('note');
    } else if (step === 'note') {
      // "Other" carries no descriptive info on its own — without a note it'd just be an
      // unexplained amount sitting under a generic bucket forever.
      if (subType === OTHER_SUBTYPE && !note.trim()) {
        useToastStore.getState().show(t('expenses.otherNeedsNote'), 'error');
        return;
      }
      mutation.mutate();
    }
  }

  function chooseSubtype(category: ExpenseCategoryDto, subtype: string) {
    setCategoryId(category.id);
    setCategoryCode(category.code);
    setSubType(subtype);
    setCategorySearch('');
    setStep('amountDate');
  }

  function addHotCost(category: ExpenseCategoryDto, subtype: string) {
    const exists = hotCosts.some(x => x.categoryId === category.id && x.subtype === subtype);
    if (exists) {
      useToastStore.getState().show(lang === 'bn' ? 'আগেই যোগ করা আছে।' : 'Already added.');
      return;
    }
    saveHotCosts([
      ...hotCosts,
      {
        categoryId: category.id,
        categoryCode: category.code,
        categoryName: category.name,
        subtype,
      },
    ]);
    useToastStore.getState().show(lang === 'bn' ? 'শর্টকাটে যোগ করা হয়েছে।' : 'Added to shortcuts.');
  }

  function removeHotCost(shortcut: HotCostShortcut) {
    saveHotCosts(hotCosts.filter(x => !(x.categoryId === shortcut.categoryId && x.subtype === shortcut.subtype)));
  }

  function chooseHotCost(shortcut: HotCostShortcut) {
    setCategoryId(shortcut.categoryId);
    setCategoryCode(shortcut.categoryCode);
    setSubType(shortcut.subtype);
    setCategorySearch('');
    setStep('amountDate');
  }

  const quickSubtypes = QUICK_SUBTYPES[categoryCode] ?? [];
  const selectedCategory = (cats as ExpenseCategoryDto[]).find(c => c.id === categoryId);
  const categorySearchTerm = categorySearch.trim().toLowerCase();
  const categorySearchResult = (cats as ExpenseCategoryDto[])
    .map(c => {
      const categoryLabel = displayCategoryName(c, lang);
      const subtypeMatches = (QUICK_SUBTYPES[c.code] ?? [])
        .filter(s => {
          const haystack = searchableText([
            s,
            displaySubtypeLabel(s, 'bn'),
            SUBTYPE_SEARCH_ALIASES[s],
          ]);
          return categorySearchTerm && haystack.includes(categorySearchTerm);
        });
      const categoryHaystack = searchableText([
        c.code,
        c.name,
        categoryLabel,
        CATEGORY_NAME_BN_BY_NAME[c.name],
        CATEGORY_SEARCH_ALIASES[c.code],
        CATEGORY_NAME_SEARCH_ALIASES[c.name],
      ]);
      const categoryMatches = categorySearchTerm
        ? categoryHaystack.includes(categorySearchTerm)
        : true;
      return { category: c, categoryMatches, subtypeMatches };
    })
    .filter(r => !categorySearchTerm || r.categoryMatches || r.subtypeMatches.length > 0);
  const directSubtypeResults = categorySearchTerm
    ? categorySearchResult.flatMap(({ category, subtypeMatches }) =>
        subtypeMatches.map(subtype => ({ category, subtype }))
      )
    : [];
  const hotCostOptions = (cats as ExpenseCategoryDto[]).flatMap(category =>
    (QUICK_SUBTYPES[category.code] ?? []).map(subtype => ({ category, subtype }))
  );
  const pageTitle =
    step === 'hotCosts'
      ? (lang === 'bn' ? 'বারবার ব্যবহৃত খরচ' : 'Frequent Costs')
      : step === 'subtype'
        ? displayCategoryName(selectedCategory, lang)
        : (step === 'amountDate' || step === 'note') && selectedCategory
          ? displaySubtypeLabel(subType, lang)
          : t('expenses.newTitle');

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={goBack} className="text-gray-500 p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="flex-1 text-base font-semibold text-gray-900 truncate">{pageTitle}</h1>
        {canSeeCosts && (
          <Link
            href="/more/reports/financial"
            className="shrink-0 rounded-xl border border-rose-950 bg-rose-950 px-3 py-1.5 text-xs font-semibold text-white shadow-sm active:bg-rose-900"
          >
            {lang === 'bn' ? 'বিস্তারিত আর্থিক রিপোর্ট' : 'Details Financial Report'}
          </Link>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">

        {/* STEP 1: Category */}
        {step === 'category' && (
          <>
            {/* Today's total, with an expandable line-by-line breakdown — a running sanity check
                right where entries get added, so staff can see what's already been logged today
                without leaving this page. */}
            {todayExpenses.length > 0 && (
              <div className="bg-indigo-50 rounded-2xl p-4">
                <button
                  onClick={() => setShowTodayDetails(v => !v)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <p className="text-sm font-semibold text-indigo-900">{t('expenses.todayTotal')}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-bold text-indigo-700">৳{todayTotal.toLocaleString()}</p>
                    <ChevronDownIcon className={`w-4 h-4 text-indigo-500 transition-transform ${showTodayDetails ? 'rotate-180' : ''}`} />
                  </div>
                </button>
                {showTodayDetails && (
                  <>
                    <p className="text-xs font-medium text-indigo-500 mt-3 mb-1.5">{t('expenses.details')}</p>
                    <div className="space-y-1.5">
                      {visibleTodayExpenses.map(e => (
                        <div key={e.id} className="flex items-center justify-between text-sm">
                          <span className="text-gray-700 truncate">
                            {displaySubtypeLabel(e.subType, lang)} <span className="text-xs text-gray-400">({new Date(e.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })})</span>
                          </span>
                          <span className="font-medium text-gray-900 shrink-0 ml-2">৳{e.amount.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                    {todayExpenses.length > TODAY_PREVIEW_COUNT && (
                      <button
                        onClick={() => setShowAllToday(v => !v)}
                        className="mt-2 text-xs font-semibold text-indigo-600"
                      >
                        {showAllToday
                          ? t('common.showLess')
                          : `${t('common.showMore')} (${visibleTodayExpenses.length}/${todayExpenses.length})`}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            <p className="text-lg font-semibold text-gray-900">{t('expenses.stepCategory')}</p>
            <button
              onClick={() => setStep('hotCosts')}
              className="w-full flex items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50/70 px-3 py-3 text-left shadow-sm active:bg-rose-100"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {lang === 'bn' ? 'বারবার ব্যবহৃত খরচের শর্টকাট' : 'Frequent Cost Shortcuts'}
                </p>
                <p className="text-xs text-rose-400 mt-0.5">
                  {lang === 'bn'
                    ? `${hotCosts.length}টি শর্টকাট`
                    : `${hotCosts.length} shortcut${hotCosts.length === 1 ? '' : 's'}`}
                </p>
              </div>
              <svg className="w-4 h-4 text-rose-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <input
              value={categorySearch}
              onChange={e => setCategorySearch(e.target.value)}
              placeholder={lang === 'bn' ? 'খরচ খুঁজুন: কুরিয়ার, courier, tel, beton...' : 'Search cost: courier, tel, salary...'}
              className="w-full h-12 px-4 rounded-2xl border border-gray-200 bg-gray-50 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {catsLoading ? (
              <div className="h-40 flex items-center justify-center text-gray-400 text-sm">{t('common.loading')}</div>
            ) : categorySearchResult.length === 0 ? (
              <div className="h-28 flex items-center justify-center rounded-2xl border border-dashed border-gray-200 text-gray-400 text-sm">
                {lang === 'bn' ? 'এই নামে কোনো খরচ পাওয়া যায়নি।' : 'No matching cost category found.'}
              </div>
            ) : (
              <>
                {directSubtypeResults.length > 0 && (
                  <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-3">
                    <p className="mb-2 text-xs font-semibold text-indigo-700">
                      {lang === 'bn' ? 'সরাসরি খরচের খাত' : 'Direct Matches'}
                    </p>
                    <div className="space-y-2">
                      {directSubtypeResults.map(({ category, subtype }) => (
                        <div
                          key={`${category.id}-${subtype}`}
                          className="w-full rounded-xl border border-white bg-white px-3 py-2.5 text-left shadow-sm"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xl shrink-0">{EXPENSE_CATEGORY_ICONS[category.code] ?? '📋'}</span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-gray-950 truncate">{displaySubtypeLabel(subtype, lang)}</p>
                              <p className="text-xs text-gray-500 truncate">{displayCategoryName(category, lang)}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => chooseSubtype(category, subtype)}
                              className="shrink-0 rounded-full bg-indigo-600 px-2 py-1 text-center text-[10px] font-semibold text-white"
                            >
                              {lang === 'bn' ? 'নিন' : 'Select'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {categorySearchResult.map(({ category: c, subtypeMatches }) => {
                    const tile = categoryTileStyle(c.code);
                    return (
                      <button
                        key={c.id}
                        onClick={() => { setCategoryId(c.id); setCategoryCode(c.code); setStep('subtype'); }}
                        className={`flex flex-col items-start gap-2 p-4 rounded-2xl border-2 text-left transition-all shadow-sm ${
                          categoryId === c.id ? tile.active : tile.idle
                        }`}
                      >
                        <div className="w-full flex items-center justify-between">
                          <span className="text-2xl">{EXPENSE_CATEGORY_ICONS[c.code] ?? '📋'}</span>
                          <span className={`text-sm font-bold ${tile.amount}`}>
                            ৳{(totalsByCategory[c.id] ?? 0).toLocaleString()}
                          </span>
                        </div>
                        <span className="text-sm font-semibold text-gray-950 leading-tight">{displayCategoryName(c, lang)}</span>
                        {categorySearchTerm && subtypeMatches.length > 0 && (
                          <span className="text-[11px] font-medium text-gray-600 leading-tight">
                            {lang === 'bn' ? 'মিলে গেছে: ' : 'Matched: '}
                            {subtypeMatches.slice(0, 2).map(s => displaySubtypeLabel(s, lang)).join(', ')}
                            {subtypeMatches.length > 2 ? '…' : ''}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {canSeeCosts && (
              <div className="pt-2">
                {!showCategoryCostReport ? (
                  <button
                    onClick={() => setShowCategoryCostReport(true)}
                    className="w-full rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 shadow-sm"
                  >
                    {lang === 'bn' ? 'ক্যাটাগরি অনুযায়ী খরচ দেখুন' : 'Show Cost by Category'}
                  </button>
                ) : (
                  <div className="-mx-4">
                    <div className="px-4 pb-2 flex justify-end">
                      <button
                        onClick={() => setShowCategoryCostReport(false)}
                        className="text-xs font-semibold text-gray-400"
                      >
                        {lang === 'bn' ? 'লুকান' : 'Hide'}
                      </button>
                    </div>
                    <DateRangeBar
                      period={reportPeriod}
                      onPeriod={setReportPeriod}
                      groupBy={reportGroupBy}
                      onGroupBy={setReportGroupBy}
                    />
                    <div className="px-4">
                      {expenseReportLoading ? (
                        <div className="flex items-center justify-center h-28 text-gray-400 text-sm">{t('common.loading')}</div>
                      ) : expenseReport ? (
                        <ExpenseCategoryBreakdown categories={expenseReport.expenseByCategory} defaultExpanded />
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* STEP 1B: Hot cost shortcut list */}
        {step === 'hotCosts' && (
          <>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-gray-900">
                  {lang === 'bn' ? 'বারবার ব্যবহৃত খরচের শর্টকাট' : 'Frequent Cost Shortcuts'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {lang === 'bn'
                    ? 'বিদ্যমান খরচের খাত থেকে বানানো শর্টকাট'
                    : 'Shortcuts made from existing cost items'}
                </p>
              </div>
              <button
                onClick={() => setShowHotCostPicker(true)}
                className="shrink-0 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white"
              >
                {lang === 'bn' ? 'খরচ বাছাই' : 'Choose Costs'}
              </button>
            </div>

            {hotCosts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center">
                <p className="text-sm font-medium text-gray-500">
                  {lang === 'bn' ? 'এখনো কোনো শর্টকাট নেই।' : 'No shortcuts yet.'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {lang === 'bn'
                    ? 'উপরের বাছাই বাটন থেকে বিদ্যমান সাব খরচ যোগ করুন।'
                    : 'Use the choose button above to add existing sub costs.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {hotCosts.map(shortcut => (
                  <button
                    key={`${shortcut.categoryId}-${shortcut.subtype}`}
                    onClick={() => chooseHotCost(shortcut)}
                    className="w-full rounded-2xl border border-indigo-100 bg-indigo-50/60 px-3 py-3 text-left shadow-sm active:bg-indigo-100"
                  >
                    <p className="text-sm font-semibold text-gray-900">{displaySubtypeLabel(shortcut.subtype, lang)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {displayCategoryName({ code: shortcut.categoryCode, name: shortcut.categoryName }, lang)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* STEP 2: Sub-type */}
        {step === 'subtype' && (
          <>
            <p className="text-lg font-semibold text-gray-900">{t('expenses.stepSubtype')}</p>
            <div className="flex flex-wrap gap-2">
              {quickSubtypes.map(q => (
                <button
                  key={q}
                  onClick={() => { setSubType(q); setStep('amountDate'); }}
                  className={`px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                    subType === q
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  {displaySubtypeLabel(q, lang)}
                </button>
              ))}
              <button
                onClick={() => { setSubType(OTHER_SUBTYPE); setStep('amountDate'); }}
                className={`px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                  subType === OTHER_SUBTYPE
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-700 border-dashed border-gray-300 hover:border-indigo-300'
                }`}
              >
                {displaySubtypeLabel(OTHER_SUBTYPE, lang)}
              </button>
            </div>

            {/* Recent spend in this category — context while deciding which subtype to log next. */}
            <div className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-gray-700">{t('expenses.recentHistory')}</p>
                <div className="flex bg-gray-100 rounded-xl p-0.5">
                  {HISTORY_PERIODS.map(p => (
                    <button
                      key={p.key}
                      onClick={() => setHistoryPeriod(p.key)}
                      className={`px-2.5 py-1 rounded-[10px] text-xs font-semibold transition-colors ${
                        historyPeriod === p.key ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {historyLoading ? (
                <div className="h-16 flex items-center justify-center text-gray-400 text-xs">{t('common.loading')}</div>
              ) : history.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">{t('expenses.noHistory')}</p>
              ) : (
                <div className="border border-gray-100 rounded-xl divide-y divide-gray-100">
                  {Object.entries(historyBySubtype).map(([subtype, entries]) => (
                    <div key={subtype} className="px-3 py-2.5">
                      <p className="text-sm font-semibold text-gray-800 mb-1.5">{displaySubtypeLabel(subtype, lang)}</p>
                      <div className="space-y-1">
                        {entries.map(e => (
                          <div key={e.id} className="flex items-center justify-between text-xs">
                            <span className="text-gray-400">{formatLoggedAt(e.createdAt)}</span>
                            <span className="font-medium text-gray-700">৳{e.amount.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

      </div>

      <SlidePanel
        open={showHotCostPicker}
        onClose={() => setShowHotCostPicker(false)}
        title={lang === 'bn' ? 'বারবার ব্যবহৃত খরচ বাছাই করুন' : 'Choose Frequent Costs'}
      >
        <div className="px-4 py-4 space-y-2">
          {hotCostOptions.map(({ category, subtype }) => {
            const selected = hotCosts.some(x => x.categoryId === category.id && x.subtype === subtype);
            const shortcut: HotCostShortcut = {
              categoryId: category.id,
              categoryCode: category.code,
              categoryName: category.name,
              subtype,
            };
            return (
              <div
                key={`${category.id}-${subtype}`}
                className={`flex items-center gap-3 rounded-2xl border px-3 py-3 ${
                  selected ? 'border-indigo-200 bg-indigo-50' : 'border-gray-100 bg-white'
                }`}
              >
                <span className="text-xl shrink-0">{EXPENSE_CATEGORY_ICONS[category.code] ?? '📋'}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 truncate">{displaySubtypeLabel(subtype, lang)}</p>
                  <p className="text-xs text-gray-400 truncate">{displayCategoryName(category, lang)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => selected ? removeHotCost(shortcut) : addHotCost(category, subtype)}
                  className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ${
                    selected
                      ? 'bg-white text-red-500'
                      : 'bg-indigo-600 text-white'
                  }`}
                >
                  {selected
                    ? (lang === 'bn' ? 'সরান' : 'Remove')
                    : (lang === 'bn' ? 'যোগ করুন' : 'Add')}
                </button>
              </div>
            );
          })}
        </div>
      </SlidePanel>

      {/* Amount + Date — bottom slide instead of a full-page step, same shared SlidePanel used
          elsewhere in the app (e.g. the courier manager popup on orders/new). */}
      <SlidePanel
        open={step === 'amountDate'}
        onClose={goBack}
        title={t('expenses.stepAmount')}
        footer={
          <button
            onClick={goNext}
            disabled={!amount || parseFloat(amount) <= 0}
            className="w-full h-14 rounded-2xl bg-indigo-600 text-white font-bold text-base disabled:opacity-40 transition-opacity"
          >
            {t('expenses.next')}
          </button>
        }
      >
        <div className="px-4 py-4 space-y-4">
          {/* Which category/subtype this amount is for — easy to lose track of once the amount
              step is its own sheet, separated from the category/subtype screens behind it. */}
          <div className="flex items-center gap-2 bg-indigo-50 rounded-xl px-3 py-2.5">
            <span className="text-xl shrink-0">{EXPENSE_CATEGORY_ICONS[categoryCode] ?? '📋'}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-indigo-900 truncate">{displaySubtypeLabel(subType, lang)}</p>
              <p className="text-xs text-indigo-500 truncate">
                {displayCategoryName(selectedCategory, lang)}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[10px] font-semibold uppercase text-indigo-400">{selectedSubtypeTodayLabel}</p>
              <p className="text-sm font-bold text-indigo-900 tabular-nums">৳{selectedSubtypeTodayTotal.toLocaleString()}</p>
            </div>
          </div>

          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg">৳</span>
            <input
              autoFocus
              type="number"
              inputMode="decimal"
              min="0"
              placeholder="0"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && goNext()}
              className="w-full h-14 pl-9 pr-4 rounded-xl border border-gray-200 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {QUICK_AMOUNTS.map(n => (
              <button
                key={n}
                onClick={() => setAmount(String(n))}
                className={`h-10 rounded-xl border text-sm font-semibold transition-all ${
                  amount === String(n)
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-indigo-300'
                }`}
              >
                ৳{n.toLocaleString()}
              </button>
            ))}
          </div>

          <div className="space-y-2 pt-2">
            <p className="text-lg font-semibold text-gray-900">{t('expenses.stepDate')}</p>
            <div className="flex items-center gap-2">
              {[
                { label: t('expenses.today'), val: todayStr() },
                { label: t('expenses.yesterday'), val: (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })() },
              ].map(({ label, val }) => (
                <button
                  key={val}
                  onClick={() => setDate(val)}
                  className={`flex-1 h-10 rounded-xl border text-sm font-medium transition-all ${
                    date === val
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  {label}
                </button>
              ))}
              <input
                type="date"
                value={date}
                max={todayStr()}
                onChange={e => setDate(e.target.value)}
                className="flex-[1.35] min-w-0 h-10 px-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="rounded-2xl bg-amber-50/80 border border-amber-100 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-amber-900">{t('expenses.recentHistory')}</p>
              <div className="flex bg-amber-100 rounded-xl p-0.5">
                {HISTORY_PERIODS.map(p => (
                  <button
                    key={p.key}
                    onClick={() => setHistoryPeriod(p.key)}
                    className={`px-2.5 py-1 rounded-[10px] text-xs font-semibold transition-colors ${
                      historyPeriod === p.key ? 'bg-white text-amber-700 shadow-sm' : 'text-amber-700/70'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {historyLoading ? (
              <div className="h-16 flex items-center justify-center text-gray-400 text-xs">{t('common.loading')}</div>
            ) : selectedSubtypeHistory.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">{t('expenses.noHistory')}</p>
            ) : (
              <div className="border border-amber-100 bg-white/80 rounded-xl divide-y divide-amber-50">
                <div className="px-3 py-2.5">
                  <p className="text-sm font-semibold text-gray-800 mb-1.5">{displaySubtypeLabel(subType, lang)}</p>
                  <div className="space-y-1">
                    {selectedSubtypeHistory.map(e => (
                      <div key={e.id} className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">{formatLoggedAt(e.createdAt)}</span>
                        <span className="font-medium text-gray-700">৳{e.amount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </SlidePanel>

      {/* Note + confirm — same bottom-slide style as the amount+date sheet above, so the two
          final steps read as one consistent pattern instead of a sheet followed by a full page. */}
      <SlidePanel
        open={step === 'note'}
        onClose={goBack}
        title={t('expenses.stepNote')}
        footer={
          <button
            onClick={goNext}
            disabled={mutation.isPending}
            className="w-full h-14 rounded-2xl bg-indigo-600 text-white font-bold text-base disabled:opacity-40 transition-opacity"
          >
            {mutation.isPending ? t('common.saving') : t('common.save')}
          </button>
        }
      >
        <div className="px-4 py-4 space-y-4">
          {/* Summary card */}
          <div className="bg-gray-50 rounded-2xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">{t('expenses.category')}</span>
              <span className="font-medium text-gray-900">{displayCategoryName(selectedCategory, lang)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{t('expenses.subtype')}</span>
              <span className="font-medium text-gray-900">{displaySubtypeLabel(subType, lang)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{t('expenses.amount')}</span>
              <span className="font-bold text-indigo-700 text-base">৳{parseFloat(amount || '0').toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{t('expenses.date')}</span>
              <span className="font-medium text-gray-900">{date}</span>
            </div>
          </div>

          {subType === OTHER_SUBTYPE && (
            <p className="text-xs text-amber-600">{t('expenses.otherNeedsNote')}</p>
          )}
          <textarea
            autoFocus={subType === OTHER_SUBTYPE}
            rows={3}
            placeholder={subType === OTHER_SUBTYPE ? t('expenses.otherSubtype') : t('expenses.notePlaceholder')}
            value={note}
            onChange={e => setNote(e.target.value)}
            className={`w-full px-4 py-3 rounded-xl border text-sm resize-none focus:outline-none focus:ring-2 ${
              subType === OTHER_SUBTYPE ? 'border-amber-300 focus:ring-amber-400' : 'border-gray-200 focus:ring-indigo-500'
            }`}
          />
        </div>
      </SlidePanel>
    </div>
  );
}
