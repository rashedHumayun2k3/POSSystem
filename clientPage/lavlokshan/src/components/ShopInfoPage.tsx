"use client";

import Link from "next/link";
import { useShopContext } from "@/context/ShopContext";

const DEFAULTS = {
  about: (shopName?: string) => `Welcome to ${shopName ?? "our shop"}. We are happy to serve you with quality products and friendly support.`,
  delivery: "Delivery times and charges may vary by location. Please contact the shop for details before placing a time-sensitive order.",
  returns: "Please contact the shop for return or exchange support. Return eligibility may depend on product condition, timing, and order details.",
  privacy: "Customer information is used to process orders, delivery, and support requests. The shop only asks for details needed to serve you.",
  terms: "Product availability, prices, delivery charges, and offers may change. Orders are confirmed after the shop reviews stock and delivery details.",
};

export function ShopInfoShell({ title, children }: { title: string; children: React.ReactNode }) {
  const { shopName } = useShopContext();

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <Link href="/" className="text-xs font-medium text-indigo-600">Home</Link>
        <h1 className="text-xl font-bold text-gray-900 mt-2">{title}</h1>
        <p className="text-sm text-gray-500 mt-1">{shopName ?? "Shop"}</p>
      </div>
      <div className="px-4 py-5">
        <div className="bg-white border border-gray-100 rounded-xl p-4 text-sm leading-6 text-gray-700">
          {children}
        </div>
      </div>
    </main>
  );
}

export function AboutContent() {
  const { shopName, websiteSettings } = useShopContext();
  return <RichContent html={websiteSettings?.aboutText} fallback={DEFAULTS.about(shopName)} />;
}

export function ContactContent() {
  const { websiteSettings } = useShopContext();
  const whatsapp = websiteSettings?.whatsappNumber ?? websiteSettings?.contactPhone;
  const whatsappHref = whatsapp ? `https://wa.me/${whatsapp.replace(/\D/g, "")}` : null;

  return (
    <div className="space-y-3">
      <InfoRow label="Phone" value={websiteSettings?.contactPhone} href={websiteSettings?.contactPhone ? `tel:${websiteSettings.contactPhone}` : undefined} />
      <InfoRow label="WhatsApp" value={websiteSettings?.whatsappNumber} href={whatsappHref ?? undefined} />
      <InfoRow label="Email" value={websiteSettings?.contactEmail} href={websiteSettings?.contactEmail ? `mailto:${websiteSettings.contactEmail}` : undefined} />
      <InfoRow label="Address" value={websiteSettings?.address} />
      {!websiteSettings?.contactPhone && !websiteSettings?.contactEmail && !websiteSettings?.address && (
        <p>Please contact the shop through your order confirmation details.</p>
      )}
    </div>
  );
}

export function PolicyContent({ type }: { type: "delivery" | "returns" | "privacy" | "terms" }) {
  const { websiteSettings } = useShopContext();
  const text = type === "delivery"
    ? websiteSettings?.deliveryPolicy ?? DEFAULTS.delivery
    : type === "returns"
      ? websiteSettings?.returnPolicy ?? DEFAULTS.returns
      : type === "privacy"
        ? websiteSettings?.privacyPolicy ?? DEFAULTS.privacy
        : websiteSettings?.termsPolicy ?? DEFAULTS.terms;

  return <RichContent html={text} fallback="" />;
}

function RichContent({ html, fallback }: { html?: string | null; fallback: string }) {
  const clean = sanitizeOwnerHtml(html);
  if (!clean) return <p className="whitespace-pre-line">{fallback}</p>;

  return (
    <div
      className="space-y-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-gray-900 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_em]:italic"
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}

function sanitizeOwnerHtml(value?: string | null) {
  if (!value) return "";
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}

function InfoRow({ label, value, href }: { label: string; value?: string | null; href?: string }) {
  if (!value) return null;
  const content = (
    <>
      <span className="block text-xs font-medium uppercase tracking-wide text-gray-400">{label}</span>
      <span className="text-gray-800">{value}</span>
    </>
  );

  return href ? (
    <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="block rounded-lg bg-gray-50 px-3 py-2">
      {content}
    </a>
  ) : (
    <div className="rounded-lg bg-gray-50 px-3 py-2">{content}</div>
  );
}
