import { Platform } from "react-native";
import type { ProductProfitReport } from "../types/productProfit";
import { buildProductProfitDocument } from "./productProfitDocument";
import type { ReportScope } from "./productSalesLink";

export async function printProductProfit(report: ProductProfitReport, business: string, selection: string, branch: string, scope: ReportScope = {}) {
  const html = buildProductProfitDocument(report, business, selection, branch, {
    ...scope, origin: Platform.OS === "web" ? window.location.origin : undefined,
  });
  if (Platform.OS === "web") {
    const preview = window.open("", "_blank", "width=1100,height=850");
    if (!preview) throw new Error("Allow pop-ups to open the print preview.");
    preview.document.write(html); preview.document.close();
  } else {
    const Print = await import("expo-print");
    const Sharing = await import("expo-sharing");
    const file = await Print.printToFileAsync({ html, width: 842, height: 595 });
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
    else await Print.printAsync({ uri: file.uri });
  }
}
