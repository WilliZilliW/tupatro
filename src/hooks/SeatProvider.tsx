import { useState, type ReactNode } from "react";
import { SeatContext, SetSeatContext } from "./seatContext";
import type { Seat } from "../game/types";

/* Mounted beside LocaleProvider and outside GameProvider: the viewing seat is
   a property of the window, so it must not be inside the store it is used to
   read.

   The `seat` prop is the value it starts at — renderWith passes it, and
   main.tsx leaves it at 0 — and useState is what lets useSeatSync move it
   afterwards. It is deliberately not re-synchronised with the prop: the state
   is the authority once mounted. */
export function SeatProvider({ seat = 0, children }: { seat?: Seat; children: ReactNode }) {
  const [view, setView] = useState<Seat>(seat);
  return (
    <SetSeatContext.Provider value={setView}>
      <SeatContext.Provider value={view}>{children}</SeatContext.Provider>
    </SetSeatContext.Provider>
  );
}
