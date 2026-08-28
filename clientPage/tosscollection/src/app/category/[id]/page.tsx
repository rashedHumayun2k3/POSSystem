import CategoryClient from "./CategoryClient";

export async function generateStaticParams(): Promise<{ id: string }[]> {
  return [{ id: "template-category" }];
}

export default function CategoryPage({ params }: { params: Promise<{ id: string }> }) {
  return <CategoryClient params={params} />;
}
