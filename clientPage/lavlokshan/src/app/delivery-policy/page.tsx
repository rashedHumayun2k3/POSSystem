import { PolicyContent, ShopInfoShell } from "@/components/ShopInfoPage";

export default function DeliveryPolicyPage() {
  return (
    <ShopInfoShell title="Delivery Policy">
      <PolicyContent type="delivery" />
    </ShopInfoShell>
  );
}
