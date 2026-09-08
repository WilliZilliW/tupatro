import { useContext } from "react";
import { NetContext, type Net } from "./netContext";

/* Split from the provider file so Fast Refresh keeps working — the same
   three-file shape localeContext / LocaleProvider / useI18n uses. */
export const useNet = (): Net => useContext(NetContext);
