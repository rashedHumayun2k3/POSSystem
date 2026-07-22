// Lightweight visual aid for the Quick Add Products picker — keyword match first (works for
// both suggested categories like "Handbags" and suggested product names like "Leather Wallet"),
// falling back to a per-business-type default, then a generic tag icon. No image assets to
// source/host, so this can cover the whole suggested-catalog list immediately.

const KEYWORD_EMOJI: [string, string][] = [
  ["earbud", "🎧"], ["headphone", "🎧"], ["phone", "📱"], ["mobile", "📱"],
  ["charger", "🔌"], ["cable", "🔌"], ["smartwatch", "⌚"], ["watch", "⌚"],
  ["backpack", "🎒"], ["wallet", "👛"], ["jewelry", "💍"], ["jewellery", "💍"], ["bag", "👜"],
  ["notebook", "📓"], ["diary", "📓"], ["book", "📖"], ["office", "🖇️"], ["stationery", "✏️"],
  ["saree", "🥻"], ["sari", "🥻"], ["panjabi", "👘"], ["fatua", "👘"], ["three-piece", "👗"], ["threepiece", "👗"],
  ["men", "👔"], ["women", "👗"], ["kid", "👶"], ["baby", "🍼"],
  ["skincare", "🧴"], ["makeup", "💄"], ["hair", "💇"], ["perfume", "🌸"], ["attar", "🌸"], ["beauty", "🪞"],
  ["sandal", "🩴"], ["shoe", "👟"], ["footwear", "👟"],
  ["kitchen", "🍳"], ["storage", "📦"], ["organization", "🗄️"],
  ["toy", "🧸"], ["feeding", "🍼"], ["nursing", "🍼"], ["care", "🧴"],
  ["general", "🏷️"],
];

// Matches the canonical set already used on the business-type onboarding screen
// (frontend/src/app/(app)/onboarding/business-type/page.tsx) — kept identical for consistency.
const BUSINESS_TYPE_EMOJI: Record<string, string> = {
  CLOTHING_FASHION: "👕",
  COSMETICS_BEAUTY: "💄",
  ELECTRONICS_GADGETS: "📱",
  SHOES_FOOTWEAR: "👟",
  BAGS_ACCESSORIES: "👜",
  TOYS_BABY: "🧸",
  HOME_KITCHEN: "🍽️",
  BOOKS_STATIONERY: "📚",
  OTHER: "🗂️",
};

export function getCategoryEmoji(name: string, businessTypeCode?: string): string {
  const lower = name.toLowerCase();
  for (const [keyword, emoji] of KEYWORD_EMOJI) {
    if (lower.includes(keyword)) return emoji;
  }
  if (businessTypeCode && BUSINESS_TYPE_EMOJI[businessTypeCode]) return BUSINESS_TYPE_EMOJI[businessTypeCode];
  return "🏷️";
}

export function getBusinessTypeEmoji(code: string): string {
  return BUSINESS_TYPE_EMOJI[code] ?? "🏷️";
}
