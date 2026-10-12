// Deliberately fixed POC data. No API or business records are read.
export const chatQuestions = [
  { question: "আজকের সেল কত টাকা?", roman: "ajker sale koto taka", answer: "আজকের সেল ২০০০ টাকা।", aliases: ["ajer sale koto taka", "আজকের বিক্রি কত টাকা", "আজকে সেল কত টাকা", "আজকের সেল কত"] },
  { question: "আজকের লাভ কত টাকা?", roman: "ajker lav koto taka", answer: "আজকের লাভ ৫০০ টাকা।", aliases: ["ajker profit koto taka", "ajker labh koto taka"] },
  { question: "আজকের খরচ কত টাকা?", roman: "ajker khoroch koto taka", answer: "আজকের খরচ ৩০০ টাকা।", aliases: ["ajker expense koto taka"] },
  { question: "আজকে কয়টি অর্ডার হয়েছে?", roman: "ajke koyti order hoyeche", answer: "আজকে ১০টি অর্ডার হয়েছে।", aliases: ["ajker order koyta", "আজকের অর্ডার কয়টা"] },
  { question: "আজকে কত টাকা বাকি আছে?", roman: "ajke koto taka baki ache", answer: "আজকে ৭০০ টাকা বাকি আছে।", aliases: ["ajker baki koto taka", "আজকের বাকি কত টাকা"] },
  { question: "আজকে কত টাকা আদায় হয়েছে?", roman: "ajke koto taka aday hoyeche", answer: "আজকে ১৩০০ টাকা আদায় হয়েছে।", aliases: ["ajker collection koto taka", "আজকের কালেকশন কত টাকা"] },
  { question: "স্টকে কয়টি পণ্য আছে?", roman: "stock e koyti ponno ache", answer: "স্টকে ১৫০টি পণ্য আছে।", aliases: ["stock koto", "স্টক কত"] },
  { question: "আজকে কয়জন নতুন কাস্টমার এসেছে?", roman: "ajke koyjon notun customer esheche", answer: "আজকে ৪জন নতুন কাস্টমার এসেছে।", aliases: ["notun customer koyjon", "নতুন কাস্টমার কয়জন"] },
  { question: "কয়টি অর্ডার পেন্ডিং আছে?", roman: "koyti order pending ache", answer: "৩টি অর্ডার পেন্ডিং আছে।", aliases: ["pending order koyta", "পেন্ডিং অর্ডার কয়টা"] },
  { question: "গতকালের সেল কত টাকা?", roman: "gotokaler sale koto taka", answer: "গতকালের সেল ১৮০০ টাকা।", aliases: ["gotokal sale koto taka", "গতকালের বিক্রি কত টাকা"] },
] as const;

export function normalizeQuestion(text: string) {
  return text.normalize("NFC").toLowerCase().replace(/[\p{P}\p{S}]/gu, " ").replace(/\s+/g, " ").trim();
}

export function getPocAnswer(text: string) {
  const normalized = normalizeQuestion(text);
  const match = chatQuestions.find(item => [item.question, item.roman, ...item.aliases]
    .some(question => normalizeQuestion(question) === normalized));
  return match?.answer ?? "এই প্রশ্নের নমুনা উত্তর নেই। নিচের ‘নমুনা প্রশ্ন’ থেকে একটি প্রশ্ন বেছে নিন।";
}
