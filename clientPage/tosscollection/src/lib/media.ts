// Backend returns storage-relative paths for uploaded images (e.g. business logos, product
// photos, review photos) — "/uploads/{businessId}/{file}.jpg" — served by the standalone
// ResellerApi.MediaService app, not the main API. Seed/demo data uses full external URLs
// (picsum.photos etc.) which already work as-is; only real uploads need resolving.
// Mirrors frontend/src/lib/media.ts.
export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const origin = process.env.NEXT_PUBLIC_MEDIA_URL ?? '';
  return `${origin}${url}`;
}
