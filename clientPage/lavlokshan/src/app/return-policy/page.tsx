import { PolicyContent, ShopInfoShell } from "@/components/ShopInfoPage";

export default function ReturnPolicyPage() {
  return (
    <ShopInfoShell title="Return Policy">
      <PolicyContent type="returns" />
    </ShopInfoShell>
  );
}
