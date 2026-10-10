/**
 * Public site language. `?lang=` is the only source of truth: a page without
 * it renders Japanese, and no stored preference is applied automatically
 * (Owner decision 2026-09-17).
 */
export const PUBLIC_LOCALES = ["ja", "en", "pt", "ko"] as const;
export type PublicLocale = (typeof PUBLIC_LOCALES)[number];
export const DEFAULT_PUBLIC_LOCALE: PublicLocale = "ja";
/** Request header set by `src/proxy.ts` so the root layout can render `<html lang>`. */
export const PUBLIC_LOCALE_HEADER = "x-pure-locale";
export const PUBLIC_LOCALE_OPTIONS = [
  { locale: "ja", nativeName: "日本語", code: "JA", htmlLang: "ja", openGraphLocale: "ja_JP" },
  { locale: "en", nativeName: "English", code: "EN", htmlLang: "en", openGraphLocale: "en_US" },
  { locale: "pt", nativeName: "Português", code: "PT", htmlLang: "pt", openGraphLocale: "pt_BR" },
  { locale: "ko", nativeName: "한국어", code: "KO", htmlLang: "ko", openGraphLocale: "ko_KR" },
] as const;

export function isPublicLocale(value: unknown): value is PublicLocale {
  return (
    typeof value === "string" &&
    (PUBLIC_LOCALES as readonly string[]).includes(value)
  );
}

/** Only an exact single `lang` value selects a language; anything else is Japanese. */
export function resolvePublicLocale(query: unknown): PublicLocale {
  return isPublicLocale(query) ? query : DEFAULT_PUBLIC_LOCALE;
}

export function publicLocaleOption(locale: PublicLocale) {
  return PUBLIC_LOCALE_OPTIONS.find((option) => option.locale === locale)!;
}

/** Replace only `lang`, preserving every other query value and the hash. Japanese omits it. */
export function publicLocaleUrl(href: string, locale: PublicLocale): string {
  const url = new URL(href);
  if (locale === DEFAULT_PUBLIC_LOCALE) url.searchParams.delete("lang");
  else url.searchParams.set("lang", locale);
  return url.href;
}

const LOCALE_BASE = "https://locale.invalid";
const UNLOCALIZED_PREFIXES = ["/api/", "/admin", "/_next/", "/media/", "/images/"];

/**
 * Carry the selected language on same-site page links. External URLs, API,
 * admin and asset paths are returned unchanged.
 */
export function localizedPublicHref(href: string, locale: PublicLocale): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const url = new URL(href, LOCALE_BASE);
  if (
    url.origin !== LOCALE_BASE ||
    UNLOCALIZED_PREFIXES.some((prefix) => url.pathname === prefix.replace(/\/$/u, "") || url.pathname.startsWith(prefix)) ||
    /\.[a-z0-9]+$/iu.test(url.pathname)
  )
    return href;
  if (locale === DEFAULT_PUBLIC_LOCALE) url.searchParams.delete("lang");
  else url.searchParams.set("lang", locale);
  return url.pathname + url.search + url.hash;
}

/** Pick a value from a four-locale dictionary. */
export function byLocale<T>(locale: PublicLocale, values: Readonly<Record<PublicLocale, T>>): T {
  return values[locale];
}
