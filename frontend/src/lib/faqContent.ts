export interface FaqEntry {
  question: string;
  questionBn?: string;
  answer: string;
  answerBn?: string;
}

// Static content — mirrors categoryDisplayName's bn-with-fallback pattern rather than i18n JSON,
// since these are long-form paragraphs, not short UI labels.
export const FAQ_ENTRIES: FaqEntry[] = [
  {
    question: "How do I add a new product?",
    questionBn: "নতুন প্রোডাক্ট কীভাবে যোগ করব?",
    answer: "Go to Products → tap the + button → choose a category, add a name, photo, and price. If your category has variant fields (like Size or Color), you can add multiple variants at once.",
    answerBn: "Products পেজে যান → + বাটনে চাপুন → একটি ক্যাটাগরি বেছে নিন, নাম, ছবি এবং দাম দিন। আপনার ক্যাটাগরিতে ভ্যারিয়েন্ট ফিল্ড (যেমন সাইজ বা কালার) থাকলে একসাথে একাধিক ভ্যারিয়েন্ট যোগ করতে পারবেন।",
  },
  {
    question: "How do I create an order?",
    questionBn: "অর্ডার কীভাবে তৈরি করব?",
    answer: "Go to Orders → New Order → search or scan the product, add it to the cart, enter customer details, and confirm. For counter sales, use the Sell (POS) tab instead.",
    answerBn: "Orders পেজে যান → New Order → প্রোডাক্ট সার্চ বা স্ক্যান করুন, কার্টে যোগ করুন, কাস্টমারের তথ্য দিন এবং কনফার্ম করুন। কাউন্টার সেলের জন্য Sell (POS) ট্যাব ব্যবহার করুন।",
  },
  {
    question: "What's the difference between Big Supershop, Small Showroom, and Hawker Shop?",
    questionBn: "বড় সুপারশপ, ছোট শো-রুম এবং হকার দোকানের মধ্যে পার্থক্য কী?",
    answer: "Big Supershop is for shops with a barcode scanner and barcode tags on products. Small Showroom and Hawker Shop are both for sellers without a scanner — they work the same way internally, selling by SKU code instead of scanning. You can change this anytime in Settings → Shop Type.",
    answerBn: "বড় সুপারশপ তাদের জন্য যাদের বারকোড স্ক্যানার এবং প্রোডাক্টে বারকোড ট্যাগ আছে। ছোট শো-রুম এবং হকার দোকান উভয়ই স্ক্যানার ছাড়া বিক্রেতাদের জন্য — এই দুটো সিস্টেমে একইভাবে কাজ করে, স্ক্যান করার বদলে SKU কোড দিয়ে বিক্রি হয়। আপনি Settings → Shop Type থেকে যেকোনো সময় এটি পরিবর্তন করতে পারবেন।",
  },
  {
    question: "How do I reset my password?",
    questionBn: "পাসওয়ার্ড কীভাবে রিসেট করব?",
    answer: "On the login page, tap \"Forgot password?\" and enter your email to receive a 6-digit code. If you don't remember your email, use the \"Can't remember your email?\" option with your phone number and shop name.",
    answerBn: "লগইন পেজে \"পাসওয়ার্ড ভুলে গেছেন?\" এ চাপুন এবং আপনার ইমেইল দিন, একটি ৬-সংখ্যার কোড পাবেন। ইমেইল মনে না থাকলে \"আপনার ইমেইল মনে নেই?\" অপশনে আপনার ফোন নম্বর ও দোকানের নাম দিয়ে খুঁজুন।",
  },
  {
    question: "How do I show my products on the marketplace?",
    questionBn: "মার্কেটপ্লেসে আমার প্রোডাক্ট কীভাবে দেখাবো?",
    answer: "Go to Settings → Storefront and turn on \"Show on Marketplace\", then claim your shop's subdomain. Each product also has its own marketplace visibility toggle on its Info tab.",
    answerBn: "Settings → Storefront এ গিয়ে \"Show on Marketplace\" চালু করুন, তারপর আপনার দোকানের সাবডোমেইন ক্লেইম করুন। প্রতিটি প্রোডাক্টের Info ট্যাবেও আলাদা মার্কেটপ্লেস ভিজিবিলিটি টগল আছে।",
  },
  {
    question: "How do I add staff members?",
    questionBn: "স্টাফ মেম্বার কীভাবে যোগ করব?",
    answer: "Go to Settings → Staff → Add Staff. Enter their name, phone number (used as their login), a password, and their role (Manager, Staff, or Warehouse).",
    answerBn: "Settings → Staff → Add Staff এ যান। তাদের নাম, ফোন নম্বর (লগইনের জন্য ব্যবহৃত হবে), একটি পাসওয়ার্ড এবং রোল (Manager, Staff, বা Warehouse) দিন।",
  },
  {
    question: "What is the Marketplace Price?",
    questionBn: "মার্কেটপ্লেস প্রাইস কী?",
    answer: "It's an optional price shown only on the public marketplace, separate from your normal selling price. Set it from a product's Marketplace tab if you want to run a marketplace-only discount — your shop and POS keep using the normal price.",
    answerBn: "এটি একটি ঐচ্ছিক দাম যা শুধুমাত্র পাবলিক মার্কেটপ্লেসে দেখানো হয়, আপনার সাধারণ বিক্রয় মূল্য থেকে আলাদা। মার্কেটপ্লেসে আলাদা ছাড় দিতে চাইলে প্রোডাক্টের Marketplace ট্যাব থেকে এটি সেট করুন — আপনার শপ ও POS সবসময় সাধারণ দামই ব্যবহার করবে।",
  },
  {
    question: "How do I record a purchase from a supplier?",
    questionBn: "সাপ্লায়ারের কাছ থেকে কেনাকাটা কীভাবে রেকর্ড করব?",
    answer: "Go to Purchases → New Trip, pick or add a supplier, then add the products you're buying with quantity and cost. Once the goods arrive, mark the trip as received to update your stock.",
    answerBn: "Purchases → New Trip এ যান, একজন সাপ্লায়ার বেছে নিন বা যোগ করুন, তারপর যে প্রোডাক্ট কিনছেন তার পরিমাণ ও দাম দিয়ে যোগ করুন। মাল হাতে পাওয়ার পর ট্রিপটি received হিসেবে মার্ক করুন, স্টক আপডেট হয়ে যাবে।",
  },
];

export function faqText(entry: FaqEntry, lang: string): { question: string; answer: string } {
  return {
    question: lang === "bn" && entry.questionBn ? entry.questionBn : entry.question,
    answer: lang === "bn" && entry.answerBn ? entry.answerBn : entry.answer,
  };
}
