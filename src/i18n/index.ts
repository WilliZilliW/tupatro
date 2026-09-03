import { SEATS } from "../game/constants";
import { en } from "./en";
import { fi, type Catalogue, type LocaleKey } from "./fi";
import type { Seat } from "../game/types";

/* The languages. Finnish is the original and the fallback: tuppi is a Finnish
   game, and its terms (rami, nolo, sooli, tuppi) stay as they are in English
   too, because they are the names of the things rather than translatable prose.

   Typing the keys turns a wrong key into a compile error, so a bad key never
   reaches runtime. */

export type Locale = "fi" | "en";

export const LOCALES: Record<Locale, Catalogue> = { fi, en };
export const LOCALE_NAMES: Record<Locale, string> = { fi: "Suomi", en: "English" };
export const LOCALE_ORDER: Locale[] = ["fi", "en"];

/* Number formatting follows the language: 1 616 vs 1,616. */
const NUMBER_TAGS: Record<Locale, string> = { fi: "fi-FI", en: "en-GB" };
const FALLBACK: Locale = "fi";
const STORAGE_KEY = "tupatro-locale";

export function isLocale(x: unknown): x is Locale {
  return x === "fi" || x === "en";
}

/* The browser's language if it is supported, else the previous choice, else
   Finnish. */
export function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLocale(saved)) return saved;
  } catch {
    /* private browsing: carry on with the default */
  }
  try {
    const nav = (navigator.language || "").slice(0, 2).toLowerCase();
    if (isLocale(nav)) return nav;
  } catch {
    /* no navigator (tests) */
  }
  return FALLBACK;
}

export function rememberLocale(locale: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* no storage: the choice holds for this session */
  }
}

export type Vars = Record<string, string | number>;

/* The untyped variant: data-table rows build their own keys
   (`joker.ramikone` + `.n`), so the type cannot check those. The rows have a
   test of their own. */
function lookup(locale: Locale, key: string): string | string[] | undefined {
  const table = LOCALES[locale] ?? LOCALES[FALLBACK];
  const own = (table as Record<string, string | string[]>)[key];
  if (own !== undefined) return own;
  return (LOCALES[FALLBACK] as Record<string, string | string[]>)[key];
}

/* A missing key is returned as itself, so it shows up in the interface
   instead of vanishing silently. */
export function translateRaw(locale: Locale, key: string, vars?: Vars): string {
  const s = lookup(locale, key);
  if (typeof s !== "string") return key;
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
}

export function translate(locale: Locale, key: LocaleKey, vars?: Vars): string {
  return translateRaw(locale, key, vars);
}

/* The rules panel's lists are arrays in the catalogue, so the HTML structure
   stays in the code and only one sentence at a time is translated. */
export function translateList(locale: Locale, key: string): string[] {
  const v = lookup(locale, key);
  return Array.isArray(v) ? v : [];
}

export function formatNumber(locale: Locale, n: number): string {
  return Number(n).toLocaleString(NUMBER_TAGS[locale] ?? NUMBER_TAGS.fi);
}

/* The data tables' names and descriptions live in the catalogues, so
   content.ts stays pure mechanics. Every row carries its own key. */
export function nameOfIn(locale: Locale, x: { key: string }): string {
  return translateRaw(locale, x.key + ".n");
}

export function descOfIn(locale: Locale, x: { key: string }): string {
  return translateRaw(locale, x.key + ".t");
}

/* Only the parties carry a `.g`. Their emblem abbreviates the name the player
   reads, so it is translated too — `KH` for Kahvipuolue abbreviates nothing an
   English player sees. One or two uppercase letters or digits, in the spirit of
   a Finnish ballot's letter codes: narrow enough for a card corner, and letters
   and digits can never render as tofu. The other tables' `g` glyphs stay data
   in content.ts, because a symbol has no language. */
export function emblemOfIn(locale: Locale, x: { key: string }): string {
  return translateRaw(locale, x.key + ".g");
}

/* The opponents are characters, not translatable text: Raimo stays Raimo in
   English too. Only the player is localised: "Sinä" / "You". */
export function seatNameIn(locale: Locale, p: Seat): string {
  const seat = SEATS[p];
  return seat.key ? translateRaw(locale, seat.key) : (seat.name ?? "");
}

export type { Catalogue, LocaleKey };
