import { SEATS } from "./constants.js";
import { fi } from "./locale/fi.js";
import { en } from "./locale/en.js";

/* Kielet. Suomi on alkuperäinen: tuppi on suomalainen peli ja pelin termit
   (rami, nolo, sooli, tuppi) pysyvät sellaisina myös englanniksi, koska ne ovat
   asioiden nimiä eivätkä käännettävää proosaa. */
export const LOCALES = { fi, en };
export const LOCALE_NAMES = { fi: "Suomi", en: "English" };
/* Numeromuotoilu seuraa kieltä: 1 616 vs 1,616. */
const NUMBER_TAGS = { fi: "fi-FI", en: "en-GB" };
const FALLBACK = "fi";

let locale = FALLBACK;

/* Selaimen kieli jos se on tuettu, muuten aiempi valinta, muuten suomi. */
export function detectLocale() {
  try {
    const saved = localStorage.getItem("tupatro-locale");
    if (saved && LOCALES[saved]) return saved;
  } catch {
    /* yksityinen selaustila: jatketaan oletuksella */
  }
  try {
    const nav = (navigator.language || "").slice(0, 2).toLowerCase();
    if (LOCALES[nav]) return nav;
  } catch {
    /* ei navigatoria (testit) */
  }
  return FALLBACK;
}

export function getLocale() {
  return locale;
}

export function setLocale(next) {
  if (!LOCALES[next]) return locale;
  locale = next;
  try {
    localStorage.setItem("tupatro-locale", next);
  } catch {
    /* ei tallennusta: valinta pätee tämän istunnon ajan */
  }
  return locale;
}

/* t("key") tai t("key", {vars}). Puuttuva avain palautetaan sellaisenaan, jotta
   se näkyy käyttöliittymässä eikä katoa hiljaisesti — testi valvoo, ettei
   puuttuvia avaimia jää. */
export function t(key, vars) {
  const table = LOCALES[locale] || LOCALES[FALLBACK];
  let s = table[key];
  if (s === undefined) s = LOCALES[FALLBACK][key];
  if (s === undefined) return key;
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m));
}

/* Datataulukoiden nimet ja kuvaukset asuvat kielitiedostoissa, joten content.js
   pysyy pelkkänä mekaniikkana. Jokainen taulukon rivi kantaa avaimensa. */
export function nameOf(x) {
  return t(x.key + ".n");
}
export function descOf(x) {
  return t(x.key + ".t");
}

/* Vastustajat ja kaveri ovat hahmoja, eivät käännettävää tekstiä: Raimo pysyy
   Raimona myös englanniksi. Vain pelaaja itse on "sinä" / "you". */
export function seatName(p) {
  const seat = SEATS[p];
  return seat.key ? t(seat.key) : seat.name;
}

/* Ohjepaneelin listat ovat taulukoita kielitiedostossa, jotta HTML-rakenne
   pysyy koodissa ja käännettävänä on vain lause kerrallaan. */
export function tList(key) {
  const table = LOCALES[locale] || LOCALES[FALLBACK];
  const v = table[key] !== undefined ? table[key] : LOCALES[FALLBACK][key];
  return Array.isArray(v) ? v : [];
}

export function fmt(n) {
  return Number(n).toLocaleString(NUMBER_TAGS[locale] || NUMBER_TAGS.fi);
}
