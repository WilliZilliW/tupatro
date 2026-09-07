import { useContext } from "react";
import { SeatContext, SetSeatContext } from "./seatContext";
import type { Seat } from "../game/types";

/* The seat the screen is drawn for. Defaults to 0, which is where the human
   sits in single player. */
export function useViewSeat(): Seat {
  return useContext(SeatContext);
}

/* Moves the window to another seat. useSeatSync is the only caller: the seat
   is corrected from the run's own `seats`, never chosen by a component. */
export function useSetViewSeat(): (p: Seat) => void {
  return useContext(SetSeatContext);
}
