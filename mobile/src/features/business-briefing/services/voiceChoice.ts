type Voice = { identifier: string; language: string; name: string; quality?: string };
// Voice metadata does not reliably expose gender. Offer preview and explicit selection.
export function banglaVoices<T extends Voice>(voices: T[]): T[] {
  const score = (v: Voice) => (/^bn[-_]bd$/i.test(v.language) ? 8 : 0)
    + (/female|woman|bangshi|tanishaa/i.test(v.name) ? 4 : 0) + (v.quality === "Enhanced" ? 1 : 0);
  return voices.filter(v => /^bn(?:[-_]|$)/i.test(v.language)).sort((a, b) => score(b) - score(a));
}
