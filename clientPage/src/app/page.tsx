import TopHeader from "@/components/TopHeader";
import PromoBanner from "@/components/PromoBanner";
import CategoryChips from "@/components/CategoryChips";
import PopularShops from "@/components/PopularShops";
import ProductGrid from "@/components/ProductGrid";
import Footer from "@/components/Footer";

export default function HomePage() {
  return (
    <main>
      <TopHeader />
      <PromoBanner />
      <CategoryChips />
      <PopularShops />
      <ProductGrid title="Popular Products" />
      <Footer />
    </main>
  );
}
