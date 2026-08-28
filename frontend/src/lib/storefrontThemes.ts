export interface StorefrontThemePreset {
  id: string;
  name: string;
  description: string;
  background: string;
  surface: string;
  header: string;
  headerMuted: string;
  text: string;
  mutedText: string;
  accent: string;
  accentText: string;
}

export const STOREFRONT_THEME_PRESETS: StorefrontThemePreset[] = [
  {
    id: "clean-light",
    name: "Clean Light",
    description: "White, charcoal, and a confident blue accent.",
    background: "#f8fafc",
    surface: "#ffffff",
    header: "#4f46e5",
    headerMuted: "#3730a3",
    text: "#111827",
    mutedText: "#6b7280",
    accent: "#4f46e5",
    accentText: "#ffffff",
  },
  {
    id: "luxury-dark",
    name: "Luxury Dark",
    description: "Charcoal storefront with warm gold actions.",
    background: "#111827",
    surface: "#1f2937",
    header: "#111827",
    headerMuted: "#030712",
    text: "#f9fafb",
    mutedText: "#d1d5db",
    accent: "#d4af37",
    accentText: "#111827",
  },
  {
    id: "soft-pastel",
    name: "Soft Pastel",
    description: "Gentle rose and cream with rich readable text.",
    background: "#fff7ed",
    surface: "#ffffff",
    header: "#be185d",
    headerMuted: "#9d174d",
    text: "#3f2723",
    mutedText: "#8b5e55",
    accent: "#db2777",
    accentText: "#ffffff",
  },
  {
    id: "fresh-green",
    name: "Fresh Green",
    description: "Pale mint, deep green, and crisp dark text.",
    background: "#ecfdf5",
    surface: "#ffffff",
    header: "#047857",
    headerMuted: "#065f46",
    text: "#10231c",
    mutedText: "#4b6359",
    accent: "#059669",
    accentText: "#ffffff",
  },
  {
    id: "modern-blue",
    name: "Modern Blue",
    description: "Cool blue-gray base with navy branding.",
    background: "#eef4ff",
    surface: "#ffffff",
    header: "#1d4ed8",
    headerMuted: "#1e3a8a",
    text: "#0f172a",
    mutedText: "#64748b",
    accent: "#2563eb",
    accentText: "#ffffff",
  },
  {
    id: "warm-sunset",
    name: "Warm Sunset",
    description: "Warm coral accents on a clean light base.",
    background: "#fff7ed",
    surface: "#ffffff",
    header: "#c2410c",
    headerMuted: "#9a3412",
    text: "#2f1f16",
    mutedText: "#7c5c49",
    accent: "#ea580c",
    accentText: "#ffffff",
  },
];

export function getStorefrontThemePreset(themeId?: string | null) {
  return STOREFRONT_THEME_PRESETS.find((theme) => theme.id === themeId) ?? STOREFRONT_THEME_PRESETS[0];
}
