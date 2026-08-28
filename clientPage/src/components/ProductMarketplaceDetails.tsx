import type { MarketplaceDetailItem, MarketplaceDetailSection } from "@/lib/types";

const SECTION_LABELS: Record<MarketplaceDetailSection, string> = {
  STYLE: "Style",
  FEATURES_SPECS: "Features & Specs",
  ITEM_DETAILS: "Item Details",
};
const SECTION_ORDER: MarketplaceDetailSection[] = ["STYLE", "FEATURES_SPECS", "ITEM_DETAILS"];

export default function ProductMarketplaceDetails({ details }: { details: MarketplaceDetailItem[] }) {
  if (details.length === 0) return null;

  return (
    <div className="border-t border-gray-100 mt-5 pt-5">
      <h2 className="text-base font-semibold text-gray-900 mb-3">Product Details</h2>

      {SECTION_ORDER.map((section) => {
        const rows = details.filter((d) => d.section === section);
        if (rows.length === 0) return null;
        return (
          <div key={section} className="mb-5 last:mb-0">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">{SECTION_LABELS[section]}</h3>
            <div className="border border-gray-100 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className={i % 2 === 1 ? "bg-gray-50" : "bg-white"}>
                      <td className="px-3 py-2 text-gray-500 w-1/3 align-top">{row.label}</td>
                      <td className="px-3 py-2 text-gray-800">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
