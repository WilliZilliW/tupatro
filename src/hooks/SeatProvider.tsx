import type { ReactNode } from "react";
import { SeatContext } from "./seatContext";
import type { Seat } from "../game/types";

/* Mounted beside LocaleProvider and outside GameProvider: the viewing seat is
   a property of the window, so it must not be inside the store it is used to
   read. */
export function SeatProvider({ seat = 0, children }: { seat?: Seat; children: ReactNode }) {
  return <SeatContext.Provider value={seat}>{children}</SeatContext.Provider>;
}
