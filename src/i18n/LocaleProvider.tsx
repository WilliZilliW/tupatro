import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  detectLocale,
  descOfIn,
  emblemOfIn,
  formatNumber,
  nameOfIn,
  rememberLocale,
  seatNameIn,
  translate,
  translateList,
  type Locale,
} from ".";
import { LocaleContext, type I18n } from "./localeContext";

/* The locale is React state, so switching it redraws the whole tree. */
export function LocaleProvider({ children, initial }: { children: ReactNode; initial?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(() => initial ?? detectLocale());

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    rememberLocale(l);
  }, []);

  const value = useMemo<I18n>(
    () => ({
      locale,
      setLocale,
      t: (key, vars) => translate(locale, key, vars),
      tList: (key) => translateList(locale, key),
      fmt: (n) => formatNumber(locale, n),
      nameOf: (x) => nameOfIn(locale, x),
      descOf: (x) => descOfIn(locale, x),
      emblemOf: (x) => emblemOfIn(locale, x),
      seatName: (p) => seatNameIn(locale, p),
    }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
