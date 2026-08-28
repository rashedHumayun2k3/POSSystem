import TopHeader from "@/components/TopHeader";
import CategoryChips from "@/components/CategoryChips";
import PromoBanner from "@/components/PromoBanner";
import PopularSection from "@/components/PopularSection";
import TossActiveProductSection from "@/components/TossActiveProductSection";
import TossCollectionLifestyle from "@/components/TossCollectionLifestyle";
import TossCollectionYogaBanner from "@/components/TossCollectionYogaBanner";
import TossCollectionPromoTiles from "@/components/TossCollectionPromoTiles";
import TossCollectionDiscountBanner from "@/components/TossCollectionDiscountBanner";
import TossCollectionBenefits from "@/components/TossCollectionBenefits";
import Footer from "@/components/Footer";

export default function HomePage() {
  return (
    <main className="toss-template">
      <TopHeader />
      <PromoBanner />
      <TossActiveProductSection title="New arrival" />
      <TossCollectionPromoTiles />
      <CategoryChips />
      <TossCollectionBenefits />
      <TossCollectionDiscountBanner />
      <TossActiveProductSection title="Best selling" sort="popularity" />
      <TossActiveProductSection title="Featured products" sort="rating" />
      <TossCollectionYogaBanner />
      <PopularSection />
      <Footer />
    </main>
  );
}
