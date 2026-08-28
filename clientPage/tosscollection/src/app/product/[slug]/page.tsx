import ProductDetailClient from "./ProductDetailClient";

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return [{ slug: "template-product" }];
}

export default function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  return <ProductDetailClient params={params} />;
}
