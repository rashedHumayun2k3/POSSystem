// App-wide number/date locale rules (Owner decision):
//  1. Numbers are always English digits, even in Bangla mode ("bn-BD" -> "bn-BD-u-nu-latn").
//  2. Money without an explicit locale uses one format everywhere: Bangladeshi grouping (1,00,000).
type Locales = string | string[] | undefined;

const latnDigits = (locales: Locales): Locales => {
  const fix = (l: string) => /^bn\b/i.test(l) && !/-u-.*nu-/i.test(l) ? `${l}${l.includes("-u-") ? "" : "-u"}-nu-latn` : l;
  return Array.isArray(locales) ? locales.map(fix) : typeof locales === "string" ? fix(locales) : locales;
};

const numberToLocale = Number.prototype.toLocaleString;
Number.prototype.toLocaleString = function (locales?: Locales, options?: Intl.NumberFormatOptions) {
  return numberToLocale.call(this, latnDigits(locales) ?? "en-BD", options);
};

for (const name of ["toLocaleString", "toLocaleDateString", "toLocaleTimeString"] as const) {
  const original = Date.prototype[name];
  Date.prototype[name] = function (locales?: Locales, options?: Intl.DateTimeFormatOptions) {
    return original.call(this, latnDigits(locales), options);
  };
}

export {};
