import { createContext } from "react";
import type { Locale, LocaleKey, Vars } from ".";
import type { Seat } from "../game/types";

/* The context in a module of its own, so the provider's file exports only
   components (Fast Refresh) and tests can use the same context. */
export type I18n = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: LocaleKey, vars?: Vars) => string;
  tList: (key: string) => string[];
  fmt: (n: number) => string;
  nameOf: (x: { key: string }) => string;
  descOf: (x: { key: string }) => string;
  emblemOf: (x: { key: string }) => string;
  /* `you` is the viewing seat, and it is passed in rather than read here: the
     provider sits outside the seat context on purpose. `null` is the shared
     table, whose window is nobody's chair. */
  seatName: (p: Seat, you: Seat | null) => string;
};

export const LocaleContext = createContext<I18n | null>(null);
