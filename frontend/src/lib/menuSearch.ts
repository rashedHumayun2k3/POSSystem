import en from "@/i18n/en.json";
import bn from "@/i18n/bn.json";

function translatedText(dictionary: unknown, key: string): string {
  let value = dictionary;
  for (const part of key.split(".")) {
    if (typeof value !== "object" || value === null) return "";
    value = (value as Record<string, unknown>)[part];
  }
  return typeof value === "string" ? value : "";
}

export function matchesMenuSearch(query: string, ...keys: string[]): boolean {
  const normalizedQuery = query.normalize("NFKC").trim().toLocaleLowerCase();
  return [en, bn].some((dictionary) =>
    keys.some((key) =>
      translatedText(dictionary, key).normalize("NFKC").toLocaleLowerCase().includes(normalizedQuery)
    )
  );
}
