// SEO-friendly product URLs without storing anything new: the slug is derived from the
// product name at link-render time (never persisted), and the trailing GUID is what actually
// resolves the product — the words before it are purely decorative for readability/SEO.
// This means: no migration, no backfill for existing products, and renamed products don't leave
// stale slugs behind (old shared links keep working since only the GUID matters; new links
// generated after a rename automatically show the new name).
const GUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildProductHref(id: string, name: string): string {
  const slug = slugify(name);
  return `/product/${slug ? `${slug}-` : ""}${id}`;
}

// Returns the product id embedded at the end of a /product/[slug] URL segment, or null if the
// segment doesn't end with a valid-looking GUID (malformed/garbage URL).
export function extractProductId(slugParam: string): string | null {
  const match = slugParam.match(GUID_RE);
  return match ? match[0] : null;
}
