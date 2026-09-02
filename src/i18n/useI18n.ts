import { useContext } from "react";
import { LocaleContext, type I18n } from "./localeContext";

export function useI18n(): I18n {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useI18n outside LocaleProvider");
  return ctx;
}
