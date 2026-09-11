// Suggested categories are fixed system seed data (same 37 across every business), not
// user-entered — so unlike Category.nameBn (see categoryDisplay.ts), there's no per-business
// Bangla name stored in the database. This is a static translation table instead. If the seed
// list grows, add the new English name here too.
const SUGGESTED_CATEGORY_BN: Record<string, string> = {
  "Handbags": "হ্যান্ডব্যাগ",
  "Backpacks": "ব্যাকপ্যাক",
  "Wallets": "মানিব্যাগ",
  "Jewelry": "গহনা",
  "Watches": "ঘড়ি",
  "Books": "বই",
  "Notebooks & Diaries": "নোটবুক ও ডায়েরি",
  "Office Supplies": "অফিস সামগ্রী",
  "Men's Wear": "পুরুষদের পোশাক",
  "Women's Wear": "মহিলাদের পোশাক",
  "Kids' Wear": "শিশুদের পোশাক",
  "Panjabi/Fatua": "পাঞ্জাবি/ফতুয়া",
  "Saree": "শাড়ি",
  "Three-Piece": "থ্রি-পিস",
  "Skincare": "স্কিনকেয়ার",
  "Makeup": "মেকআপ",
  "Haircare": "হেয়ারকেয়ার",
  "Perfume/Attar": "পারফিউম/আতর",
  "Beauty Tools": "বিউটি টুলস",
  "Mobile Phones": "মোবাইল ফোন",
  "Mobile Accessories": "মোবাইল এক্সেসরিজ",
  "Earbuds/Headphones": "ইয়ারবাড/হেডফোন",
  "Chargers/Cables": "চার্জার/ক্যাবল",
  "Smartwatches": "স্মার্টওয়াচ",
  "Kitchenware": "রান্নাঘরের সামগ্রী",
  "Home Decor": "হোম ডেকর",
  "Bedding": "বিছানার চাদর",
  "Storage & Organization": "স্টোরেজ ও গোছানোর সামগ্রী",
  "General": "সাধারণ",
  "Men's Shoes": "পুরুষদের জুতা",
  "Women's Shoes": "মহিলাদের জুতা",
  "Kids' Shoes": "শিশুদের জুতা",
  "Sandals": "স্যান্ডেল",
  "Toys": "খেলনা",
  "Baby Clothing": "শিশুর পোশাক",
  "Baby Care": "শিশুর যত্ন",
  "Feeding & Nursing": "ফিডিং ও নার্সিং",
};

export function suggestedCategoryDisplayName(name: string, lang: string): string {
  if (lang !== "bn") return name;
  return SUGGESTED_CATEGORY_BN[name] ?? name;
}
