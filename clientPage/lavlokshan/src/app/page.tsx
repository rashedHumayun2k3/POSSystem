import TopHeader from "@/components/TopHeader";
import PromoBanner from "@/components/PromoBanner";
import FlashSaleSection from "@/components/FlashSaleSection";
import HighRatingSection from "@/components/HighRatingSection";
import WholesaleSection from "@/components/WholesaleSection";
import CategoryChips from "@/components/CategoryChips";
import PopularShops from "@/components/PopularShops";
import PopularSection from "@/components/PopularSection";
import Footer from "@/components/Footer";

export default function HomePage() {
  return (
    <main>
      <TopHeader />
      <PromoBanner />
      <FlashSaleSection />
      <HighRatingSection />
      <WholesaleSection />
      <CategoryChips />
      <PopularShops />
      <PopularSection />
      <Footer />
    </main>
  );
}
