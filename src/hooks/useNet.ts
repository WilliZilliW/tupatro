import { useContext } from "react";
import { NetContext, type Net } from "./netContext";

/* Split from the provider file so Fast Refresh keeps working — the same
   three-file shape localeContext / LocaleProvider / useI18n uses. */
export const useNet = (): Net => useContext(NetContext);

/* Is this window the shared table? Nine components ask, and a hook keeps the
   answer one comparison in one place rather than nine spellings of it. It is a
   property of the window like the role it reads, so it is never on
   GameState. */
export const useSpectating = (): boolean => useContext(NetContext).role === "table";
